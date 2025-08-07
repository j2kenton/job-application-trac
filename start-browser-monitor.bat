@echo off
echo Enhanced Browser Error Monitor for Job Application Tracker
echo =======================================================
echo.
echo This will monitor:
echo - Build errors and compilation issues
echo - Real-time browser console errors  
echo - Network errors and API failures
echo - Automatic fixes for common issues
echo.
echo IMPORTANT: For full browser monitoring, start Chrome with:
echo chrome.exe --remote-debugging-port=9222
echo.
echo Press Ctrl+C to stop monitoring
echo.
node scripts/browser-error-monitor.cjs
pause
