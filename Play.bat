@echo off
rem Starts a tiny local web server so the microphone reading check works, then opens the game.
cd /d "%~dp0"
start "" http://localhost:8123/index.html
python -m http.server 8123
