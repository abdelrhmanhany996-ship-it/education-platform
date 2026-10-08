@echo off
REM One-click local run on Windows: update, install, start, open the browser.
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js 20+ is required: https://nodejs.org & pause & exit /b 1)
where git >nul 2>nul && git pull
if not exist .env echo FIREBASE_USE_ADC=false> .env
call npm install || (pause & exit /b 1)
start "" cmd /c "timeout /t 8 >nul & start http://localhost:3000"
call npm run dev
pause
