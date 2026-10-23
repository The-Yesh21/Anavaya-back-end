# Anavaya — Production & Exhibition Deployment Guide

## 1. Process Topology
- **FastAPI Core**: `https://127.0.0.1:8000` (Backend API & WebRTC signaling)
- **Nginx Reverse Proxy**: `http://127.0.0.1:8083` (Origin gateway combining static files & API)
- **Vite Landing Dev Server**: `http://127.0.0.1:8084` (SSR / React landing page)
- **Ngrok Public Tunnel**: TLS tunnel exposing port 8083 for mobile & external access

## 2. Launching Stack
Execute from the repository root:
```powershell
powershell -ExecutionPolicy Bypass -File deploy\start-anavaya.ps1
```
