@echo off
title Generador de Caracteristicas
cd /d "%~dp0"
start "" "http://localhost:8000"
node server.js
pause
