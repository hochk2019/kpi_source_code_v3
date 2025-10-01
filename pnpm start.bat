@echo off
setlocal
cd /d "%~dp0"

echo Running pnpm install...
call pnpm install
if errorlevel 1 goto error

echo Starting pnpm run server...
call pnpm run server
if errorlevel 1 goto error

echo Building project with pnpm run build...
call pnpm run build
if errorlevel 1 goto error

echo Launching pnpm start...
call pnpm start
if errorlevel 1 goto error

goto end

:error
echo.
echo An error occurred during execution. Check the logs above for details.
endlocal
exit /b 1

:end
echo.
echo All commands completed successfully.
endlocal
exit /b 0
