@echo off
echo ========================================
echo Job Application Tracker - Auto Commit
echo ========================================
echo.
echo Running automatic git commit...
echo.

node scripts/auto-commit.cjs %1

echo.
echo Auto-commit process completed.
echo.
pause
