# 🛡️ Digital Fatigue Manager

> A state-of-the-art intelligent scheduling assistant designed to predict and prevent digital burnout using the **Job Demands-Resources (JD-R)** model and cognitive fatigue calculations.

---

## 📋 Table of Contents
- [Overview](#-overview)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Tech Stack](#-tech-stack)
- [Setup & Run Instructions](#-setup--run-instructions)
- [Algorithmic Models](#-algorithmic-models)

---

## 🚀 Overview

The **Digital Fatigue Manager** is a professional productivity shield that analyzes your weekly professional load and resources to determine your burnout risk. If the calculated risk is elevated, the system's **Ripple Engine** automatically optimizes your daily chronological routine by injecting cognitive recovery blocks and guided physical exercises.

---

## ✨ Key Features

- **Predictive Fatigue Modeling**: Quantifies your professional load, sleep metrics, and resource support into a real-time burnout risk index.
- **Schedule Guard & Pulse**: Displays a chronological calendar planner of work blocks and recovery breaks.
- **Ripple Optimization Engine**: Detects intensive work durations and automatically injects micro-breaks and AI recovery segments.
- **Weekly Horizon Forecasting**: Forecasts your burnout metrics over a 7-day period with intuitive AreaChart visualization.
- **Interactive Guided Breaks**: Features step-by-step breathing, Postural desk stretches, and visual exercises.

---

## 📂 System Architecture

The project has been modularized into highly cohesive, single-responsibility components:

```text
digital-fatigue-manager/
├── frontend/                   # React Presentation Layer
│   ├── src/
│   │   ├── components/
│   │   │   ├── Guardian.jsx          # Risk analysis dashboard & controls
│   │   │   ├── DailyPulse.jsx        # Daily schedule planner & visualizer
│   │   │   ├── WeeklyHorizon.jsx     # Weekly forecast grid & chart
│   │   │   └── BreakOrchestrator.jsx # Guided exercise overlays
│   │   ├── App.jsx             # Main container & state sync
│   │   └── index.css           # Curated UI stylesheet
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
├── main.py                     # Flask entry point
├── auth.py                     # JWT token authentication routes
├── models.py                   # SQLite persistence layer
├── optimize.py                 # Chronological schedule optimization
├── predict.py                  # Burnout risk calculation algorithms
├── breaks.py                   # Intervention & schedule analysis service
├── requirements.txt            # Python dependencies
└── .gitignore
```

---

## 🛠 Tech Stack

- **Frontend**: React 19, Vite, Recharts, Axios, Vanilla CSS
- **Backend**: Python Flask, SQLite, JWT (PyJWT), Flask-Login, Flask-Bcrypt
- **Security**: Stateless JSON Web Tokens, password hashing, and secure header tunnels

---

## ⚙️ Setup & Run Instructions

### 1. Prerequisites
- **Python 3.10+**
- **Node.js 18+**

### 2. Backend Setup
1. Navigate to the root directory and install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Run the main server:
   ```bash
   python main.py
   ```
   *The Flask API will run at `http://localhost:5000`.*

### 3. Frontend Setup
1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
   *The UI will be available at `http://localhost:5173`.*

---

## 🧠 Algorithmic Models

### Job Demands-Resources (JD-R) Risk Calculation
The system evaluates **Demands** (total hours, isolation) against **Resources** (work-life balance, sleep index, mental support) using the formula:
$$\text{Risk Score} = f(\text{Hours}) + \text{Sleep Modifier} + \text{Mental Health Support} + \text{WLB Modifier}$$

### Tiered Break Injection Algorithm
When you calibrate your schedule, the **Ripple Engine** applies a cognitive load calculation:
- **Tier 1 (Micro-Break: 5 min)**: Injected between consecutive work switches to clear short-term memory.
- **Tier 2 (AI Recovery Break: 15 min)**: Triggered after every 90 minutes of continuous intense focus.
- **Tier 3 (Mental Reset: 10 min)**: Triggered after 120 minutes of deep-focus work blocks.
