@echo off
cd /d "%~dp0"
set "PY="
py -3.13 --version >nul 2>nul
if not errorlevel 1 set "PY=py -3.13"
if not defined PY (
 py -3 --version >nul 2>nul
 if not errorlevel 1 set "PY=py -3"
)
if not defined PY (
 python --version >nul 2>nul
 if not errorlevel 1 set "PY=python"
)
if not defined PY (echo Python no disponible. & pause & exit /b 1)
%PY% -m pip install -r net\requirements.txt
if errorlevel 1 (echo No se pudieron instalar dependencias. & pause & exit /b 1)
start "" "http://127.0.0.1:8765/online.html"
%PY% net\server.py
pause
