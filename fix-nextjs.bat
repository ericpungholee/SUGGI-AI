@echo off
echo Fixing Next.js ENOENT errors...

echo Stopping Node.js processes...
taskkill /f /im node.exe >nul 2>&1

echo Cleaning cache directories...
if exist .next rmdir /s /q .next
if exist node_modules\.cache rmdir /s /q node_modules\.cache
if exist .turbo rmdir /s /q .turbo

echo Starting development server...
npm run dev

pause
