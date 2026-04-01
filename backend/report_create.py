import os
import io
import base64
import os.path
from pathlib import Path
from datetime import datetime
from typing import Optional, List
import numpy as np
import cv2
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.encoders import jsonable_encoder
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pymongo import MongoClient
from bson import ObjectId
from ultralytics import YOLO
import qrcode
from dotenv import load_dotenv
from geopy.distance import geodesic

# Apply PyTorch 2.6+ patch for YOLO model loading
try:
    import torch_patch
except ImportError:
    print("⚠ Warning: torch_patch.py not found, attempting direct patch...")
    import torch
    import torch.nn as nn
    try:
        # Add PyTorch modules
        torch.serialization.add_safe_globals([
            nn.Sequential, nn.ModuleList, nn.Conv2d, nn.BatchNorm2d,
            nn.MaxPool2d, nn.Linear, nn.SiLU, nn.ReLU, nn.Sigmoid,
            nn.Upsample, nn.Identity, nn.Parameter
        ])
        # Add ultralytics modules
        try:
            from ultralytics.nn.tasks import DetectionModel
            from ultralytics.nn.modules import Conv, C2f, SPPF, Detect, Concat
            torch.serialization.add_safe_globals([DetectionModel, Conv, C2f, SPPF, Detect, Concat])
        except:
            pass
        print("✓ Direct PyTorch patch applied")
    except Exception as e:
        print(f"⚠ Could not apply patch: {e}")

load_dotenv()

# =============== CONFIG ===============

app = FastAPI(title="Pothole Detection API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
MONGO_URL = os.getenv("MONGO_DB_URL", None)
MONGO_ENABLED = False
reports_collection = None

print(f"[INIT] MONGO_DB_URL: {MONGO_URL}")

if MONGO_URL and ("mongodb+srv://" in MONGO_URL or "mongodb://" in MONGO_URL):
    try:
        print(f"[INIT] Attempting MongoDB connection...")
        client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
        # Test connection
        server_info = client.server_info()
        print(f"[INIT] ✓ MongoDB connected successfully - {server_info}")
        
        db = client.get_database()
        reports_collection = db.reports
        MONGO_ENABLED = True
        print(f"[INIT] ✓ Using MongoDB collection: {reports_collection}")
    except Exception as e:
        print(f"[INIT] ❌ MongoDB connection failed: {str(e)}")
        print(f"[INIT] Using file-based storage as fallback")
        MONGO_ENABLED = False
        import traceback
        traceback.print_exc()
else:
    print(f"[INIT] ⚠ No valid MongoDB URL provided - using file-based storage")
    print(f"[INIT] Expected format: mongodb+srv://user:pass@cluster.mongodb.net/database")
    MONGO_ENABLED = False

# Create reports directory for file-based storage
if not MONGO_ENABLED:
    os.makedirs("reports_data", exist_ok=True)
    print("✓ File-based storage enabled")

# Model paths
POTHOLE_MODEL_PATH = os.getenv("POTHOLE_MODEL_PATH", "models/pothole/best.pt")
MANHOLE_MODEL_PATH = os.getenv("MANHOLE_MODEL_PATH", "models/manhole/manhole_best.pt")

# Detection configuration
POTHOLE_CONF_THRESHOLD = float(os.getenv("POTHOLE_CONF_THRESHOLD", "0.2"))
IOU_THRESHOLD = float(os.getenv("IOU_THRESHOLD", "0.3"))
LOCATION_VERIFICATION_RADIUS = float(os.getenv("LOCATION_VERIFICATION_RADIUS", "15"))

# Smart verification thresholds (confidence/area reduction)
CONFIDENCE_DROP_THRESHOLD = float(os.getenv("CONFIDENCE_DROP_THRESHOLD", "0.3"))  # 30%
AREA_DROP_THRESHOLD = float(os.getenv("AREA_DROP_THRESHOLD", "0.4"))  # 40%

# Cost calculation
BASE_REPAIR_COST = int(os.getenv("BASE_REPAIR_COST", "500"))
SIZE_COST_PER_CM = int(os.getenv("SIZE_COST_PER_CM", "50"))

# Reference sizes for calibration
REFERENCE_SIZES_CM = {"Manhole Cover": 60.0}

# Traffic weights
TRAFFIC_WEIGHT = {"LOW": 0.5, "CITY": 1.0, "HIGHWAY": 1.5}

# UPI Configuration
MUNICIPAL_UPI_ID = os.getenv("MUNICIPAL_UPI_ID", "municipal@upi")

# Load YOLO models once at startup
pothole_detector = None
reference_detector = None

@app.on_event("startup")
async def load_models():
    global pothole_detector, reference_detector
    try:
        # Create uploads directory
        Path("uploads").mkdir(exist_ok=True)
        Path("uploads/qr_codes").mkdir(exist_ok=True)
        print("✓ Uploads directory ready")
        
        print(f"Loading pothole model: {POTHOLE_MODEL_PATH}")
        pothole_detector = YOLO(POTHOLE_MODEL_PATH)
        print(f"Loading manhole model: {MANHOLE_MODEL_PATH}")
        reference_detector = YOLO(MANHOLE_MODEL_PATH)
        print("✓ Models loaded successfully")
    except Exception as e:
        print(f"❌ MODEL LOAD FAILED: {e}")
        print("If you're using PyTorch 2.6+, ensure torch_patch.py is present")

# =============== MODELS ===============

class ReportCreate(BaseModel):
    latitude: float
    longitude: float

class JobAccept(BaseModel):
    contractor_id: str

class JobComplete(BaseModel):
    contractor_id: str
    latitude: float
    longitude: float

class PaymentRequest(BaseModel):
    amount: int
    job_id: str
    description: str

# =============== UTILS ===============

def iou(boxA, boxB):
    """Calculate Intersection over Union"""
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])
    
    inter = max(0, xB - xA) * max(0, yB - yA)
    areaA = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1])
    areaB = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1])
    return inter / (areaA + areaB - inter + 1e-6)

