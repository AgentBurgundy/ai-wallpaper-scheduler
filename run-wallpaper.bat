@echo off
REM Batch file to run wallpaper update via Windows Task Scheduler
cd /d "Z:\Software Projects\screensaver"
node dist/index.js
if %ERRORLEVEL% NEQ 0 (
    echo Error occurred while updating wallpaper
    exit /b %ERRORLEVEL%
)


