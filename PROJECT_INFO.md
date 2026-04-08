# 🛣️ Municipal Pothole Detection & Repair Platform

## Project Links

| Resource | Link |
|----------|------|
| **GitHub Repository** | [https://github.com/anshjain1409/poo](https://github.com/anshjain1409/poo) |
| **Live Demo (Vercel)** | [https://poo.vercel.app](https://poo.vercel.app) |

> **Note:** The Vercel link displays the frontend UI only. For the full working application (with AI detection, database, and payment features), the backend must be running locally as described below.

---

## Project Overview

An end-to-end AI-powered platform for pothole detection, reporting, and repair management. The system uses custom-trained **YOLO deep learning models** for pothole detection and provides separate portals for **citizens** and **contractors**.

### Key Features
- **AI-Powered Detection** — Custom YOLO models detect potholes with severity classification (LOW / MEDIUM / HIGH)
- **Citizen Reporting** — Upload pothole images with GPS location for automatic analysis
- **Contractor Dashboard** — View, accept, and manage repair jobs sorted by distance
- **Fraud Prevention** — GPS-based location verification (15m radius) + AI verification of completed repairs
- **Automated Payments** — UPI QR code generation for instant contractor payments
- **Size Estimation** — Uses manhole covers as reference objects for real-world size measurement
- **Bounty Calculation** — Automated repair cost estimation based on pothole size and traffic type

---

## Tech Stack

### Frontend
- **Next.js 16** (App Router) with **TypeScript**
- **Tailwind CSS v4** with **shadcn/ui** component library
- Deployed on **Vercel**

### Backend
- **FastAPI** (Python)
- **MongoDB** (Database)
- **Ultralytics YOLO** (AI Detection — 2 custom models)
- **OpenCV** + **NumPy** (Image Processing)
- **Google Gemini 2.5 Flash Lite** (AI Repair Verification)
- **QRCode** (UPI Payment Generation)
- **Geopy** (GPS Distance Calculation)

---

## How to Run the Project

### Prerequisites

Make sure the following are installed on your machine:

| Software | Version | Download |
|----------|---------|----------|
| **Node.js** | 18 or above | [https://nodejs.org](https://nodejs.org) |
| **Python** | 3.10 or above | [https://python.org](https://python.org) |
| **MongoDB** | 6.0 or above | [https://www.mongodb.com/try/download/community](https://www.mongodb.com/try/download/community) |
| **Git** | Latest | [https://git-scm.com](https://git-scm.com) |

---

### Step 1: Clone the Repository

```bash
git clone https://github.com/anshjain1409/poo.git
cd poo
```

---

### Step 2: Start MongoDB

Open a terminal and run:

```bash
mongod
```

Or start MongoDB via **MongoDB Compass** or your system's service manager.

Verify it's running:
```bash
mongosh --eval "db.adminCommand('ping')"
# Should output: { ok: 1 }
```

---

### Step 3: Setup & Run the Frontend

Open a **new terminal**:

```bash
# Install Node.js dependencies
npm install

# Start the development server
npm run dev
```

✅ Frontend will be available at: **http://localhost:3000**

---

### Step 4: Setup & Run the Backend

Open **another new terminal**:

```bash
# Navigate to the backend folder
cd backend

# Create a Python virtual environment
python -m venv venv

# Activate the virtual environment
source venv/bin/activate          # macOS / Linux
# venv\Scripts\activate           # Windows (Command Prompt)
# venv\Scripts\Activate.ps1       # Windows (PowerShell)

# Install Python dependencies
pip install -r requirements.txt

# Start the FastAPI server
python endpoint.py
```

✅ Backend will be available at: **http://localhost:8000**  
✅ API Documentation (Swagger): **http://localhost:8000/docs**

---

### Step 5: Open the Application

Open your browser and go to: **http://localhost:3000**

You should see the RoadFix homepage with the hero section, "How It Works" pipeline, and feature cards.

---

## User Flows

### 🧑 Citizen Flow (Reporting a Pothole)

1. Click **"Report Now"** on the homepage
2. Upload a photo of the pothole
3. Click **"Capture GPS Location"** to record your location
4. Click **"Submit Report & Get Bounty Details"**
5. The AI analyzes the image and displays:
   - Severity (LOW / MEDIUM / HIGH)
   - Pothole size in cm
   - Repair bounty amount (₹)
   - Detection confidence percentage

### 🔧 Contractor Flow (Repairing a Pothole)

1. Click **"Contractor Portal"** from the navbar
2. View available repair jobs (sorted by distance)
3. Click **"Accept Job"** to take on a job
4. Go to the pothole location and complete the repair
5. Click **"Complete Job"** → Upload an after-repair photo + capture GPS
6. Accept the **Quality Assurance Agreement** (3-year warranty)
7. The system verifies:
   - ✅ You are within 15 meters of the pothole
   - ✅ No potholes remain in the photo (AI + Gemini verification)
8. Receive a **UPI QR code** to collect payment

### 📊 Reports Explorer

- Click **"View All Reports"** to browse all pothole reports
- Filter by **severity**, **status**, or **sort** by latest/largest/bounty
- Click any report to see detailed information

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/report` | Submit a new pothole report (image + GPS) |
| GET | `/api/reports/all` | Get all reports |
| GET | `/api/reports/open` | Get open reports (with optional distance sorting) |
| POST | `/api/report/{id}/accept` | Contractor accepts a job |
| POST | `/api/report/{id}/reject` | Contractor rejects/releases a job |
| POST | `/api/report/{id}/complete` | Complete job with verification |
| GET | `/api/report/{id}/payment` | Generate UPI QR code for payment |
| GET | `/api/contractor/{id}/jobs` | Get contractor's assigned jobs |
| GET | `/api/payment/status/{id}` | Check payment status |
| POST | `/api/payment/mark-paid/{id}` | Mark a job as paid |

---

## Project Structure

```
Pothole Project/
├── app/                              # Frontend (Next.js Pages)
│   ├── page.tsx                      # Homepage (Citizen Portal)
│   ├── reports/page.tsx              # Reports Explorer
│   ├── contractor/
│   │   ├── page.tsx                  # Contractor Login/Redirect
│   │   ├── dashboard/page.tsx        # Contractor Dashboard
│   │   ├── job/[id]/page.tsx         # Job Completion Page
│   │   └── payment/[jobId]/page.tsx  # Payment QR Page
│   ├── layout.tsx                    # Root Layout
│   └── globals.css                   # Global Styles
├── backend/
│   ├── endpoint.py                   # FastAPI Application (all API endpoints)
│   ├── models/
│   │   ├── pothole/best.pt           # YOLO Pothole Detection Model
│   │   └── manhole/manhole_best.pt   # YOLO Manhole Detection Model
│   ├── requirements.txt              # Python Dependencies
│   ├── .env                          # Environment Variables
│   └── torch_patch.py                # PyTorch 2.6+ Compatibility Patch
├── components/ui/                    # shadcn/ui Components
├── public/                           # Static Assets
├── README.md                         # Project Documentation
└── package.json                      # Node.js Dependencies
```

---

## Database Schema (MongoDB)

**Collection:** `reports`

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Unique report identifier |
| `image_path` | String | Path to uploaded pothole image |
| `latitude` | Number | GPS latitude of the pothole |
| `longitude` | Number | GPS longitude of the pothole |
| `severity` | String | LOW, MEDIUM, or HIGH |
| `confidence` | Number | AI detection confidence (0-1) |
| `bounty` | Number | Repair bounty amount in ₹ |
| `size_cm` | Number | Estimated pothole size in cm |
| `pothole_count` | Number | Number of potholes detected |
| `status` | String | OPEN → IN_PROGRESS → COMPLETED → PAID |
| `contractor_id` | String | Assigned contractor's ID |
| `created_at` | DateTime | Report creation timestamp |
| `accepted_at` | DateTime | Job acceptance timestamp |
| `completed_at` | DateTime | Job completion timestamp |
| `completion_image_path` | String | Path to after-repair image |

---

## Developed By

**Ansh Jain**  
B.Tech Computer Science  
GitHub: [github.com/anshjain1409](https://github.com/anshjain1409)  
LinkedIn: [linkedin.com/in/anshjain2u](https://linkedin.com/in/anshjain2u)
