import os
import io
import base64
import os.path
from pathlib import Path
from datetime import datetime
from typing import Optional, List
import numpy as np
import cv2
from PIL import Image
from io import BytesIO
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
import google.generativeai as genai

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

gemini_key = os.getenv("GEMINI_API_KEY")
if gemini_key:
    genai.configure(api_key=gemini_key)
    print("✓ Gemini API configured")
else:
    print("⚠ Warning: GEMINI_API_KEY not found in .env, AI verification will be skipped.")

# ==========================================

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
MONGO_URL = os.getenv("MONGO_DB_URL", "mongodb://localhost:27017/pothole_db")
import certifi

# Only use TLS CA file for Atlas (mongodb+srv) connections
_mongo_kwargs = {"serverSelectionTimeoutMS": 5000}
if MONGO_URL.startswith("mongodb+srv"):
    _mongo_kwargs["tlsCAFile"] = certifi.where()

try:
    client = MongoClient(MONGO_URL, **_mongo_kwargs)
    # Test connection
    client.server_info()
    db = client.get_database()
    reports_collection = db.reports
    print(f"✓ MongoDB connected successfully")
except Exception as e:
    print(f"❌ MongoDB connection failed: {e}")
    print(f"   Attempted URL: {MONGO_URL}")
    client = MongoClient(MONGO_URL, **_mongo_kwargs)
    db = client.get_database()
    reports_collection = db.reports

# Model paths
POTHOLE_MODEL_PATH = os.getenv("POTHOLE_MODEL_PATH", "models/pothole/best.pt")
MANHOLE_MODEL_PATH = os.getenv("MANHOLE_MODEL_PATH", "models/manhole/manhole_best.pt")

# Detection configuration
POTHOLE_CONF_THRESHOLD = float(os.getenv("POTHOLE_CONF_THRESHOLD", "0.25"))
IOU_THRESHOLD = float(os.getenv("IOU_THRESHOLD", "0.1"))
LOCATION_VERIFICATION_RADIUS = float(os.getenv("LOCATION_VERIFICATION_RADIUS", "15"))

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
    """Detect potholes using YOLO models, filter out manholes"""
    try:
        image_pil = Image.open(BytesIO(image_bytes)).convert('RGB')
        image = cv2.cvtColor(np.array(image_pil), cv2.COLOR_RGB2BGR)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise ValueError(f"Invalid image: {str(e)}")
    
    pothole_results = pothole_detector(image, conf=0.25)[0]
    reference_results = reference_detector(image, conf=0.25)[0]
    
    potholes = pothole_results.boxes
    references = reference_results.boxes
    
    print(f"[DEBUG] Pothole model detected {len(potholes)} objects")
    print(f"[DEBUG] Pothole model classes: {pothole_results.names}")
    for i, p in enumerate(potholes):
        print(f"[DEBUG] Pothole {i}: class={p.cls}, conf={p.conf}, name={pothole_results.names[int(p.cls[0])]}")
    print(f"[DEBUG] Reference model detected {len(references)} objects")
    
    valid_potholes = []
    
    # If pothole model found nothing, check if reference model found anything
    # Sometimes the model detects potholes but classifies them differently
    if len(potholes) == 0 and len(references) > 0:
        print("[DEBUG] Pothole model found nothing, using reference detections as potholes")
        valid_potholes = list(references)
    else:
        for p in potholes:
            p_conf = float(p.conf[0])
            if p_conf < POTHOLE_CONF_THRESHOLD:
                continue
            
            p_box = p.xyxy[0].cpu().numpy()
            overlap = False
            
            for r in references:
                r_box = r.xyxy[0].cpu().numpy()
                r_conf = float(r.conf[0])
                if iou(p_box, r_box) > IOU_THRESHOLD:
                    if r_conf > p_conf:
                        overlap = True
                        break
            
            if not overlap:
                valid_potholes.append(p)
    
    if not valid_potholes:
        return {"pothole_count": 0, "severity": "NONE", "confidence": 0.0, "bounty": 0, "size_cm": 0.0}
    
    scale = None
    if len(references) > 0:
        ref_box = references[0].xyxy[0].cpu().numpy()
        ref_px = ref_box[2] - ref_box[0]
        scale = REFERENCE_SIZES_CM["Manhole Cover"] / ref_px
    
    largest = max(valid_potholes, key=lambda p: float(p.conf[0]))
    box = largest.xyxy[0].cpu().numpy()
    width_px = box[2] - box[0]
    confidence = float(largest.conf[0])
    
    if scale:
        size_cm = width_px * scale
        if size_cm < 20:
            severity = "LOW"
            road_type = "LOW"
        elif size_cm < 40:
            severity = "MEDIUM"
            road_type = "CITY"
        else:
            severity = "HIGH"
            road_type = "HIGHWAY"
        
        traffic = TRAFFIC_WEIGHT[road_type]
        bounty = int(BASE_REPAIR_COST + (size_cm * SIZE_COST_PER_CM * traffic))
    else:
        size_cm = 0.0
        severity = "MEDIUM"
        bounty = BASE_REPAIR_COST
    
    return {"pothole_count": len(valid_potholes), "severity": severity, "confidence": round(confidence, 2), "bounty": bounty, "size_cm": round(size_cm, 1) if scale else 0.0}

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
            return False, "YOLO Detection failed: Pothole is still visible in the completion photo."
    
    # 2. Gemini Verification 
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key:
        try:
            pil_img = Image.open(io.BytesIO(image_bytes))
            model = genai.GenerativeModel('gemini-2.5-flash-lite')
            prompt = "Look at this image. Is it a photo of a freshly filled, patched, or repaired pothole on an asphalt/concrete road? Reply with exactly 'YES' or 'NO' and nothing else."
            response = model.generate_content([prompt, pil_img])
            answer = response.text.strip().upper()
            if "YES" not in answer:
                return False, f"AI Verification failed: The image does not look like a patched or repaired pothole. AI thought it was: {answer}"
        except Exception as e:
            print(f"[DEBUG] Gemini verification error: {e}")
            pass # Fallback to true if API fails so we don't block
    return True, "Job completed and verified successfully"