def detect_potholes(image_bytes: bytes):
    """Detect potholes using YOLO models, filter out manholes. Returns averaged size and bounty for all potholes."""
    nparr = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if image is None:
        raise ValueError("Invalid image")
    
    pothole_results = pothole_detector(image, conf=0.25)[0]
    reference_results = reference_detector(image, conf=0.25)[0]
    
    potholes = pothole_results.boxes
    references = reference_results.boxes
    
    valid_potholes = []
    
    for p in potholes:
        p_conf = float(p.conf[0])
        if p_conf < 0.15:  # Lower threshold for initial detection
            continue
        
        p_box = p.xyxy[0].cpu().numpy()
        overlap = False
        
        for r in references:
            r_box = r.xyxy[0].cpu().numpy()
            if iou(p_box, r_box) > IOU_THRESHOLD:
                overlap = True
                break
        
        if not overlap:
            valid_potholes.append(p)
    
    if not valid_potholes:
        return {"pothole_count": 0, "severity": "NONE", "confidence": 0.0, "bounty": 0, "size_cm": 0.0, "average_size_cm": 0.0}
    
    scale = None
    if len(references) > 0:
        try:
            ref_box = references[0].xyxy[0].cpu().numpy()
            ref_px = ref_box[2] - ref_box[0]
            if ref_px > 0:
                scale = REFERENCE_SIZES_CM.get("Manhole Cover", 60) / ref_px
        except Exception as scale_error:
            print(f"[DEBUG] Error calculating scale: {str(scale_error)}")
            scale = None
    
    # Calculate sizes for ALL potholes
    all_sizes_cm = []
    all_confidences = []
    all_box_areas = []  # For total area calculation
    
    for p in valid_potholes:
        box = p.xyxy[0].cpu().numpy()
        width_px = box[2] - box[0]
        height_px = box[3] - box[1]
        conf = float(p.conf[0])
        all_confidences.append(conf)
        
        # Store bounding box area in pixels for smart verification
        box_area_px = width_px * height_px
        all_box_areas.append(box_area_px)
        
        if scale:
            # SIZE DETECTION WITH REFERENCE OBJECT
            # Uses manhole cover (60cm) as reference scale
            # Calculation: pothole_width_pixels * (reference_size_cm / reference_width_pixels)
            size_cm = width_px * scale
            all_sizes_cm.append(size_cm)
            print(f"[SIZE] Pothole detected - Width: {width_px:.1f}px, Scale: {scale:.4f}, Size: {size_cm:.1f}cm")
        else:
            # FALLBACK: Estimate without reference object
            # Uses average of width + height as dimension measure
            # Approximation: 1.5 pixels ≈ 1cm at typical smartphone distance (1-2 meters)
            pixel_area = (width_px + height_px) / 2
            estimated_size_cm = pixel_area / 1.5
            estimated_size_cm = max(10, min(80, estimated_size_cm))
            all_sizes_cm.append(estimated_size_cm)
            print(f"[SIZE] Pothole estimated (no reference) - Width: {width_px:.1f}px, Height: {height_px:.1f}px, Estimated: {estimated_size_cm:.1f}cm")
    
    # Average size across all detected potholes
    average_size_cm = sum(all_sizes_cm) / len(all_sizes_cm) if all_sizes_cm else 0.0
    average_confidence = sum(all_confidences) / len(all_confidences)
    pothole_count = len(valid_potholes)
    
    # Determine severity based on average size
    if average_size_cm < 20:
        severity = "LOW"
        road_type = "LOW"
    elif average_size_cm < 40:
        severity = "MEDIUM"
        road_type = "CITY"
    else:
        severity = "HIGH"
        road_type = "HIGHWAY"
    
    # Calculate bounty based on count and average size
    if scale:
        traffic = TRAFFIC_WEIGHT[road_type]
        base_bounty = BASE_REPAIR_COST + (average_size_cm * SIZE_COST_PER_CM * traffic)
        # Bonus for multiple potholes: 15% per extra pothole (capped at 200%)
        count_multiplier = min(1 + (pothole_count - 1) * 0.15, 2.0)
        bounty = int(base_bounty * count_multiplier)
    else:
        # No reference detected - use base cost with count multiplier
        base_bounty = BASE_REPAIR_COST
        count_multiplier = min(1 + (pothole_count - 1) * 0.15, 2.0)
        bounty = int(base_bounty * count_multiplier)
    
    # Calculate total area for smart verification
    total_area = sum(all_box_areas) if all_box_areas else 0
    
    return {
        "pothole_count": pothole_count,
        "severity": severity,
        "confidence": round(average_confidence, 2),
        "bounty": bounty,
        "size_cm": round(average_size_cm, 1),
        "average_size_cm": round(average_size_cm, 1),
        "total_area": total_area,  # For smart verification
        "reference_detected": scale is not None
    }

