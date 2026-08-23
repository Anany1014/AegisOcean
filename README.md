# AegisOcean

> **Autonomous Satellite-SAR Oil Spill Detection, Hydrodynamic Hindcasting, AIS Culprit Attribution, and Smart-Contract Fine Enforcement System**

AegisOcean is an end-to-end maritime forensics and intelligence platform designed to automate the detection, tracking, culprit attribution, and legal enforcement of offshore oil discharges (deliberate maritime bilge washing and tanker spills).

---

## 1. Executive Summary & Problem-Solution Fit

### The Problem
Over **70% of marine oil discharges** go unpenalized globally due to three primary challenges:
1. **Shifting Baselines:** Oil slick origin points shift rapidly over time from wind, waves, and ocean currents.
2. **"Dark" Cooperating Vessels:** Polluting ship operators turn off their Automatic Identification System (AIS) transponders during illicit washings.
3. **Weak Chain of Custody:** Evidence package logs are frequently contested in international courts because there is no immutable, tamper-proof audit trail of telemetry data.

### The Solution: The Four-Phase Maritime Forensics Lifecycle
AegisOcean solves these vulnerabilities by integrating four continuous operations:
1. **Detect & Segment:** Isolates oil slicks from Sentinel-1 Synthetic Aperture Radar (SAR) imagery while rejecting look-alike natural calm zones.
2. **Reverse Hindcast:** Executes backward Lagrangian hydrodynamic particle advection to pinpoint the exact time ($T_0$) and location ($X_0, Y_0$) coordinate of the spill.
3. **AIS Correlation:** Matches ship tracks and dead-reckons AIS dropout gaps near the origin coordinate, scoring candidates with a multi-factor **Polluter Attribution Score (PAS)**.
4. **On-Chain Enforcement:** Pins evidence packages directly to IPFS/Filecoin and locks them under a statutory fine and port-clearance hold using smart contracts on Polygon.

---

## 2. End-to-End System Architecture

