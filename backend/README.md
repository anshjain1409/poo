# Pothole Detection Backend

FastAPI-based backend for pothole detection and repair management.

## Setup

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Set up environment variables (copy `.env.example` to `.env` and configure):
```bash
cp ../.env.example .env
```

3. Ensure MongoDB is running:
```bash
# If using Docker:
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

4. Place your trained YOLO models at:
```
/dev/pothole/models/pothole/best.pt
/dev/pothole/models/manhole/manhole_best.pt
```

## Run

```bash
python endpoint.py
```

Or with uvicorn:
```bash
uvicorn endpoint:app --reload --host 0.0.0.0 --port 8000
```

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Endpoints

- `GET /api/health` - Health check
- `POST /api/report` - Submit pothole report
- `GET /api/reports/open` - Get open reports
- `POST /api/report/{id}/accept` - Accept job
- `POST /api/report/{id}/reject` - Reject job
- `POST /api/report/{id}/complete` - Complete job with verification
- `GET /api/report/{id}/payment` - Get UPI QR code for payment
- `GET /api/contractor/{id}/jobs` - Get contractor jobs
