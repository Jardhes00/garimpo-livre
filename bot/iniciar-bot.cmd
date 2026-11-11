@echo off
chcp 65001 >nul
title Bot Garimpo Livre
cd /d "%~dp0"
echo Bot Garimpo Livre - feche esta janela para desligar o bot.
echo.
:loop
node index.js
echo.
echo O bot parou. Ligando de novo em 30 segundos... (feche esta janela para desligar)
timeout /t 30 /nobreak >nul
goto loop
