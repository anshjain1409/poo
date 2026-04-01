# Municipal Pothole Detection & Repair Platform

A complete end-to-end AI-powered system for pothole detection, reporting, and repair management. This platform uses custom-trained YOLO models for pothole detection and provides separate portals for citizens and contractors.

## Features

### User Portal (Citizens)
- Report potholes with GPS location
- Upload pothole images for AI analysis
- Automatic severity assessment
- Real-time detection results
- Professional, accessible UI

### Contractor Portal
- View available pothole repair jobs
- Distance-based job sorting
- Accept and manage jobs
- Location-verified job completion
- AI-verified repair confirmation
- UPI-based instant payments

### AI Detection System
- YOLO-based pothole detection
- Manhole detection to filter false positives
- Size estimation using reference objects
- Severity classification (LOW/MEDIUM/HIGH)
- Confidence scoring
- Bounty calculation based on size and traffic

### Fraud Prevention
- GPS location verification (15m radius)
- AI verification of completed repairs
- Must be physically present at location
- Automated verification workflow

## Tech Stack

### Frontend
- **Next.js 16** (App Router)
- **TypeScript**
- **Tailwind CSS v4**
- **shadcn/ui** components
- Modern, accessible design

### Backend
- **FastAPI** (Python)
- **MongoDB** (Database)
- **Ultralytics YOLO** (AI Detection)
- **OpenCV** (Image Processing)
- **QRCode** (UPI Payment)
- **Geopy** (Distance Calculation)

## Project Structure

```
/
├── app/
│   ├── page.tsx                          # User Portal (Citizen Reporting)
│   ├── contractor/
│   │   ├── page.tsx                      # Contractor Login
│   │   ├── dashboard/page.tsx            # Contractor Dashboard
│   │   ├── job/[id]/page.tsx            # Job Completion
│   │   └── payment/[id]/page.tsx        # Payment QR Code
│   ├── layout.tsx                        # Root Layout
│   └── globals.css                       # Global Styles
├── backend/
│   ├── endpoint.py                       # FastAPI Application
│   ├── requirements.txt                  # Python Dependencies
│   └── README.md                         # Backend Documentation
├── components/ui/                        # shadcn/ui Components
└── .env.example                          # Environment Variables Template
```

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm/yarn
- Python 3.9+
- MongoDB
- Trained YOLO models (pothole + manhole detection)

### Frontend Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
# Create .env.local file
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

3. Run development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. Configure environment variables (copy from root `.env.example`):
```bash
MONGO_DB_URL=mongodb://localhost:27017/pothole_detection
POTHOLE_MODEL_PATH=/dev/pothole/models/pothole/best.pt
MANHOLE_MODEL_PATH=/dev/pothole/models/manhole/manhole_best.pt
LOCATION_VERIFICATION_RADIUS=15
MUNICIPAL_UPI_ID=municipal@upi
BASE_REPAIR_COST=500
SIZE_COST_PER_CM=50
```

4. Start MongoDB:
```bash
# Using Docker:
docker run -d -p 27017:27017 --name mongodb mongo:latest

# Or use your local MongoDB installation
```

5. Run FastAPI server:
```bash
python endpoint.py
```

The backend will be available at `http://localhost:8000`

API documentation: `http://localhost:8000/docs`

## Model Setup

Place your trained YOLO models at:

```
/dev/pothole/models/
├── pothole/best.pt           # Pothole detection model
└── manhole/manhole_best.pt   # Manhole detection model
```

## User Flows

### Citizen Flow

1. Open User Portal
2. Click "Get Current Location" (browser geolocation)
3. Upload pothole image
4. Submit report
5. View detection results (severity, bounty, pothole count)

### Contractor Flow

1. Login with Contractor ID
2. View available jobs (sorted by distance)
3. Accept a job
4. Navigate to pothole location
5. Complete repair
6. Upload after-repair image
7. System verifies:
   - Location (within 15m)
   - No potholes detected in image
8. Receive UPI payment QR code
9. Scan QR to receive payment

## API Endpoints

### Public Endpoints

- `GET /api/health` - Health check
- `POST /api/report` - Submit pothole report (with image + location)
- `GET /api/reports/open` - Get all open reports

### Contractor Endpoints

- `POST /api/report/{id}/accept` - Accept a job
- `POST /api/report/{id}/reject` - Reject a job  
- `POST /api/report/{id}/complete` - Complete job with verification
- `GET /api/report/{id}/payment` - Get UPI QR code
- `GET /api/contractor/{id}/jobs` - Get contractor's jobs

## Database Schema

MongoDB `reports` collection:

```javascript
{
  "_id": ObjectId,
  "image_path": string,
  "latitude": number,
  "longitude": number,
  "severity": "LOW" | "MEDIUM" | "HIGH",
  "confidence": number,
  "bounty": number,
  "size_cm": number,
  "pothole_count": number,
  "status": "OPEN" | "IN_PROGRESS" | "COMPLETED" | "PAID",
  "contractor_id": string | null,
  "created_at": datetime,
  "accepted_at": datetime | null,
  "completed_at": datetime | null,
  "completion_image_path": string | null,
  "completion_latitude": number | null,
  "completion_longitude": number | null
}
```

## Payment System

The platform uses UPI QR code generation for instant payments:

1. Contractor completes job successfully
2. System generates UPI QR code with:
   - Municipal UPI ID
   - Bounty amount
   - Report ID (for reference)
3. Contractor scans QR with any UPI app
4. Payment processed instantly
5. Job marked as PAID

## Security Features

- GPS-based location verification
- AI-verified repair completion
- No external API dependencies for core detection
- Fraud prevention through distance checks
- Server-side validation

## Design Philosophy

- **Municipal-grade UI**: Professional, trustworthy design
- **Accessibility**: Clear typography, semantic HTML
- **Mobile-first**: Responsive design for all devices
- **Performance**: Optimized image handling
- **User-friendly**: Simple, intuitive workflows

## Development Notes

### Detection Thresholds

- Pothole confidence threshold: 0.4
- IOU threshold for manhole filtering: 0.3
- Location verification radius: 15 meters

### Bounty Calculation

```
bounty = BASE_REPAIR_COST + (size_cm × SIZE_COST_PER_CM × traffic_weight)

Traffic weights:
- LOW: 0.5
- CITY: 1.0
- HIGHWAY: 1.5
```

### Severity Classification

- **LOW**: < 20 cm
- **MEDIUM**: 20-40 cm
- **HIGH**: > 40 cm

## Production Deployment

### Frontend (Vercel)

1. Push code to GitHub
2. Import project in Vercel
3. Set environment variables
4. Deploy

### Backend

1. Deploy to cloud server (AWS, DigitalOcean, etc.)
2. Set up MongoDB (Atlas, self-hosted)
3. Configure reverse proxy (nginx)
4. Set up SSL certificates
5. Configure environment variables
6. Run with production ASGI server (gunicorn + uvicorn)

## Future Enhancements

- Real-time notifications for contractors
- Historical data analytics
- Heatmap visualization
- Contractor ratings system
- Mobile apps (iOS/Android)
- Multi-language support
- Payment history and reports
- Admin dashboard

## License

This is a demonstration project for educational purposes.

## Support

For issues or questions, please refer to the project documentation or contact the development team.

---

**Built with advanced AI detection technology for safer roads.**