def verify_no_pothole(image_bytes: bytes):
    """Verify that image contains no potholes"""
    nparr = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if image is None:
        raise ValueError("Invalid image")
    
    pothole_results = pothole_detector(image, conf=POTHOLE_CONF_THRESHOLD)[0]
    reference_results = reference_detector(image, conf=0.25)[0]
    
    potholes = pothole_results.boxes
    references = reference_results.boxes
    
    for p in potholes:
        p_box = p.xyxy[0].cpu().numpy()
        overlap = False
        
        for r in references:
            r_box = r.xyxy[0].cpu().numpy()
            if iou(p_box, r_box) > IOU_THRESHOLD:
                overlap = True
                break
        
        if not overlap:
            return False
    
    return True

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two coordinates in meters"""
    return geodesic((lat1, lon1), (lat2, lon2)).meters

def visualize_detections(image_bytes: bytes, image_id: str):
    """Draw bounding boxes on detected potholes and save annotated image for debugging"""
    try:
        print(f"[DEBUG] Starting visualization for image_id: {image_id}")
        Path("uploads").mkdir(exist_ok=True)
        
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            print(f"[DEBUG] ERROR: Could not decode image for visualization")
            return None
        
        print(f"[DEBUG] Image decoded: shape {image.shape}")
        
        # Create a copy for annotation
        annotated = image.copy()
        
        # Run detections
        print(f"[DEBUG] Running pothole detection...")
        pothole_results = pothole_detector(image, conf=POTHOLE_CONF_THRESHOLD)[0]
        reference_results = reference_detector(image, conf=0.25)[0]
        
        potholes = pothole_results.boxes
        references = reference_results.boxes
        
        print(f"[DEBUG] Detection complete: {len(potholes)} potholes, {len(references)} references")
        
        # Draw reference boxes in GREEN
        for r in references:
            r_box = r.xyxy[0].cpu().numpy().astype(int)
            cv2.rectangle(annotated, (r_box[0], r_box[1]), (r_box[2], r_box[3]), (0, 255, 0), 2)
            cv2.putText(annotated, "Reference", (r_box[0], r_box[1]-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
        
        # Draw pothole boxes in BLUE
        for p in potholes:
            p_box = p.xyxy[0].cpu().numpy().astype(int)
            conf = float(p.conf[0])
            cv2.rectangle(annotated, (p_box[0], p_box[1]), (p_box[2], p_box[3]), (255, 0, 0), 2)
            cv2.putText(annotated, f"Pothole {conf:.2f}", (p_box[0], p_box[1]-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 2)
        
        # Save annotated image
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        annotated_filename = f"detection_{image_id}_{timestamp}.jpg"
        annotated_path = f"uploads/{annotated_filename}"
        cv2.imwrite(annotated_path, annotated)
        
        print(f"[DEBUG] ✓ Visualization SAVED: {annotated_path}")
        print(f"[DEBUG] Detected: {len(potholes)} potholes, {len(references)} references")
        
        return annotated_path
    except Exception as e:
        import traceback
        print(f"[DEBUG] VISUALIZATION ERROR: {str(e)}")
        print(f"[DEBUG] Traceback: {traceback.format_exc()}")
        return None

# =============== FILE-BASED STORAGE HELPERS ===============

def load_report_from_file(report_id: str):
    """Load a report from file-based storage"""
    import json
    filepath = f"reports_data/{report_id}.json"
    try:
        with open(filepath, 'r') as f:
            report = json.load(f)
        report['_id'] = report_id
        return report
    except:
        return None

def save_report_to_file(report_id: str, report: dict):
    """Save a report to file-based storage"""
    import json
    Path("reports_data").mkdir(exist_ok=True)
    filepath = f"reports_data/{report_id}.json"
    report_copy = report.copy()
    report_copy.pop('_id', None)
    with open(filepath, 'w') as f:
        json.dump(report_copy, f, indent=2, default=str)

def get_all_reports_from_files(query: dict = None):
    """Get all reports matching query from file-based storage"""
    import json
    from glob import glob
    reports = []
    try:
        for filepath in glob("reports_data/*.json"):
            try:
                with open(filepath, 'r') as f:
                    report = json.load(f)
                    report_id = os.path.basename(filepath).replace('.json', '')
                    report['_id'] = report_id
                    
                    # Apply query filter
                    if query:
                        match = True
                        for key, value in query.items():
                            if key == 'status' and report.get('status') != value:
                                match = False
                            elif key == 'contractor_id' and report.get('contractor_id') != value:
                                match = False
                            elif key == '$in' and 'status' in query.get('$in', {}):
                                if report.get('status') not in query.get('status', {}).get('$in', []):
                                    match = False
                        if not match and query:
                            continue
                    
                    reports.append(report)
            except:
                continue
    except:
        pass
    return reports

# =============== API ENDPOINTS ===============

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "models_loaded": pothole_detector is not None and reference_detector is not None}

@app.post("/api/report")
async def create_report(image: UploadFile = File(...), latitude: float = Form(...), longitude: float = Form(...)):
    """Create a new pothole report"""
    try:
        print("[DEBUG] Starting create_report endpoint")
        image_bytes = await image.read()
        print(f"[DEBUG] Image received: {len(image_bytes)} bytes")
        
        detection_result = detect_potholes(image_bytes)
        print(f"[DEBUG] Detection result: {detection_result}")
        
        if detection_result["pothole_count"] == 0:
            raise HTTPException(status_code=400, detail="No pothole detected in image")
        
        print(f"[DEBUG] Pothole detected! Count: {detection_result['pothole_count']}")
        
        # Generate visualization with blue boxes
        viz_path = visualize_detections(image_bytes, f"report_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
        print(f"[DEBUG] Visualization saved: {viz_path}")
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        image_filename = f"pothole_{timestamp}.jpg"
        image_path = f"uploads/{image_filename}"
        
        Path("uploads").mkdir(exist_ok=True)
        with open(image_path, "wb") as f:
            f.write(image_bytes)
        
        print(f"[DEBUG] Building report object...")
        try:
            # Calculate total initial area (for smart verification)
            initial_area = detection_result.get("total_area", 0)
            
            report = {
                "image_path": image_path,
                "latitude": float(latitude),
                "longitude": float(longitude),
                "severity": str(detection_result["severity"]),
                "confidence": float(detection_result["confidence"]),
                "initial_confidence": float(detection_result["confidence"]),  # Store for verification
                "initial_area": float(initial_area),  # Store for verification
                "bounty": int(detection_result["bounty"]),
                "size_cm": float(detection_result["size_cm"]),
                "pothole_count": int(detection_result["pothole_count"]),
                "status": "OPEN",
                "contractor_id": None,
                "created_at": datetime.now(),
                "accepted_at": None,
                "completed_at": None,
                "completion_image_path": None
            }
            print(f"[DEBUG] Report object built successfully")
        except Exception as build_error:
            print(f"[DEBUG] ERROR building report: {str(build_error)}")
            print(f"[DEBUG] Detection result type: {type(detection_result)}")
            print(f"[DEBUG] Detection result keys: {detection_result.keys() if isinstance(detection_result, dict) else 'NOT A DICT'}")
            raise HTTPException(status_code=400, detail=f"Error building report: {str(build_error)}")
        
        report_id = None
        try:
            if MONGO_ENABLED and reports_collection is not None:
                result = reports_collection.insert_one(report)
                report_id = str(result.inserted_id)
                print(f"[DEBUG] MongoDB insert successful: {report_id}")
            else:
                # File-based fallback
                import json
                report_id = str(ObjectId())
                report["_id"] = report_id
                Path("reports_data").mkdir(exist_ok=True)
                filepath = f"reports_data/{report_id}.json"
                with open(filepath, 'w') as f:
                    json.dump(report, f, indent=2, default=str)
                print(f"[DEBUG] File-based save successful: {filepath}")
        except Exception as db_error:
            print(f"[DEBUG] Save error: {str(db_error)}")
            import traceback
            print(f"[DEBUG] Traceback: {traceback.format_exc()}")
            raise HTTPException(status_code=400, detail=f"Error saving report: {str(db_error)}")
        
        return {
            "success": True, 
            "report_id": report_id, 
            "message": "Pothole report created successfully",
            "latitude": float(latitude),
            "longitude": float(longitude),
            "details": {
                "severity": detection_result["severity"], 
                "bounty": detection_result["bounty"], 
                "pothole_count": detection_result["pothole_count"],
                "confidence": float(detection_result["confidence"]),
                "size_cm": float(detection_result["size_cm"])
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[DEBUG] Unexpected error in create_report: {str(e)}")
        import traceback
        print(f"[DEBUG] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/reports/open")
async def get_open_reports(contractor_lat: float = None, contractor_lon: float = None):
    """Get all open pothole reports"""
    try:
        # Get reports from MongoDB or file storage
        if MONGO_ENABLED and reports_collection is not None:
            reports = list(reports_collection.find({"status": "OPEN"}))
        else:
            reports = get_all_reports_from_files({"status": "OPEN"})
        
        result = []
        for report in reports:
            created_at = report.get("created_at")
            created_at_str = created_at.isoformat() if created_at and hasattr(created_at, 'isoformat') else str(created_at) if created_at else None
            
            report_data = {
                "id": str(report["_id"]),
                "image_path": report.get("image_path", ""),
                "latitude": report.get("latitude", 0),
                "longitude": report.get("longitude", 0),
                "severity": report.get("severity", "UNKNOWN"),
                "confidence": report.get("confidence", 0),
                "bounty": report.get("bounty", 0),
                "size_cm": report.get("size_cm", 0),
                "pothole_count": report.get("pothole_count", 1),
                "created_at": created_at_str,
                "status": report.get("status", "OPEN")
            }
            
            if contractor_lat is not None and contractor_lon is not None:
                report_lat = report.get("latitude")
                report_lon = report.get("longitude")
                if report_lat is not None and report_lon is not None:
                    distance = calculate_distance(contractor_lat, contractor_lon, report_lat, report_lon)
                    report_data["distance_meters"] = round(distance, 2)
            
            result.append(report_data)
        
        if contractor_lat is not None and contractor_lon is not None:
            result.sort(key=lambda x: x.get("distance_meters", float('inf')))
        
        return JSONResponse(content=jsonable_encoder({"reports": result}))
        
    except Exception as e:
        print(f"[DEBUG] Error in get_open_reports: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/image/{filename}")
async def get_image(filename: str):
    """Serve pothole images"""
    try:
        from fastapi.responses import FileResponse
        import os
        
        # Security: prevent directory traversal
        if ".." in filename or "/" in filename:
            raise HTTPException(status_code=400, detail="Invalid filename")
        
        filepath = f"uploads/{filename}"
        if not os.path.exists(filepath):
            raise HTTPException(status_code=404, detail="Image not found")
        
        return FileResponse(filepath, media_type="image/jpeg")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/reports/all")
async def get_all_reports():
    """Get all pothole reports (for the reports page)"""
    try:
        # Get all reports from MongoDB or file storage
        if MONGO_ENABLED and reports_collection is not None:
            reports = list(reports_collection.find().sort("created_at", -1))
        else:
            reports = get_all_reports_from_files()
            # Sort by created_at descending
            if reports:
                reports = sorted(reports, key=lambda x: x.get("created_at", ""), reverse=True)
        
        result = []
        for report in reports:
            created_at = report.get("created_at")
            created_at_str = created_at.isoformat() if created_at and hasattr(created_at, 'isoformat') else str(created_at) if created_at else None
            
            # Convert local image path to API URL
            image_path = report.get("image_path", "")
            image_url = ""
            if image_path:
                # Extract filename from path
                filename = image_path.split("/")[-1]
                image_url = f"/api/image/{filename}"
            
            report_data = {
                "id": str(report.get("_id", "")),
                "image_path": image_url,
                "latitude": report.get("latitude", 0),
                "longitude": report.get("longitude", 0),
                "location_name": report.get("location_name", ""),
                "severity": report.get("severity", "UNKNOWN"),
                "confidence": round(float(report.get("confidence", 0)), 2),
                "bounty": report.get("bounty", 0),
                "size_cm": report.get("size_cm", 0),
                "pothole_count": report.get("pothole_count", 1),
                "created_at": created_at_str,
                "status": report.get("status", "OPEN"),
                "contractor_id": report.get("contractor_id")
            }
            
            result.append(report_data)
        
        return JSONResponse(content=jsonable_encoder({"reports": result, "total": len(result)}))
        
    except Exception as e:
        print(f"[DEBUG] Error in get_all_reports: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/report/{report_id}/accept")
async def accept_job(report_id: str, job_accept: JobAccept):
    """Contractor accepts a job"""
    try:
        if MONGO_ENABLED and reports_collection is not None:
            result = reports_collection.update_one({"_id": ObjectId(report_id), "status": "OPEN"}, {"$set": {"status": "IN_PROGRESS", "contractor_id": job_accept.contractor_id, "accepted_at": datetime.now()}})
            if result.modified_count == 0:
                raise HTTPException(status_code=400, detail="Job already taken or not found")
        else:
            report = load_report_from_file(report_id)
            if not report or report.get("status") != "OPEN":
                raise HTTPException(status_code=400, detail="Job already taken or not found")
            report["status"] = "IN_PROGRESS"
            report["contractor_id"] = job_accept.contractor_id
            report["accepted_at"] = datetime.now()
            save_report_to_file(report_id, report)
        
        return {"success": True, "message": "Job accepted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[DEBUG] Error in accept_job: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/report/{report_id}/reject")
async def reject_job(report_id: str):
    """Contractor rejects a job (only for jobs they've already accepted)"""
    try:
        print(f"[DEBUG] Reject request for report_id: {report_id}")
        
        if MONGO_ENABLED and reports_collection is not None:
            # Only allow rejecting jobs that are IN_PROGRESS (already accepted)
            result = reports_collection.update_one(
                {"_id": ObjectId(report_id), "status": "IN_PROGRESS"}, 
                {"$set": {"status": "OPEN", "contractor_id": None, "accepted_at": None}}
            )
            if result.modified_count == 0:
                print(f"[DEBUG] Job not found in IN_PROGRESS status")
                raise HTTPException(status_code=400, detail="Job not found or not in progress. Can only reject accepted jobs.")
        else:
            report = load_report_from_file(report_id)
            print(f"[DEBUG] Loaded report, status: {report.get('status') if report else 'NOT FOUND'}")
            
            if not report or report.get("status") != "IN_PROGRESS":
                print(f"[DEBUG] Job not in IN_PROGRESS status, cannot reject")
                raise HTTPException(status_code=400, detail="Job not found or not in progress. Can only reject accepted jobs.")
            
            report["status"] = "OPEN"
            report["contractor_id"] = None
            report["accepted_at"] = None
            save_report_to_file(report_id, report)
        
        print(f"[DEBUG] Job rejected successfully")
        return {"success": True, "message": "Job rejected successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[DEBUG] Error in reject_job: {str(e)}")
        import traceback
        print(f"[DEBUG] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/report/{report_id}/complete")
async def complete_job(report_id: str, image: UploadFile = File(...), latitude: float = Form(...), longitude: float = Form(...), contractor_id: str = Form(...)):
    """Contractor completes a job with verification"""
    try:
        print(f"[DEBUG] Complete job request - report_id: {report_id}, contractor_id: {contractor_id}, lat: {latitude}, lon: {longitude}")
        
        if MONGO_ENABLED and reports_collection is not None:
            report = reports_collection.find_one({"_id": ObjectId(report_id), "contractor_id": contractor_id, "status": "IN_PROGRESS"})
        else:
            report = load_report_from_file(report_id)
            print(f"[DEBUG] Loaded report from file: {report is not None}")
            if report:
                print(f"[DEBUG] Report status: {report.get('status')}, contractor_id match: {report.get('contractor_id') == contractor_id}")
            if report and (report.get("contractor_id") != contractor_id or report.get("status") != "IN_PROGRESS"):
                report = None
        
        if not report:
            print(f"[DEBUG] Report not found or not assigned")
            raise HTTPException(status_code=404, detail="Report not found or not assigned to you")
        
        print(f"[DEBUG] Calculating distance from ({report['latitude']}, {report['longitude']}) to ({latitude}, {longitude})")
        distance = calculate_distance(report["latitude"], report["longitude"], latitude, longitude)
        print(f"[DEBUG] Distance: {distance}m, Limit: {LOCATION_VERIFICATION_RADIUS}m")
        
        if distance > LOCATION_VERIFICATION_RADIUS:
            error_msg = f"Location verification failed. You are {round(distance, 1)}m away from the pothole location. Must be within {LOCATION_VERIFICATION_RADIUS}m."
            print(f"[DEBUG] {error_msg}")
            raise HTTPException(status_code=400, detail=error_msg)
        
        image_bytes = await image.read()
        print(f"[DEBUG] Image size: {len(image_bytes)} bytes, verifying repair...")
        
        # Generate visualization for debugging
        viz_path = visualize_detections(image_bytes, report_id)
        print(f"[DEBUG] Visualization saved at: {viz_path}")
        
        # Simple verification: Check if confidence is below 40%
        after_detection = detect_potholes(image_bytes)
        after_confidence = after_detection.get("confidence", 0)
        
        print(f"[DEBUG] Completion photo confidence: {after_confidence}")
        print(f"[DEBUG] Verification threshold: 0.40 (40%)")
        
        # Accept if confidence is below 40% (no significant pothole detected)
        is_verified = after_confidence < 0.4
        
        print(f"[DEBUG] Verification result - is_verified: {is_verified}")
        
        if not is_verified:
            error_msg = f"VERIFICATION FAILED: Pothole still detected with confidence {after_confidence:.2f}. Confidence must be below 0.40. Please repair more thoroughly. Debug image: {viz_path}"
            print(f"[DEBUG] {error_msg}")
            raise HTTPException(status_code=400, detail=error_msg)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        completion_filename = f"completed_{timestamp}.jpg"
        completion_path = f"uploads/{completion_filename}"
        
        with open(completion_path, "wb") as f:
            f.write(image_bytes)
        
        if MONGO_ENABLED and reports_collection is not None:
            reports_collection.update_one({"_id": ObjectId(report_id)}, {"$set": {"status": "COMPLETED", "completed_at": datetime.now(), "completion_image_path": completion_path, "completion_latitude": latitude, "completion_longitude": longitude}})
        else:
            report["status"] = "COMPLETED"
            report["completed_at"] = datetime.now()
            report["completion_image_path"] = completion_path
            report["completion_latitude"] = latitude
            report["completion_longitude"] = longitude
            save_report_to_file(report_id, report)
        
        return {"success": True, "message": "Job completed and verified successfully", "bounty": report["bounty"]}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[DEBUG] Error in complete_job: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/report/{report_id}/payment")
async def get_payment_qr(report_id: str):
    """Generate UPI QR code for payment"""
    try:
        if MONGO_ENABLED and reports_collection is not None:
            try:
                report = reports_collection.find_one({"_id": ObjectId(report_id)})
            except:
                report = reports_collection.find_one({"_id": report_id})
        else:
            report = load_report_from_file(report_id)
        
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        
        status = report.get("status")
        if status not in ["COMPLETED", "PAID"]:
            raise HTTPException(status_code=400, detail=f"Report status is {status}. Payment only available for completed jobs.")
        
        bounty = report.get("bounty", 0)
        qr_base64 = generate_upi_qr(bounty, report_id)
        
        if status == "COMPLETED":
            if MONGO_ENABLED and reports_collection is not None:
                try:
                    reports_collection.update_one({"_id": ObjectId(report_id)}, {"$set": {"status": "PAID", "paid_at": datetime.now()}})
                except:
                    reports_collection.update_one({"_id": report_id}, {"$set": {"status": "PAID", "paid_at": datetime.now()}})
            else:
                report["status"] = "PAID"
                report["paid_at"] = datetime.now()
                save_report_to_file(report_id, report)
        
        return JSONResponse(content=jsonable_encoder({"success": True, "qr_code": qr_base64, "amount": bounty, "upi_id": MUNICIPAL_UPI_ID}))
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[DEBUG] Error in get_payment_qr: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/contractor/{contractor_id}/jobs")
async def get_contractor_jobs(contractor_id: str):
    """Get all jobs for a specific contractor"""
    try:
        if MONGO_ENABLED and reports_collection is not None:
            jobs = list(reports_collection.find({"contractor_id": contractor_id, "status": {"$in": ["IN_PROGRESS", "COMPLETED", "PAID"]}}).sort("accepted_at", -1))
        else:
            all_reports = get_all_reports_from_files()
            jobs = [r for r in all_reports if r.get("contractor_id") == contractor_id and r.get("status") in ["IN_PROGRESS", "COMPLETED", "PAID"]]
            # Sort by accepted_at descending
            jobs = sorted(jobs, key=lambda x: x.get("accepted_at", datetime.min), reverse=True)
        
        result = []
        for job in jobs:
            result.append({
                "id": str(job["_id"]),
                "image_path": job.get("image_path", ""),
                "latitude": job["latitude"],
                "longitude": job["longitude"],
                "severity": job["severity"],
                "bounty": job["bounty"],
                "pothole_count": job.get("pothole_count", 1),
                "size_cm": job.get("size_cm", 0),
                "status": job["status"],
                "accepted_at": job.get("accepted_at").isoformat() if job.get("accepted_at") and hasattr(job.get("accepted_at"), 'isoformat') else str(job.get("accepted_at")) if job.get("accepted_at") else None,
                "completed_at": job.get("completed_at").isoformat() if job.get("completed_at") and hasattr(job.get("completed_at"), 'isoformat') else str(job.get("completed_at")) if job.get("completed_at") else None
            })
        
        return {"jobs": result}
        
    except Exception as e:
        print(f"[DEBUG] Error in get_contractor_jobs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/uploads/{file_path:path}")
async def serve_upload(file_path: str):
    """Serve uploaded images with CORS headers"""
    file_location = f"uploads/{file_path}"
    print(f"[v0] Serving file: {file_location}")
    print(f"[v0] File exists: {os.path.exists(file_location)}")
    
    if not os.path.exists(file_location):
        print(f"[v0] File NOT found at: {file_location}")
        raise HTTPException(status_code=404, detail=f"File not found: {file_location}")
    
    # Determine media type based on file extension
    if file_location.endswith('.png'):
        media_type = "image/png"
    elif file_location.endswith('.jpg') or file_location.endswith('.jpeg'):
        media_type = "image/jpeg"
    else:
        media_type = "application/octet-stream"
    
    print(f"[v0] Serving as {media_type}")
    return FileResponse(file_location, media_type=media_type)

@app.post("/api/payment/generate-qr")
async def generate_payment_qr(request: PaymentRequest):
    """Generate UPI QR code for payment"""
    try:
        print(f"[v0] QR Generation called: amount={request.amount}, job_id={request.job_id}, desc={request.description}")
        
        # Create UPI string
        upi_string = f"upi://pay?pa=contractor@paytm&pn=Contractor&am={request.amount/100}&cu=INR&tn={request.description}"
        print(f"[v0] UPI String created: {upi_string}")
        
        # Generate QR code
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(upi_string)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        print(f"[v0] QR image created")
        
        # Create directory if it doesn't exist
        qr_dir = Path("uploads/qr_codes")
        qr_dir.mkdir(parents=True, exist_ok=True)
        print(f"[v0] QR directory created/exists: {qr_dir}")
        
        # Save QR code
        qr_path = qr_dir / f"payment_{request.job_id}.png"
        img.save(qr_path)
        print(f"[v0] QR code saved to: {qr_path}")
        print(f"[v0] File exists: {qr_path.exists()}")
        print(f"[v0] File size: {qr_path.stat().st_size if qr_path.exists() else 'N/A'}")
        
        # Return response
        qr_url = f"/uploads/qr_codes/payment_{request.job_id}.png"
        print(f"[v0] Returning QR URL: {qr_url}")
        
        return {
            "qr_code_url": qr_url,
            "status": "created",
            "message": "QR code generated successfully"
        }
        
    except Exception as e:
        print(f"[v0] ERROR generating QR: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))



@app.get("/api/contractor/job/{job_id}")
async def get_contractor_job(job_id: str):
    """Get job details for payment page"""
    try:
        print(f"[v0] Fetching job details for: {job_id}")
        
        if MONGO_ENABLED and reports_collection is not None:
            report = reports_collection.find_one({"_id": ObjectId(job_id)})
        else:
            report = load_report_from_file(job_id)
        
        if not report:
            print(f"[v0] Job not found: {job_id}")
            raise HTTPException(status_code=404, detail="Job not found")
        
        print(f"[v0] Job found: {report.get('status')}")
        
        return {
            "id": str(report["_id"]),
            "bounty": report.get("bounty", 0),
            "status": report.get("status", "OPEN"),
            "latitude": report.get("latitude", 0),
            "longitude": report.get("longitude", 0),
            "severity": report.get("severity", "UNKNOWN"),
            "completed_at": report.get("completed_at", "").isoformat() if report.get("completed_at") and hasattr(report.get("completed_at"), 'isoformat') else str(report.get("completed_at")) if report.get("completed_at") else None
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[v0] Error fetching job: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/payment/mark-paid/{job_id}")
async def mark_job_paid(job_id: str):
    """Mark job as paid (admin/testing)"""
    try:
        if MONGO_ENABLED and reports_collection is not None:
            result = reports_collection.update_one(
                {"_id": ObjectId(job_id)},
                {"$set": {"status": "PAID", "paid_at": datetime.now()}}
            )
            if result.modified_count == 0:
                raise HTTPException(status_code=404, detail="Job not found")
        else:
            report = load_report_from_file(job_id)
            if not report:
                raise HTTPException(status_code=404, detail="Job not found")
            report["status"] = "PAID"
            report["paid_at"] = datetime.now()
            save_report_to_file(job_id, report)
        
        return {"status": "success", "message": "Job marked as paid"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[DEBUG] Error in mark_job_paid: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
