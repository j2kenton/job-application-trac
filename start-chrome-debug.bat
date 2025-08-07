@echo off
echo Starting Chrome with Remote Debugging for Error Monitoring
echo ========================================================
echo.
echo This will start Chrome with debugging port 9222 enabled
echo allowing the browser error monitor to connect and capture
echo real-time console errors.
echo.
echo Chrome will open with debugging capabilities enabled.
echo You can then run start-browser-monitor.bat to begin monitoring.
echo.

REM Try common Chrome installation paths
set CHROME_PATH=""

if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    set CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    set CHROME_PATH="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
) else if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" (
    set CHROME_PATH="%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
) else (
    echo Chrome not found in common installation paths.
    echo Please manually start Chrome with: chrome.exe --remote-debugging-port=9222
    echo Or update this script with your Chrome installation path.
    pause
    exit /b 1
)

echo Starting Chrome from: %CHROME_PATH%
echo.

REM Start Chrome with remote debugging
%CHROME_PATH% --remote-debugging-port=9222 --disable-web-security --user-data-dir="%TEMP%\chrome-debug" "http://localhost:5173"

echo.
echo Chrome started with debugging enabled on port 9222
echo You can now run start-browser-monitor.bat to begin error monitoring
pause
