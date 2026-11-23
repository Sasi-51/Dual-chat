@echo off
setlocal
cd /d "%~dp0desktop-bridge"
echo =============================================
echo QuickChat - Java Bluetooth RFCOMM Bridge
echo =============================================
where java >nul 2>nul || (echo ERROR: Install Java 17 or newer and add it to PATH.& pause & exit /b 1)
where mvn >nul 2>nul || (echo ERROR: Maven is not installed or not in PATH.& echo Install Apache Maven, reopen CMD, and run this file again.& pause & exit /b 1)
echo Building bridge...
mvn -DskipTests package
if errorlevel 1 (echo BUILD FAILED. See errors above.& pause & exit /b 1)
for %%J in (target\quickchat-desktop-bridge-1.0.0.jar) do set JAR=%%J
if not exist "%JAR%" (echo ERROR: shaded JAR was not generated.& pause & exit /b 1)
echo Starting local bridge at ws://127.0.0.1:8765
echo Keep this window open while using QuickChat.
java -jar "%JAR%"
pause
