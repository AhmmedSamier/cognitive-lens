@echo off
echo Installing dependencies...
call bun install

echo Building CLI...
cd packages\cli
call bun run build
cd ..\..

echo Building VS Code Extension...
cd packages\vscode-extension
call bun run package

echo Creating VSIX...
call bun run package:vsix

echo Done! VSIX should be in packages\vscode-extension
cd ..\..