```
[ Sentinel-1 SAR / EO Data ]       [ Copernicus / ERA5 MetOcean ]        [ MarineCadastre AIS Stream ]
             │                                   │                                    │
             ▼                                   │                                    ▼
┌───────────────────────────┐                     │                     ┌───────────────────────────┐
│ Computer Vision Pipeline  │                     │                     │  Spatio-Temporal AIS Core │
│ • Lee Speckle Filter      │                     │                     │ • R-Tree Spatial Query    │
│ • SegFormer (B3) / UNet   │                     │                     │ • Dark Ship Gap Tracking  │
│ • GLCM Look-alike Filter  │                     │                     └─────────────┬─────────────┘
└─────────────┬─────────────┘                     │                                   │
             │ Slick Polygon & Area              │                                   │
             ▼                                   ▼                                   │
┌───────────────────────────────────────────────────────────┐                         │
│            Hydrodynamic Drift & Hindcasting Engine        │                         │
│  • Backward Lagrangian Particle Tracking (T₀ Hindcast)    │                         │
│  • Forward Spill Trajectory Forecast (24–48h)             │                         │
└─────────────────────────────┬─────────────────────────────┘                         │
                             │ Origin Coordinate & Time Cone                         │
                             ▼                                                       │
┌─────────────────────────────────────────────────────────────────────────────────────┴─┐
│                          Polluter Attribution Engine (PAS)                            │
│  • Trajectory Intersection • Speed Anomaly Detection • Vessel Type Risk Factor         │
└───────────────────────────┬───────────────────────────────────────────────────────────┘
                            │ Top Suspect MMSI + Forensics JSON
                            ▼
┌───────────────────────────────────────────────────────────────────────────────────────┐
│                         Decentralized Forensics & Legal Layer                         │
│  • IPFS / Filecoin: Stores raw GeoTIFFs, AIS logs, and drift vectors (Generates CID)   │
│  • Smart Contract (MaritimeFineLedger): Logs immutable hash, calculates statutory     │
│    MARPOL Annex I fine, and broadcasts Port Clearance Revocation Event                │
└───────────────────────────┬─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────────────────────────────┐
│                        React + MapLibre Command Dashboard                             │
│ • Dual-view SAR overlay & drift animation • Evidence Dossier PDF • On-chain explorer  │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Deep Dive

### A. Machine Learning / Remote Sensing Image Segmentation (ML Track)
- **Data Ingestion:** Automatically consumes Ground Range Detected (GRD) Sentinel-1 C-band SAR radar imagery, calibrated to backscatter intensity ($\sigma^0$).
- **Filtering Noise:** Employs a **Refined-Lee speckle filter** ($7\times7$ window) to suppress speckle noise without losing slick edge boundaries. Masking is applied to land regions using the GSHHG shoreline database.
- **Slick Segmentation:** Processes backscatter grids through a **SegFormer-B3** (or ResNet34-UNet) model to perform pixel-level segmentation on active discharges.
- **Look-alike Discrimination:** Overcomes biological films and calm ocean false alarms by combining Gray-Level Co-occurrence Matrix (**GLCM**) texture features (homogeneity and contrast metrics) with ERA5 weather wind data. Detections are rejected if local historical wind speeds fall below $2\text{ m/s}$ (calm look-alikes) or exceed $12\text{ m/s}$ (slick dispersion).

### B. Hydrodynamic Drift & Hindcasting Engine
- **Physical Dynamics:** Follows Lagrangian advection kinetics:
  $$\vec{U}_{\text{drift}} = \vec{U}_{\text{ocean\_current}} + 0.03 \cdot \vec{U}_{\text{wind}} + \vec{U}_{\text{Stokes}}$$
- **Hindcasting (Reverse Simulation):** Spawns 5,000 inert virtual tracer particles inside the segmented oil slick boundary and simulates negative-time transport utilizing Copernicus current fields and ERA5 wind vectors up to $T_{-72\text{ hours}}$. The geographical point where the particle density is highest identifies the exact spill envelope coordinates $[T_0, (X_0, Y_0)]$.
- **Forecasting (Early Warning):** Projects forward ocean particle flow vector paths for $24\mbox{--}48\text{ h}$ to guide coast guard response fleets.

### C. AIS Vessel Anomaly & Attribution Core
- **R-Tree Indexing:** Queries marine tracking records (AIS) locally in real time across the spatial-temporal envelope window $[T_0 \pm \delta t]$ using R-Trees.
- **Dark Vessel Dead-Reckoning:** Interpolates probable location vectors for vessels whose transponders went dark (blackout anomaly) within range of the spill envelope.
- **Polluter Attribution Score (PAS) Equation:**
  $$\text{PAS}(v) = 0.40 \cdot S_{\text{dist}}(v) + 0.25 \cdot S_{\text{time}}(v) + 0.20 \cdot S_{\text{anomaly}}(v) + 0.15 \cdot S_{\text{type}}(v)$$
  *Where:*
  - $S_{\text{anomaly}}$ computes tracking anomalies (e.g. sharp speed reduction below 3 knots, zig-zag maneuvers, or AIS transmission blackout duration).
  - $S_{\text{type}}$ factors the vessel's registration class risk factor (e.g., crude tankers/chemical carriers receive top risk weight).

### D. Blockchain Compliance & Proof Custody (Web3 Track)
- **Decentralized Storage:** Pins the generated incident dossier container (uncompressed geotiff imagery, segmented outlines in GeoJSON, trajectory vector logs, and PAS audit summaries) to **IPFS** (via Pinata) to establish a permanent Content Identifier (CID).
- **Legislation Ledger Smart Contract:**
  - Written in **Solidity** and deployed on the **Polygon Amoy Testnet** (`MaritimeFineLedger.sol`).
  - Stores incident metadata (`incidentId`, `suspectMMSI`, `ipfsCID`, `spillAreaSqKm`, `attributionScore`).
  - Computes statutory fines directly using MARPOL Annex I scales: $\text{Fine} = \text{Base Fine} + (\text{Slick Area} \times \text{Multiplier})$.
  - Triggers the `PortClearanceRevoked` event, communicating dynamic clearance holds to port authority registries.

### E. Unified GIS Control Command Center
- **GIS Layout Engine:** Combines React with MapLibre GL and deck.gl, configured with a comprehensive, thumbnail-driven Esri basemap gallery (World Ocean, Topographic, and Dark Canvas).
- **Forensic Time-Slider:** Interactive path matching allowing engineers to scroll backward in time to align drifting particle clouds with candidate AIS tracks.
- **Cryptographic Evidence Verification:** Incorporates a one-click validation button calling the server API to compute and match the SHA-256 hash of the IPFS dataset against the on-chain Polygon anchor byte-for-byte.

---

## 4. Zero-Cost Technology Stack

| Layer | System Component | Free / Open-Source Resource |
| :--- | :--- | :--- |
| **ML Engine** | PyTorch, segmentation_models_pytorch | Google Colab / Kaggle Free T4 GPUs |
| **Datasets** | Zenodo SAR Imagery + NOAA MarineCadastre AIS | Public Open-access archives |
| **MetOcean APIs** | Copernicus Marine Service, Open-Meteo | Free scientific & API research tiers |
| **Backend / Spatial** | FASTAPI, GeoPandas, Shapely, SQLite | Local runtime / Render Free Tier |
| **Decentralized Store** | IPFS via Pinata Gateway API | Free tier (1GB storage cap) |
| **Smart Contract** | Solidity, Ethers.js, Polygon Amoy Network | Free testnet faucet nodes |
| **Frontend Map** | React, Vite, MapLibre GL / deck.gl | OpenStreetMap / Esri Tile servers |

---

## 🚀 Setting Up & Running Locally

### 1. Ingest Blockchain Backend
Open a terminal shell, navigate to the blockchain gateway service directory, install dependencies, and start the node service:

```bash
cd AegisOcean-repo/blockchain
npm install
npm start
```
*The signing and verification API server starts up on port `4000` (`http://localhost:4000`).*

### 2. Ingest Frontend Dashboard
Navigate to the frontend React workspace, install package dependencies, and run the development compiler:

```bash
cd Frontend
npm install
npm run dev
```
*Open `http://localhost:5173/` in your browser to view the AegisOcean Command Center.*

---

## ⚖️ Smart India Hackathon (SIH) Live Demo Script

1. **Step 1 (Ingest & Segment):** Load a pre-cached Sentinel-1 SAR scene inside the dashboard. Demonstrate sub-second ML segmentation isolating the slick.
2. **Step 2 (Hindcast):** Drag the **Hindcast Drift Slider** backward in time. Watch 5,000 particle tracers converge to origin point $(X_0, Y_0)$ at $T_0$.
3. **Step 3 (Attribution):** Toggle the suspect AIS layers to highlight the highest scoring vessel, pointing out the transponder dropout right at the oil release area.
4. **Step 4 (Legal Enforcement):** Click **Enforce Fine on Blockchain**. Complete the Polygon Amoy transaction, showing the immutable registry record, IPFS address, and download the legally compliant PDF evidence dossier.
5. **Step 5 (Validation):** Deactivate Mock Mode, click **Verify IPFS Forensic Evidence**, and watch the dashboard confirm evidence integrity against the ledger.
