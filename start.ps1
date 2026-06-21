# Start the DealsApp (backend + frontend)
param(
    [switch]$BackendOnly,
    [switch]$FrontendOnly
)

function Start-Backend {
    Write-Host "[Backend] Starting on http://localhost:3001..." -ForegroundColor Green
    $backendJob = Start-Job -ScriptBlock {
        Set-Location "c:\Deals-APP\backend"
        npm run dev 2>&1
    }
    return $backendJob
}

function Start-Frontend {
    Write-Host "[Frontend] Starting on http://localhost:5173..." -ForegroundColor Cyan
    $frontendJob = Start-Job -ScriptBlock {
        Set-Location "c:\Deals-APP\frontend"
        npm run dev 2>&1
    }
    return $frontendJob
}

if (-not (Test-Path "c:\Deals-APP\backend\.env") -or (Get-Content "c:\Deals-APP\backend\.env" | Select-String "your_api_key_here")) {
    Write-Host "WARNING: Please set your ANTHROPIC_API_KEY in c:\Deals-APP\backend\.env" -ForegroundColor Yellow
    $key = Read-Host "Enter Anthropic API key (or press Enter to skip)"
    if ($key -ne "") {
        (Get-Content "c:\Deals-APP\backend\.env") -replace "your_api_key_here", $key | Set-Content "c:\Deals-APP\backend\.env"
        Write-Host "API key updated!" -ForegroundColor Green
    }
}

if ($BackendOnly) {
    $bj = Start-Backend
    Write-Host "Backend running. Press Ctrl+C to stop."
    Wait-Job $bj | Out-Null
} elseif ($FrontendOnly) {
    $fj = Start-Frontend
    Write-Host "Frontend running. Press Ctrl+C to stop."
    Wait-Job $fj | Out-Null
} else {
    $bj = Start-Backend
    Start-Sleep -Seconds 2
    $fj = Start-Frontend

    Write-Host ""
    Write-Host "DealsApp running!" -ForegroundColor Green
    Write-Host "  Frontend: http://localhost:5173" -ForegroundColor Cyan
    Write-Host "  Backend:  http://localhost:3001" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Press Ctrl+C to stop both servers."

    try {
        while ($true) {
            Start-Sleep -Seconds 2
            $bOutput = Receive-Job $bj -ErrorAction SilentlyContinue
            $fOutput = Receive-Job $fj -ErrorAction SilentlyContinue
            if ($bOutput) { Write-Host "[Backend] $bOutput" }
            if ($fOutput) { Write-Host "[Frontend] $fOutput" }
        }
    } finally {
        Stop-Job $bj, $fj -ErrorAction SilentlyContinue
        Remove-Job $bj, $fj -ErrorAction SilentlyContinue
        Write-Host "Servers stopped." -ForegroundColor Yellow
    }
}
