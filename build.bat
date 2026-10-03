@echo off
setlocal enabledelayedexpansion
title Nehal Quest Helper - Build
cd /d "%~dp0"

echo ===================================================
echo           Nehal Quest Helper - Build Script
echo ===================================================
echo.

:: Add portable node and pnpm if present
if exist "%~dp0node-portable\node.exe" (
    set "PATH=%~dp0node-portable;!PATH!"
)
if exist "%~dp0..\node-portable\node.exe" (
    set "PATH=%~dp0..\node-portable;!PATH!"
)

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Node.js is not found in your PATH.
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: Check Rust / Cargo
where cargo >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Rust / Cargo is not found in your PATH.
    echo Please install Rust from https://rustup.rs/
    echo.
    pause
    exit /b 1
)

:: Check pnpm
where pnpm >nul 2>nul
if %errorlevel% neq 0 (
    echo [*] Installing pnpm...
    call npm install -g pnpm
)

:: Build runner and frontend
echo [*] Installing project dependencies...
call pnpm install

echo [*] Starting build process via PowerShell...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-windows.ps1"

if %errorlevel% neq 0 (
    echo.
    echo [!] Build failed! Please review the error log above.
) else (
    echo.
    echo [+] Build finished successfully!
)

echo.
pause
