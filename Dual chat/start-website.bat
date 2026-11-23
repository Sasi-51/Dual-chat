@echo off
setlocal
cd /d "%~dp0web"
where npx >nul 2>nul || (echo ERROR: Install Node.js LTS first.& pause & exit /b 1)
echo QuickChat website: http://127.0.0.1:4173/
echo Keep this window open. Press Ctrl+C to stop.
npx http-server . -p 4173 -c-1
pause
