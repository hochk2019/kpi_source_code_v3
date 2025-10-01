@echo off

setlocal ENABLEEXTENSIONS ENABLEDELAYEDEXPANSION



rem === PNPM command mappings based on package.json ===

rem install        -> pnpm install

rem server         -> pnpm run server (node scripts/start-backend.mjs)

rem server:rebuild -> pnpm run server:rebuild (rebuild backend before start)

rem start          -> pnpm run start (prod backend)

rem build          -> pnpm run build (vite build)

rem dev            -> pnpm run dev (full-stack dev experience)

rem dev:frontend   -> pnpm run dev:frontend (vite only)

rem db:init        -> pnpm run db:init (initialize database)

rem healthcheck    -> pnpm run healthcheck (check service health)



if "%~1"=="" goto MENU

call :RUN_ACTION "%~1"

goto END



:MENU

echo ==============================================

echo  KPI Control - Trinh khoi dong bang pnpm

echo ==============================================

echo 0. Chay chuoi day du: install -> build -> start

echo 1. Cai dat cac phu thuoc (pnpm install)

echo 2. Khoi dong server phat trien (pnpm run server)

echo 3. Khoi dong server sau khi rebuild (pnpm run server:rebuild)

echo 4. Khoi dong che do production (pnpm run start)

echo 5. Build frontend (pnpm run build)

echo 6. Khoi dong che do dev full-stack (pnpm run dev)

echo 7. Khoi dong chi frontend (pnpm run dev:frontend)

echo 8. Khoi tao co so du lieu (pnpm run db:init)

echo 9. Chay kiem tra suc khoe he thong (pnpm run healthcheck)

echo Q. Thoat

set /p _choice=Vui long chon mot tuy chon hoac nhap lenh (vd: start): 

if "%_choice%"=="" goto MENU

if /I "%_choice%"=="Q" goto END

call :RUN_ACTION "%_choice%"

if errorlevel 1 goto MENU

goto END



:RUN_ACTION

set "_action=%~1"

if "%_action%"=="" goto INVALID



if "%_action%"=="0" set "_action=full"

if "%_action%"=="1" set "_action=install"

if "%_action%"=="2" set "_action=server"

if "%_action%"=="3" set "_action=server:rebuild"

if "%_action%"=="4" set "_action=start"

if "%_action%"=="5" set "_action=build"

if "%_action%"=="6" set "_action=dev"

if "%_action%"=="7" set "_action=dev:frontend"

if "%_action%"=="8" set "_action=db:init"

if "%_action%"=="9" set "_action=healthcheck"



set "_description="

if /I "%_action%"=="full" set "_description=Chuoi install -> build -> start" & call :EXEC "install" && call :EXEC "run build" && call :EXEC "run start"

if /I "%_action%"=="install" set "_description=Cai dat phu thuoc" & call :EXEC "install"

if /I "%_action%"=="server" set "_description=Khoi dong server phat trien" & call :EXEC "run server"

if /I "%_action%"=="server:rebuild" set "_description=Khoi dong server kem rebuild" & call :EXEC "run server:rebuild"

if /I "%_action%"=="start" set "_description=Khoi dong server production" & call :EXEC "run start"

if /I "%_action%"=="build" set "_description=Build frontend" & call :EXEC "run build"

if /I "%_action%"=="dev" set "_description=Khoi dong che do dev full-stack" & call :EXEC "run dev"

if /I "%_action%"=="dev:frontend" set "_description=Khoi dong frontend (Vite)" & call :EXEC "run dev:frontend"

if /I "%_action%"=="db:init" set "_description=Khoi tao co so du lieu" & call :EXEC "run db:init"

if /I "%_action%"=="healthcheck" set "_description=Kiem tra suc khoe he thong" & call :EXEC "run healthcheck"

if defined _description goto SUCCESS



:INVALID

echo [!] Lua chon "%~1" khong duoc ho tro. Vui long thu lai.

exit /b 1



:EXEC

set "_pnpmArgs=%~1"

echo.

echo [INFO] Dang thuc thi: pnpm %_pnpmArgs%

call pnpm %_pnpmArgs%

if errorlevel 1 echo [ERROR] Lenh pnpm %_pnpmArgs% that bai. && exit /b 1

exit /b 0



:SUCCESS

echo.

echo [OK] !_description! hoan thanh thanh cong.

echo Ban co the tiep tuc lua chon tac vu khac hoac nhan Q de thoat.

exit /b 0



:END

echo.

echo Hoan tat cac tac vu. Ban co the dong cua so nay hoac tiep tuc lam viec.

exit /b 0

