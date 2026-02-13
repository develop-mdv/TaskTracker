# DEPLOY.md — Деплой TaskTracker

## Требования к VPS

- **ОС**: Ubuntu 22.04+ (или другой Linux)
- **RAM**: минимум 2 GB
- **Диск**: минимум 10 GB
- **Порты**: 80, 443, 3000 (внутренний)
- **Домен**: `kawdle.ru` — A-запись указывает на IP сервера

## 1. Установка Docker и Docker Compose

```bash
# Обновляем систему
sudo apt update && sudo apt upgrade -y

# Установка Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Docker Compose (уже встроен в Docker 20.10+)
docker compose version

# Перезайти в сессию (для группы docker)
exit
```

## 2. Клонирование проекта

```bash
git clone <your-repo-url> /opt/tasktracker
cd /opt/tasktracker
```

## 3. Настройка .env

```bash
cp .env.example .env
nano .env
```

Обязательно измените:

| Переменная | Описание |
|---|---|
| `POSTGRES_PASSWORD` | Пароль PostgreSQL |
| `NEXTAUTH_SECRET` | Случайная строка 32+ символов (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | `https://kawdle.ru` |
| `MINIO_ACCESS_KEY` | Ключ доступа MinIO |
| `MINIO_SECRET_KEY` | Секретный ключ MinIO (минимум 8 символов) |
| `CRON_SECRET` | Секрет для cron-эндпоинтов (`openssl rand -hex 16`) |
| `SEED_EMAIL` | Email для входа |
| `SEED_PASSWORD` | Пароль для входа |

## 4. Запуск (dev-режим без nginx)

```bash
# Запуск БД и MinIO
docker compose up -d postgres minio

# Установить зависимости
npm install

# Применить миграции
npx prisma db push

# Посеять данные
npx prisma db seed

# Запустить dev-сервер
npm run dev
```

Открыть: http://localhost:3000

## 5. Запуск production

```bash
# Сборка и запуск всех сервисов
docker compose up -d --build

# Применить миграции
docker compose exec app npx prisma db push
docker compose exec app npx prisma db seed
```

## 6. Настройка Nginx + домен

1. В `nginx/nginx.conf` уже прописан домен `kawdle.ru`
2. Убедитесь, что DNS A-запись `kawdle.ru` указывает на IP вашего VPS

```bash
# Запуск с nginx
docker compose --profile production up -d
```

## 7. HTTPS через Let's Encrypt

### Первоначальная установка сертификата

```bash
# Временный nginx без SSL (для ACME challenge)
# Замените в nginx.conf: закомментируйте блок server :443

docker compose --profile production up -d nginx

# Получить сертификат
docker compose --profile production run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  -d kawdle.ru \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email

# Раскомментировать блок :443 в nginx.conf
# Перезапустить nginx
docker compose --profile production restart nginx
```

### Автообновление сертификата (cron)

```bash
# Добавить в crontab:
0 0 1 * * docker compose --profile production run --rm certbot renew && docker compose --profile production restart nginx
```

## 8. Настройка Cron-задач

```bash
# Открыть crontab
crontab -e

# Добавить:

# Генерация повторяющихся задач (ежедневно в 6:00 UTC)
0 6 * * * curl -s -X POST http://localhost:3000/api/cron/recurrence -H "Authorization: Bearer YOUR_CRON_SECRET" > /dev/null

# Очистка корзины (по воскресеньям в 3:00 UTC)
0 3 * * 0 curl -s -X POST http://localhost:3000/api/cron/cleanup -H "Authorization: Bearer YOUR_CRON_SECRET" > /dev/null
```

Замените `YOUR_CRON_SECRET` на значение из `.env`.

## 9. Бэкапы

### PostgreSQL

```bash
# Бэкап
docker compose exec postgres pg_dump -U postgres tasktracker > backup_$(date +%Y%m%d).sql

# Восстановление
docker compose exec -T postgres psql -U postgres tasktracker < backup_YYYYMMDD.sql
```

### MinIO

```bash
# Бэкап (копирование volume)
docker run --rm -v myboroda_tasks_minio_data:/data -v $(pwd)/backups:/backup alpine tar czf /backup/minio_$(date +%Y%m%d).tar.gz /data

# Восстановление
docker run --rm -v myboroda_tasks_minio_data:/data -v $(pwd)/backups:/backup alpine tar xzf /backup/minio_YYYYMMDD.tar.gz -C /
```

### Автобэкап (cron)

```bash
# Ежедневный бэкап PostgreSQL в 2:00 UTC
0 2 * * * docker compose exec -T postgres pg_dump -U postgres tasktracker | gzip > /opt/backups/pg_$(date +\%Y\%m\%d).sql.gz
```

## 10. Healthcheck

```bash
curl http://localhost:3000/api/health
# Ожидаемый ответ: {"status":"ok","timestamp":"..."}
```

## Команды

| Команда | Описание |
|---|---|
| `docker compose up -d` | Запуск dev (без nginx) |
| `docker compose --profile production up -d` | Запуск prod (с nginx) |
| `docker compose logs -f app` | Логи приложения |
| `docker compose down` | Остановка |
| `docker compose down -v` | Остановка + удаление volumes |
| `npx prisma studio` | GUI для БД |
