Write-Host "Fixing Next.js ENOENT errors..." -ForegroundColor Green

Write-Host "Stopping Node.js processes..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host "Cleaning cache directories..." -ForegroundColor Yellow
if (Test-Path ".next") { Remove-Item -Recurse -Force ".next" }
if (Test-Path "node_modules\.cache") { Remove-Item -Recurse -Force "node_modules\.cache" }
if (Test-Path ".turbo") { Remove-Item -Recurse -Force ".turbo" }

Write-Host "Starting development server..." -ForegroundColor Green
npm run dev
