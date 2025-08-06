@echo off
setlocal

echo.
echo ================================
echo   File Monitor for Cline/Human
echo ================================
echo.

cd /d "%~dp0\.."

echo Current directory: %CD%
echo.

REM Check if this is a git repository
git status >nul 2>&1
if errorlevel 1 (
    echo ERROR: This is not a git repository!
    echo Please run this script from within a git repository.
    pause
    exit /b 1
)

echo Git repository detected: OK
echo.

REM Ask user for options
set /p AUTO_COMMIT=Enable auto-commit for Cline changes? (y/n): 
set /p VERBOSE=Enable verbose output? (y/n): 

echo.
echo Starting advanced file monitor...
echo - Auto-commit: %AUTO_COMMIT%
echo - Verbose: %VERBOSE%
echo.
echo Press Ctrl+C to stop monitoring
echo ================================
echo.

REM Build PowerShell command
set PS_ARGS=-ExecutionPolicy Bypass -File "scripts\advanced-file-monitor.ps1"

if /i "%AUTO_COMMIT%"=="y" set PS_ARGS=%PS_ARGS% -AutoCommit
if /i "%VERBOSE%"=="y" set PS_ARGS=%PS_ARGS% -Verbose

REM Run the PowerShell script
powershell.exe %PS_ARGS%

echo.
echo File monitoring session ended.
pause
