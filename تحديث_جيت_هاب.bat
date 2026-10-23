@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "& { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; & '%~dp0sync_github.ps1' }"
if errorlevel 1 (
    pause
    exit /b 1
)