# Настройка Cron Job

## Как это работает

Вместо `node-cron` (который не работает в Next.js serverless) мы используем
внешний cron сервис, который каждые N минут отправляет POST запрос на наш endpoint.

```
Внешний cron → POST https://your-domain.com/api/cron?secret=YOUR_CRON_SECRET
                          ↓
                   runMatching() запускается
                          ↓
               Новые объявления → уведомления пользователям
```

## Вариант 1: cron-job.org (бесплатно, рекомендуется)

1. Зарегистрируйся на https://cron-job.org
2. Создай новый cron job:
   - **URL**: `https://your-domain.com/api/cron?secret=YOUR_CRON_SECRET`
   - **Method**: POST
   - **Schedule**: каждые 15 минут
   - **Headers**: `Content-Type: application/json`
3. Нажми Save

## Вариант 2: Railway Cron (если деплой на Railway)

В `railway.toml` добавь:
```toml
[cron]
schedule = "*/15 * * * *"
command = "curl -X POST https://your-domain.com/api/cron -H \"Authorization: Bearer YOUR_CRON_SECRET\""
```

## Вариант 3: GitHub Actions (бесплатно)

Создай `.github/workflows/cron.yml`:
```yaml
name: Run Matcher Cron
on:
  schedule:
    - cron: "*/15 * * * *"
jobs:
  trigger:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger matcher
        run: |
          curl -X POST ${{ secrets.APP_URL }}/api/cron \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```
Добавь `APP_URL` и `CRON_SECRET` в GitHub Secrets.

## Проверка

Протестируй вручную:
```bash
curl -X POST https://your-domain.com/api/cron?secret=YOUR_CRON_SECRET
# Ожидаемый ответ: {"success":true,"message":"Cron job completed",...}
```

## Переменные окружения

```env
CRON_SECRET=your_random_secret_here  # любая случайная строка
```
