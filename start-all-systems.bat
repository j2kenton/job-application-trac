@echo off
echo ========================================
echo Job Application Tracker - Auto Startup
echo ========================================
echo.
echo Starting all monitoring and development systems...
echo.

REM Check if we're in the correct directory
if not exist "package.json" (
    echo ERROR: Not in correct project directory. Please navigate to project root.
    echo Expected: c:/dev/homeAssignments/appApp/job-application-trac
    pause
    exit /b 1
)

echo [1/5] Starting LinkedIn Backend Service...
start "LinkedIn Backend" cmd /k "cd backend && npm start"
timeout /t 3 /nobreak >nul

echo [2/5] Starting Frontend Development Server...
start "Frontend Dev" cmd /k "npm run dev"
timeout /t 5 /nobreak >nul

echo [3/5] Starting Chrome with Debug Mode...
start "Chrome Debug" cmd /k "start-chrome-debug.bat"
timeout /t 3 /nobreak >nul

echo [4/5] Starting Enhanced Browser Error Monitor...
start "Error Monitor" cmd /k "node scripts/browser-error-monitor.cjs"
timeout /t 2 /nobreak >nul

echo [5/5] All systems started!
echo.
echo ========================================
echo System Status:
echo ========================================
echo Frontend:        http://localhost:5173
echo LinkedIn Backend: http://localhost:3001
echo Chrome Debug:     Port 9222 enabled
echo Error Monitor:    Active and logging
echo ========================================
echo.
echo All development systems are now running.
echo Check individual terminal windows for detailed output.
echo.
pause
