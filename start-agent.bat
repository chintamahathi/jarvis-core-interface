@echo off
title J.A.R.V.I.S. Local Windows Agent
color 0B
cls
echo ==================================================
echo   J.A.R.V.I.S. LOCAL WINDOWS AGENT
echo   Starting local Windows system controller...
echo ==================================================
echo.

cd /d "%~dp0"

echo Checking runtime environment...
where bun >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [OK] Bun detected. Launching agent via Bun...
    echo.
    bun run agent/index.ts
    goto end
)

where node >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [OK] Node.js detected. Launching agent via Node...
    echo.
    where npx >nul 2>nul
    if %ERRORLEVEL% equ 0 (
        npx tsx agent/index.ts
    ) else (
        node --loader ts-node/esm agent/index.ts
    )
    goto end
)

echo [ERROR] Neither Bun nor Node.js was found in your PATH!
echo Please install Node.js (https://nodejs.org) or Bun (https://bun.sh).
pause

:end
pause
