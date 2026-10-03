@echo off
setlocal enabledelayedexpansion
title Nehal Quest Helper
cd /d "%~dp0"

echo ===================================================
echo               Nehal Quest Helper
echo           GitHub Auto-Updater & Launcher
echo ===================================================
echo.

set "REPO=nehalrahamana-maker/Discoard-Quest-Completer"

echo [*] Checking GitHub for updates from %REPO%...
for /f "tokens=*" %%a in ('powershell -NoProfile -Command "try { (Invoke-RestMethod -Uri 'https://api.github.com/repos/%REPO%/releases/latest' -Headers @{'User-Agent'='Nehal-Quest-Helper'}).tag_name } catch { '' }" 2^>nul') do (
    set "LATEST_TAG=%%a"
)

if defined LATEST_TAG if not "!LATEST_TAG!"=="" (
    echo [+] Latest GitHub release: !LATEST_TAG!
    if not exist "version.txt" (
        echo !LATEST_TAG! > "version.txt"
    )
    set /p CURRENT_TAG=<"version.txt"
    if not exist "nehal.exe" (
        set "NEED_UPDATE=1"
    ) else if "!CURRENT_TAG!" neq "!LATEST_TAG!" (
        echo [*] New version detected: !CURRENT_TAG! -^> !LATEST_TAG!
        set "NEED_UPDATE=1"
    ) else (
        set "NEED_UPDATE=0"
    )

    if "!NEED_UPDATE!"=="1" (
        echo [*] Downloading latest release (!LATEST_TAG!)...
        curl.exe -L -o "portable.zip" "https://github.com/%REPO%/releases/download/!LATEST_TAG!/discord-quest-helper-Windows-x64-!LATEST_TAG!-portable.zip" 2>nul
        if not exist "portable.zip" (
            curl.exe -L -o "portable.zip" "https://github.com/%REPO%/releases/download/!LATEST_TAG!/Nehal-Quest-Helper-!LATEST_TAG!-Windows.zip" 2>nul
        )
        if exist "portable.zip" (
            echo [*] Extracting update files...
            tar.exe -xf "portable.zip"
            if exist "discord-quest-helper.exe" (
                copy /y "discord-quest-helper.exe" "nehal.exe" >nul
                del /f /q "discord-quest-helper.exe" >nul 2>nul
            )
            del /f /q "portable.zip" >nul 2>nul
            echo !LATEST_TAG! > "version.txt"
            echo [+] Updated to !LATEST_TAG! successfully!
        )
    )
) else (
    echo [!] Offline or GitHub API rate limit reached. Launching local version...
)

if exist "nehal.exe" (
    echo [*] Launching nehal.exe...
    start "" "nehal.exe"
) else (
    echo [!] nehal.exe not found!
    pause
)
exit /b 0
