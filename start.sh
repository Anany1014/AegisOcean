#!/bin/bash
# ==============================================================================
# AegisOcean — Full Stack Startup Script
# Starts ML Server (8001), Backend (4000), Frontend (5173), and Blockchain (8545)
# ==============================================================================

set -e

echo "🌊 ========================================================"
echo "🌊   AegisOcean — Full Stack System Initializer"
echo "🌊 ========================================================"

# Check for Python & Node
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed."; exit 1; }
command -v python >/dev/null 2>&1 || { echo "❌ Python is required but not installed."; exit 1; }

echo "📦 Verifying dependencies..."
if [ ! -d "node_modules" ]; then
  echo "Installing root dependencies..."
  npm install
fi

if [ ! -d "backend/node_modules" ]; then
  echo "Installing backend dependencies..."
  (cd backend && npm install)
fi

if [ ! -d "Frontend/node_modules" ]; then
  echo "Installing frontend dependencies..."
  (cd Frontend && npm install)
fi

echo ""
echo "🚀 Available Launch Modes:"
echo "   1) Full Stack with local blockchain: npm run dev:all"
echo "   2) Standard Stack (ML + Backend + Frontend): npm run dev"
echo "   3) Backend only: npm run dev:backend"
echo "   4) Frontend only: npm run dev:frontend"
echo "   5) ML server only: npm run dev:ml"
echo ""
echo "Starting standard stack (ML + Backend + Frontend)..."
npm run dev
