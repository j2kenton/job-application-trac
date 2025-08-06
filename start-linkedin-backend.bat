@echo off
echo Starting LinkedIn Backend Service...
echo.
cd backend
echo Installing dependencies (if needed)...
call npm install
echo.
echo Starting server on port 3001...
echo Open another terminal to run your frontend with: npm run dev
echo.
call npm start
