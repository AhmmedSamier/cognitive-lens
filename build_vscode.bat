@echo off
echo Building VS Code Extension...

REM Check if Bun is installed
where bun >nul 2>nul
if %errorlevel% neq 0 (
    echo Bun is not installed or not in PATH. Please install Bun.
    exit /b 1
)

cd packages\vscode-extension
echo Installing dependencies...
call bun install

echo Packaging...
call bun run package

echo Creating VSIX...
call bun run package:vsix

echo Done! VSIX should be in packages\vscode-extension
cd ..\..
