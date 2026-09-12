@echo off
chcp 65001 >nul
cd /d "%~dp0"
title DDARIN Song Collector
node collector.js
pause
