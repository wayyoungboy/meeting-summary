@echo off
cd /d "%~dp0"

echo ========================================
echo  Starting Meeting Summary System
echo ========================================
echo.

:: Start backend in a new window
echo [1/2] Starting backend server (port 13001)...
start "Backend Server" cmd /k "cd /d ""%~dp0backend"" && ""%~dp0backend\.venv\Scripts\python.exe"" run.py"

:: Wait a moment for backend to start
timeout /t 2 /nobreak > nul

:: Start frontend in a new window
echo [2/2] Starting frontend server (port 13002)...
start "Frontend Server" cmd /k "cd /d ""%~dp0frontend"" && pnpm dev"

echo.
echo ========================================
echo  Backend:  http://localhost:13001
echo  Frontend: http://localhost:13002
echo ========================================
echo.
echo Press any key to close this window (servers will keep running)
pause > nul
