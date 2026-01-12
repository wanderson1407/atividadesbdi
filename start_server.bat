@echo off
set DEV_AUTH=true
cd /d C:\dev\atividades-bdi-serra
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
