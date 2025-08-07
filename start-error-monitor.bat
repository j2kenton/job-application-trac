@echo off
echo Starting Error Monitor for Job Application Tracker...
echo This will monitor for console errors and attempt automatic fixes.
echo.
echo Press Ctrl+C to stop monitoring
echo.
node scripts/error-monitor.js
pause
