@echo off
cd /d "%~dp0"
echo ========================================================
echo  Iniciando Registro de Acciones (PWA)...
echo  Servidor en http://localhost:8080
echo ========================================================
start http://localhost:8080
python -m http.server 8080
pause
