# DealsApp Setup Script
param(
    [string]$ApiKey = ""
)

Write-Host "=== DealsApp Setup ===" -ForegroundColor Cyan

# Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Node.js is not installed. Please install Node.js 18+ from https://nodejs.org" -ForegroundColor Red
    exit 1
}

$nodeVersion = node --version
Write-Host "Node.js: $nodeVersion" -ForegroundColor Green

# Set API key
if ($ApiKey -eq "") {
    $ApiKey = Read-Host "Enter your Anthropic API key (or press Enter to skip)"
}

if ($ApiKey -ne "") {
    $envContent = "ANTHROPIC_API_KEY=$ApiKey`nPORT=3001`nNODE_ENV=development"
    $envContent | Out-File -FilePath "backend\.env" -Encoding utf8
    Write-Host "API key saved to backend/.env" -ForegroundColor Green
} else {
    if (-not (Test-Path "backend\.env")) {
        Copy-Item "backend\.env.example" "backend\.env"
        Write-Host "Created backend/.env from template - please add your ANTHROPIC_API_KEY" -ForegroundColor Yellow
    }
}

# Install dependencies
Write-Host "`nInstalling backend dependencies..." -ForegroundColor Cyan
Set-Location backend
npm install
Set-Location ..

Write-Host "`nInstalling frontend dependencies..." -ForegroundColor Cyan
Set-Location frontend
npm install
Set-Location ..

# Seed database
Write-Host "`nSeeding database with sample products..." -ForegroundColor Cyan
Set-Location backend
npm run seed
Set-Location ..

Write-Host "`n=== Setup Complete! ===" -ForegroundColor Green
Write-Host ""
Write-Host "To start the application, run:" -ForegroundColor White
Write-Host "  Backend:  cd backend && npm run dev" -ForegroundColor Yellow
Write-Host "  Frontend: cd frontend && npm run dev" -ForegroundColor Yellow
Write-Host ""
Write-Host "Then open: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "Features:" -ForegroundColor White
Write-Host "  - Trending products with real-time price tracking" -ForegroundColor Gray
Write-Host "  - Add to favorites with configurable price alerts (default 15%)" -ForegroundColor Gray
Write-Host "  - AI price monitoring agent (Claude + tools)" -ForegroundColor Gray
Write-Host "  - RAG-powered product search with AI insights" -ForegroundColor Gray
Write-Host "  - Conversational shopping assistant" -ForegroundColor Gray
Write-Host "  - Price comparison across Amazon, eBay, Walmart" -ForegroundColor Gray
Write-Host "  - Product import (URL, manual, bulk)" -ForegroundColor Gray
Write-Host "  - Real-time notifications via WebSocket" -ForegroundColor Gray
