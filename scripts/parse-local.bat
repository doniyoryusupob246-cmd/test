@echo off
REM Запуск парсера OLX с локальной машины. Вешается на Планировщик задач Windows.
REM Лог пишется рядом, в scripts\parse-local.log

cd /d "%~dp0.."
call npx tsx scripts/parse-local.ts >> "%~dp0parse-local.log" 2>&1
echo. >> "%~dp0parse-local.log"
