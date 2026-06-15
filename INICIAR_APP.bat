@echo off
title Generador de Caracteristicas App
cd /d "%~dp0"
start "Generador Server" /min cmd /c "node server.js"
timeout /t 2 /nobreak >nul
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
  start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app=http://localhost:8000
) else (
  start "" "http://localhost:8000"
)
