@echo off
setlocal enabledelayedexpansion
title Nehal Quest Helper
cd /d "%~dp0"

echo ===================================================
echo               Nehal Quest Helper
echo        GitHub Auto-Updater and Launcher
echo ===================================================
echo.

set "REPO=nehalrahamana-maker/Discoard-Quest-Completer"

echo [*] Checking GitHub for updates from %REPO%

if exist ".latest_tag" del /f /q ".latest_tag" >nul 2>nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $tag = (Invoke-RestMethod -Uri 'https://api.github.com/repos/nehalrahamana-maker/Discoard-Quest-Completer/releases/latest' -Headers @{'User-Agent'='Nehal-Quest-Helper'}).tag_name; if ($tag) { [System.IO.File]::WriteAllText('.latest_tag', $tag.Trim()) } } catch {}"

set "LATEST_TAG="
if exist ".latest_tag" (
    set /p LATEST_TAG=<".latest_tag"
    del /f /q ".latest_tag" >nul 2>nul
)

if not defined LATEST_TAG goto :OFFLINE
if "!LATEST_TAG!"=="" goto :OFFLINE

echo [+] Latest GitHub release: !LATEST_TAG!
if not exist "version.txt" echo !LATEST_TAG!> "version.txt"
set /p CURRENT_TAG=<"version.txt"

set "NEED_UPDATE=0"
if not exist "nehal.exe" set "NEED_UPDATE=1"
if "!CURRENT_TAG!" neq "!LATEST_TAG!" set "NEED_UPDATE=1"

if "!NEED_UPDATE!"=="1" (
    echo [*] Downloading latest release [!LATEST_TAG!]
    curl.exe -L -o "portable.zip" "https://github.com/%REPO%/releases/download/!LATEST_TAG!/discord-quest-helper-Windows-x64-!LATEST_TAG!-portable.zip" 2>nul
    if not exist "portable.zip" (
        curl.exe -L -o "portable.zip" "https://github.com/%REPO%/releases/download/!LATEST_TAG!/Nehal-Quest-Helper-!LATEST_TAG!-Windows.zip" 2>nul
    )
    if exist "portable.zip" (
        echo [*] Extracting update files
        tar.exe -xf "portable.zip"
        if exist "discord-quest-helper.exe" (
            copy /y "discord-quest-helper.exe" "nehal.exe" >nul
            del /f /q "discord-quest-helper.exe" >nul 2>nul
        )
        del /f /q "portable.zip" >nul 2>nul
        echo !LATEST_TAG!> "version.txt"
        echo [+] Updated to !LATEST_TAG! successfully!
    )
) else (
    echo [+] You are on the latest version: !CURRENT_TAG!
)
goto :LAUNCH

:OFFLINE
echo [!] Offline or GitHub API rate limit reached. Launching local version...

:LAUNCH
if exist "nehal.exe" (
    echo [*] Launching nehal.exe
    start "" "nehal.exe"
) else (
    echo [ERROR] nehal.exe not found!
    pause
)
