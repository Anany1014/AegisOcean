# 🌊 AegisOcean — AI-Powered Maritime Forensics & Smart Contract Fine Ledger

[![SIH-2026](https://img.shields.io/badge/SIH--2026-Demo--Ready-brightgreen?style=for-the-badge)](https://github.com/Anany1014/AegisOcean)
[![License-MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Frontend-React](https://img.shields.io/badge/Frontend-React%20%7C%20TypeScript%20%7C%20Vite-blue?logo=react&logoColor=61DAFB&style=flat-square)](https://react.dev/)
[![Styling-Tailwind](https://img.shields.io/badge/Styling-Tailwind%20CSS-38B2AC?logo=tailwindcss&logoColor=white&style=flat-square)](https://tailwindcss.com/)
[![Mapping-MapLibre](https://img.shields.io/badge/Mapping-MapLibre%20%26%20deck.gl-FF6600?logo=maplibre&logoColor=white&style=flat-square)](https://maplibre.org/)
[![Blockchain-Polygon](https://img.shields.io/badge/Blockchain-Solidity%20%7C%20Polygon-8247E5?logo=solidity&logoColor=white&style=flat-square)](https://polygon.technology/)
[![Smart Contracts-Hardhat](https://img.shields.io/badge/Contracts-Hardhat-FFC20E?logo=hardhat&logoColor=black&style=flat-square)](https://hardhat.org/)
[![ML Engine-PyTorch](https://img.shields.io/badge/ML%20Engine-PyTorch-EE4C2C?logo=pytorch&logoColor=white&style=flat-square)](https://pytorch.org/)
[![Server-FastAPI](https://img.shields.io/badge/Server-FastAPI%20%7C%20Express-009688?logo=fastapi&logoColor=white&style=flat-square)](https://fastapi.tiangolo.com/)

> **Autonomous Satellite SAR Oil Spill Detection, Hydrodynamic Backward Hindcasting, AIS Culprit Attribution, and Smart-Contract Legal Enforcement System.**

AegisOcean is an end-to-end maritime forensics and intelligence platform designed to automate the detection, tracking, culprit attribution, and legal enforcement of offshore oil discharges (deliberate maritime bilge washing and tanker spills).

---

## 📸 System Overview & Architecture

```mermaid
graph TD
    classDef datasource fill:#1e293b,stroke:#3b82f6,stroke-width:2px,color:#fff;
    classDef engine fill:#0f172a,stroke:#10b981,stroke-width:2px,color:#fff;
    classDef ledger fill:#1e1b4b,stroke:#8b5cf6,stroke-width:2px,color:#fff;
    classDef ui fill:#312e81,stroke:#6366f1,stroke-width:2px,color:#fff;

    SAR["📡 Sentinel-1 SAR GRD Radar"]
    MetOcean["🌊 Copernicus & ERA5 Ocean Currents & Wind"]
    AIS["🛳️ MarineCadastre Real-Time AIS Stream"]

    subgraph MLEngine["🧠 Remote Sensing & Segmentation Core"]
        Seg["SegFormer-B3 / ResNet34-UNet"]
        GLCM["Calm Sea Look-alike Filter (GLCM & Wind)"]
    end

    subgraph HydroEngine["🌀 Hydrodynamic Drift Engine"]
        Lagrangian["Backward Lagrangian Drift Hindcasting"]
        Forecast["Forward Trajectory Forecasting (48h)"]
    end

    subgraph AISEngine["🕵️ AIS Attribution & Anomaly Core"]
        RTree["Spatio-Temporal R-Tree Indexing"]
        DeadReckon["Bi-LSTM AIS Dead-Reckoning"]
        Attribution["Polluter Attribution Score (PAS) Engine"]
    end

    subgraph Web3["🔒 Immutable Legal & Compliance Layer"]
        IPFS["📦 IPFS Evidence Dossier Storage (Pinata)"]
        SmartContract["📜 MaritimeFineLedger.sol (Polygon Amoy)"]
    end

    subgraph Client["🖥️ Unified GIS Command Dashboard"]
        MapLibre["🗺️ MapLibre GL UI + deck.gl Overlay"]
        TimeSlider["⏱️ Forensic Playback & Track Matcher"]
        Dossier["📄 Cryptographic Dossier & PDF Export"]
    end

    SAR --> Seg
    Seg --> GLCM
    GLCM -->|Slick Geometry| Lagrangian

    MetOcean --> Lagrangian
    MetOcean --> Forecast

    Lagrangian -->|Spill Origin (T₀, X₀, Y₀)| Attribution
    Forecast -->|Response Fleet Vectors| Client

    AIS --> RTree
    RTree --> DeadReckon
    DeadReckon --> Attribution

    Attribution -->|Attributed Polluter Dossier| IPFS
    IPFS -->|IPFS CID| SmartContract
    SmartContract -->|On-Chain Audit Trail| Client
    MapLibre --> Client
    TimeSlider --> Client
    Dossier --> Client

    class SAR,MetOcean,AIS datasource;
    class Seg,GLCM,Lagrangian,Forecast,RTree,DeadReckon,Attribution engine;
    class IPFS,SmartContract ledger;
    class MapLibre,TimeSlider,Dossier ui;
```

---

## 📌 Executive Summary & Key Innovations

Over **70% of marine oil discharges** go unpenalized globally due to three critical gaps:
1. **Shifting Baselines:** Ocean currents and wind drift slicks away from their origin point before coast guards arrive.
2. **"Dark" Vessels:** Polluting ship operators disable transponders during illegal bilge washings.
3. **Vulnerable Chain of Custody:** Evidence logs are easily contested in international maritime courts without immutable audit trails.

### The AegisOcean 4-Phase Lifecycle Solution

1. **📡 Phase 1 — Detect & Segment:** Ingests Sentinel-1 C-band Synthetic Aperture Radar (SAR) imagery, applies Refined-Lee speckle filtering, and segments slick boundaries using a SegFormer-B3 neural network while filtering false positives via Gray-Level Co-occurrence Matrix (GLCM) texture metrics.
2. **🌀 Phase 2 — Reverse Hindcasting:** Runs reverse Lagrangian particle transport with ERA5 winds and Copernicus current vectors to calculate the exact spill origin time ($T_0$) and coordinates ($X_0, Y_0$).
3. **🕵️ Phase 3 — AIS Culprit Attribution:** Performs spatio-temporal queries around $[T_0, (X_0, Y_0)]$, applies Bi-LSTM dead-reckoning for vessels with dark transponder gaps, and ranks candidates using a **Polluter Attribution Score (PAS)**.
4. **🔒 Phase 4 — On-Chain Fine Enforcement:** Packages evidence (GeoJSON outlines, AIS tracks, SAR imagery, PAS breakdown), computes SHA-256 hashes, pins to IPFS, and anchors fine assessments on the **Polygon Amoy Testnet** (`MaritimeFineLedger.sol`).

---

## 🗂️ Project Directory Structure

```
SIH/
├── Frontend/                 # React 19 + TypeScript + Vite + MapLibre GIS Dashboard
│   ├── src/
│   │   ├── app/              # Router shell & providers
│   │   ├── features/         # GIS Map, Triage, Suspect Analysis, Dossier Export
│   │   ├── stores/           # Zustand client UI state (theme, drift playback)
│   │   └── lib/              # API clients (ML, Backend, IPFS)
│   └── package.json
├── backend/                  # Node.js + Express + TypeScript Gateway Service
│   ├── src/
│   │   ├── config/           # Environment, Zod schema validation, Polygon RPC
│   │   ├── routes/           # REST endpoints (Incidents, ML Proxy, Verification)
│   │   ├── services/         # Incident management, IPFS Pinata, Blockchain sync
│   │   └── index.ts          # Express entrypoint (Port 4000)
│   └── package.json
├── ml/                       # Python Machine Learning & Remote Sensing Engine
│   ├── serve.py              # FastAPI inference server & physics fallback (Port 8001)
│   ├── config.yaml           # Neural classifier & LSTM hyperparameters
│   ├── notebooks/            # Jupyter training & evaluation notebooks
│   └── requirements_ml.txt   # Python ML dependencies
├── AegisOcean-repo/          # Sub-repository for Web3 smart contracts
│   └── blockchain/           # Hardhat node, Solidity contracts, and deployment scripts
│       ├── contracts/        # MaritimeFineLedger.sol smart contract
│       └── server.js         # Blockchain Express gateway
├── start.sh                  # One-touch launch bash script
├── package.json              # Root workspace launcher (Concurrently runner)
└── README.md                 # System documentation
```

---

## ⚡ Quick Start & One-Command Launch

### Prerequisites
- **Node.js**: `v18.x` or later
- **npm**: `v9.x` or later
- **Python**: `3.10.x` or later

---

### Option A: One-Command Workspace Launch (Recommended)

1. **Install Root & Subproject Dependencies:**
   ```bash
   npm run install:all
   ```

2. **Launch Standard Stack (ML + Backend + Frontend):**
   ```bash
   npm run dev
   ```
   *This starts the ML inference server on port **8001**, the Express backend on port **4000**, and the React Vite dashboard on port **5173** concurrently.*

3. **Access the Dashboard:**
   Open **[http://localhost:5173/](http://localhost:5173/)** in your web browser.

---

### Option B: Full Stack with Local Hardhat Blockchain

```bash
# Starts Hardhat Node (8545) + ML (8001) + Backend (4000) + Frontend (5173)
npm run dev:all
```

---

### Option C: Manual Service-by-Service Launch

#### 1. Machine Learning Inference Server (Port 8001)
```bash
# Install Python dependencies (optional for deep learning GPU mode)
pip install -r ml/requirements_ml.txt

# Start FastAPI server
python ml/serve.py
```

#### 2. Express Backend API Gateway (Port 4000)
```bash
cd backend
npm install
npm run dev
```

#### 3. React GIS Dashboard Frontend (Port 5173)
```bash
cd Frontend
npm install
npm run dev
```

---

## 📡 Service API Reference

### 🧠 ML Inference Server (`http://localhost:8001`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/ml/health` | Returns server health and loaded PyTorch checkpoint status |
| `POST` | `/ml/sar-classify` | Classifies SAR chip image or physical metadata into Bonn Agreement slick classes |
| `POST` | `/ml/ais-predict` | Predicts future vessel positions using Bi-LSTM / Dead-Reckoning |
| `POST` | `/ml/ais-suspects` | Scores candidate vessels with multi-factor Polluter Attribution Score (PAS) |

---

### 🌐 Express Backend API (`http://localhost:4000/api`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/incidents` | Retrieves all recorded oil spill forensic incidents |
| `POST` | `/api/incidents` | Creates a new oil spill incident record |
| `GET` | `/api/ml/health` | Backend proxy health status check for ML server |
| `POST` | `/api/ml/analyze-and-anchor` | Orchestrates full pipeline: ML classify → AIS suspects → IPFS anchor → Polygon smart contract |

---

## 🔒 Smart Contract & Verification (`MaritimeFineLedger.sol`)

The smart contract deployed on Polygon Amoy calculates statutory fines automatically using MARPOL Annex I scales:

$$\text{Fine (USD)} = \text{Base Fine} + (\text{Spill Area in km}^2 \times \text{Multiplier})$$

- Stores IPFS CIDs containing immutable evidence packages.
- Emits `PortClearanceRevoked` events to flag non-compliant polluters across port registries.
- Supports cryptographic SHA-256 validation directly inside the web UI.

---

## ⚙️ Environment Variables Configuration

Create a `.env` file in `backend/` or set environment variables in your environment:

```env
PORT=4000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
RPC_URL=https://rpc-amoy.polygon.technology
CHAIN_ID=80002
CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
ML_SERVER_URL=http://localhost:8001
PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET_KEY=your_pinata_secret_key
```

---

## 🛡️ License

This project is open-source software licensed under the **[MIT License](LICENSE)**.

Developed for **Smart India Hackathon (SIH) 2026** by team AegisOcean.
