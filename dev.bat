@echo off
setlocal enabledelayedexpansion
title Nehal Quest Helper - Dev Mode
cd /d "%~dp0"

echo ===================================================
echo         Nehal Quest Helper - Development Mode
echo ===================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Node.js is not found in your PATH.
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

where cargo >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Rust / Cargo is not found in your PATH.
    echo Please install Rust from https://rustup.rs/
    echo.
    pause
    exit /b 1
)

where pnpm >nul 2>nul
if %errorlevel% neq 0 (
    echo [*] Enabling pnpm...
    call corepack enable
    call corepack prepare pnpm@latest --activate
    where pnpm >nul 2>nul
    if %errorlevel% neq 0 (
        call npm install -g pnpm
    )
)

if not exist "node_modules" (
    echo [*] Installing dependencies...
    call pnpm install
)

echo [*] Starting Tauri dev server...
call pnpm run tauri:dev

pause