def generate_upi_qr(amount: int, report_id: str) -> str:
    """Generate UPI QR code and return as base64 string"""
    upi_string = f"upi://pay?pa={MUNICIPAL_UPI_ID}&pn=Municipal Corporation&am={amount}&cu=INR&tn=Pothole Repair Payment ID:{report_id}"
    
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(upi_string)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    img_base64 = base64.b64encode(buffer.read()).decode()
    
    return img_base64

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two coordinates in meters"""
    return geodesic((lat1, lon1), (lat2, lon2)).meters

# =============== API ENDPOINTS ===============

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "models_loaded": pothole_detector is not None and reference_detector is not None}

@app.post("/api/report")
async def create_report(image: UploadFile = File(...), latitude: float = Form(...), longitude: float = Form(...)):
    """Create a new pothole report"""
    try:
        image_bytes = await image.read()
        print(f"[DEBUG] Image received: {len(image_bytes)} bytes")
        detection_result = detect_potholes(image_bytes)
        print(f"[DEBUG] Detection result: {detection_result}")
        
        if detection_result["pothole_count"] == 0:
            print("[DEBUG] No potholes detected - returning 400 error")
            raise HTTPException(status_code=400, detail="No pothole detected in image")
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        image_filename = f"pothole_{timestamp}.jpg"
        image_path = f"uploads/{image_filename}"
        
        Path("uploads").mkdir(exist_ok=True)
        with open(image_path, "wb") as f:
            f.write(image_bytes)
        
        report = {
            "image_path": image_path,
            "latitude": float(latitude),
            "longitude": float(longitude),
            "severity": str(detection_result["severity"]),
            "confidence": float(detection_result["confidence"]),
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
        
        result = reports_collection.insert_one(report)
        
        return {"success": True, "report_id": str(result.inserted_id), "message": "Pothole report created successfully", "details": {"severity": detection_result["severity"], "bounty": detection_result["bounty"], "pothole_count": detection_result["pothole_count"], "confidence": detection_result.get("confidence", 0), "size_cm": detection_result.get("size_cm", 0)}}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/reports/all")
async def get_all_reports():
    """Get all pothole reports"""
    try:
        reports = list(reports_collection.find().sort("created_at", -1))
        
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
            result.append(report_data)
        
        return JSONResponse(content=jsonable_encoder({"reports": result}))
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/reports/open")
async def get_open_reports(contractor_lat: float = None, contractor_lon: float = None):
    """Get all open pothole reports"""
    try:
        reports = list(reports_collection.find({"status": "OPEN"}))
        
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
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/report/{report_id}/accept")
async def accept_job(report_id: str, job_accept: JobAccept):
    """Contractor accepts a job"""
    try:
        result = reports_collection.update_one({"_id": ObjectId(report_id), "status": "OPEN"}, {"$set": {"status": "IN_PROGRESS", "contractor_id": job_accept.contractor_id, "accepted_at": datetime.now()}})
        if result.modified_count == 0:
            raise HTTPException(status_code=400, detail="Job already taken or not found")
        return {"success": True, "message": "Job accepted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/report/{report_id}/reject")
async def reject_job(report_id: str):
    """Contractor rejects a job"""
    try:
        result = reports_collection.update_one({"_id": ObjectId(report_id), "status": "IN_PROGRESS"}, {"$set": {"status": "OPEN", "contractor_id": None, "accepted_at": None}})
        if result.modified_count == 0:
            raise HTTPException(status_code=400, detail="Job not found or not in progress")
        return {"success": True, "message": "Job rejected successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/report/{report_id}/complete")
async def complete_job(report_id: str, image: UploadFile = File(...), latitude: float = Form(...), longitude: float = Form(...), contractor_id: str = Form(...)):
    """Contractor completes a job with verification"""
    try:
        report = reports_collection.find_one({"_id": ObjectId(report_id), "contractor_id": contractor_id, "status": "IN_PROGRESS"})
        if not report:
            raise HTTPException(status_code=404, detail="Report not found or not assigned to you")
        
        distance = calculate_distance(report["latitude"], report["longitude"], latitude, longitude)
        if distance > LOCATION_VERIFICATION_RADIUS:
            raise HTTPException(status_code=400, detail=f"Location verification failed. You are {round(distance, 1)}m away from the pothole location. Must be within {LOCATION_VERIFICATION_RADIUS}m.")
        
        image_bytes = await image.read()
        is_repaired, error_msg = verify_no_pothole(image_bytes)
        
        if not is_repaired:
            raise HTTPException(status_code=400, detail=error_msg)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        completion_filename = f"completed_{timestamp}.jpg"
        completion_path = f"uploads/{completion_filename}"
        
        with open(completion_path, "wb") as f:
            f.write(image_bytes)
        
        reports_collection.update_one({"_id": ObjectId(report_id)}, {"$set": {"status": "COMPLETED", "completed_at": datetime.now(), "completion_image_path": completion_path, "completion_latitude": latitude, "completion_longitude": longitude}})
        
        return {"success": True, "message": "Job completed and verified successfully", "bounty": report["bounty"]}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/report/{report_id}/payment")
async def get_payment_qr(report_id: str):
    """Generate UPI QR code for payment"""
    try:
        try:
            report = reports_collection.find_one({"_id": ObjectId(report_id)})
        except:
            report = reports_collection.find_one({"_id": report_id})
        
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        
        status = report.get("status")
        if status not in ["COMPLETED", "PAID"]:
            raise HTTPException(status_code=400, detail=f"Report status is {status}. Payment only available for completed jobs.")
        
        bounty = report.get("bounty", 0)
        qr_base64 = generate_upi_qr(bounty, report_id)
        
        if status == "COMPLETED":
            try:
                reports_collection.update_one({"_id": ObjectId(report_id)}, {"$set": {"status": "PAID", "paid_at": datetime.now()}})
            except:
                reports_collection.update_one({"_id": report_id}, {"$set": {"status": "PAID", "paid_at": datetime.now()}})
        
        return JSONResponse(content=jsonable_encoder({"success": True, "qr_code": qr_base64, "amount": bounty, "upi_id": MUNICIPAL_UPI_ID}))
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/contractor/{contractor_id}/jobs")
async def get_contractor_jobs(contractor_id: str):
    """Get all jobs for a specific contractor"""
    try:
        jobs = list(reports_collection.find({"contractor_id": contractor_id, "status": {"$in": ["IN_PROGRESS", "COMPLETED", "PAID"]}}).sort("accepted_at", -1))
        
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
                "accepted_at": job.get("accepted_at").isoformat() if job.get("accepted_at") else None,
                "completed_at": job.get("completed_at").isoformat() if job.get("completed_at") else None
            })
        
        return {"jobs": result}
        
    except Exception as e:
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
        report = reports_collection.find_one({"_id": ObjectId(job_id)})
        
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
            "pothole_count": report.get("pothole_count", 1),
            "completed_at": report.get("completed_at", "").isoformat() if report.get("completed_at") else None
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
        result = reports_collection.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {"status": "PAID", "paid_at": datetime.now()}}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Job not found")
        return {"status": "success", "message": "Job marked as paid"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/payment/status/{job_id}")
async def get_payment_status(job_id: str):
    """Check the payment status of a job"""
    try:
        report = reports_collection.find_one({"_id": ObjectId(job_id)})
        if not report:
            raise HTTPException(status_code=404, detail="Job not found")
        
        status = report.get("status", "OPEN")
        return {
            "status": status,
            "paid": status == "PAID",
            "paid_at": report.get("paid_at", "").isoformat() if report.get("paid_at") else None,
            "bounty": report.get("bounty", 0)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
