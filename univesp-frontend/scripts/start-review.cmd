@echo off
setlocal
powershell -ExecutionPolicy Bypass -File "%~dp0start-review.ps1" %*
