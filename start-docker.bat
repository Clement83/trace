@echo off
REM klmToVideo Docker Quick Start Script for Windows
REM =================================================
REM This script helps you get started with the dockerized version of klmToVideo

setlocal enabledelayedexpansion

echo.
echo ================================
echo klmToVideo - Docker Quick Start
echo ================================
echo.

REM Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [91mDocker is not installed. Please install Docker Desktop first:[0m
    echo    https://docs.docker.com/desktop/install/windows-install/
    exit /b 1
)

REM Check if Docker Compose is installed
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [91mDocker Compose is not installed. Please install Docker Compose first:[0m
    echo    https://docs.docker.com/compose/install/
    exit /b 1
)

echo [92mDocker is installed[0m
echo [92mDocker Compose is installed[0m
echo.

REM Create necessary directories if they don't exist
echo Creating necessary directories...
if not exist "guiv2\workspace" mkdir guiv2\workspace
if not exist "guiv2\server\uploads" mkdir guiv2\server\uploads
if not exist "output" mkdir output

echo [92mDirectories created[0m
echo.

REM Check if containers are already running
docker ps | findstr /C:"klmtovideo-app" >nul 2>&1
if %errorlevel% equ 0 (
    echo [93mContainer is already running[0m
    echo.
    set /p restart="Do you want to restart it? (y/n): "
    if /i "!restart!"=="y" (
        echo Restarting containers...
        docker-compose down
        docker-compose up -d
    )
) else (
    REM Build and start containers
    echo Building Docker image (this may take a few minutes)...
    docker-compose build

    echo.
    echo Starting containers...
    docker-compose up -d

    echo.
    echo Waiting for application to be ready...
    timeout /t 5 /nobreak >nul
)

REM Check health status
echo.
echo Checking application health...
set attempt=0
set max_attempts=30

:healthcheck
if !attempt! geq !max_attempts! goto timeout

docker ps | findstr /C:"klmtovideo-app" | findstr /C:"healthy" >nul 2>&1
if %errorlevel% equ 0 (
    echo [92mApplication is healthy![0m
    goto success
)

docker ps | findstr /C:"klmtovideo-app" >nul 2>&1
if %errorlevel% equ 0 (
    echo|set /p="."
    timeout /t 2 /nobreak >nul
    set /a attempt+=1
    goto healthcheck
) else (
    echo.
    echo [91mContainer is not running. Check logs with: docker-compose logs[0m
    exit /b 1
)

:timeout
echo.
echo [93mHealth check timeout. The application might still be starting.[0m
echo    Check logs with: docker-compose logs -f
goto success

:success
echo.
echo ==========================================
echo [92mklmToVideo is now running![0m
echo ==========================================
echo.
echo Access the application at:
echo    http://localhost:3001
echo.
echo Useful commands:
echo    docker-compose logs -f                # View logs
echo    docker-compose down                   # Stop containers
echo    docker-compose restart                # Restart containers
echo    docker exec -it klmtovideo-app bash   # Open shell in container
echo.
echo Your workspaces are stored in:
echo    .\guiv2\workspace
echo.
echo Happy video encoding!
echo.

endlocal
