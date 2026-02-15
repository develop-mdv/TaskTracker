# DEPLOY.md — Деплой TaskTracker на VPS (kwadle.ru)

Пошаговая инструкция для запуска production-версии на VPS с HTTPS.

---

## Требования

- VPS: Ubuntu 22.04+, минимум 2 GB RAM, 10 GB диск
- Домен `kwadle.ru` — A-запись указывает на IP вашего VPS
- Открытые порты: **80**, **443**

---

## Шаг 1. Подготовка VPS

```bash
# Подключаемся к серверу
ssh root@<IP-вашего-VPS>

# Обновляем систему
sudo apt update && sudo apt upgrade -y

# Устанавливаем Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Устанавливаем Git
sudo apt install -y git

# Перезаходим, чтобы docker работал без sudo
exit
ssh root@<IP-вашего-VPS>

# Проверяем
docker compose version
```

---

## Шаг 2. Клонирование проекта

```bash
git clone <url-вашего-репо> /opt/tasktracker
cd /opt/tasktracker
```

---

## Шаг 3. Настройка .env

```bash
cp .env.example .env
nano .env
```

Заполните **все** значения:

```env
# Database
DATABASE_URL="postgresql://postgres:STRONG_DB_PASSWORD@postgres:5432/tasktracker?schema=public"
POSTGRES_PASSWORD=STRONG_DB_PASSWORD

# NextAuth
NEXTAUTH_URL="https://kwadle.ru"
NEXTAUTH_SECRET=<сгенерируйте: openssl rand -base64 32>

# MinIO
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=<придумайте>
MINIO_SECRET_KEY=<придумайте, минимум 8 символов>
MINIO_BUCKET=attachments
MINIO_USE_SSL=false

# Cron
CRON_SECRET=<сгенерируйте: openssl rand -hex 16>

# Логин в приложение
SEED_EMAIL=your-email@example.com
SEED_PASSWORD=<придумайте надёжный пароль>
```

> ⚠️ **Важно**: `POSTGRES_PASSWORD` в `DATABASE_URL` и отдельной переменной должны совпадать.

---

## Шаг 4. Получение SSL-сертификата (Let's Encrypt)

Сначала нужно получить сертификат **до** запуска полного nginx с HTTPS.

В репозитории два nginx-конфига:
- `nginx/nginx.initial.conf` — только HTTP (для получения сертификата)
- `nginx/nginx.conf` — полный с HTTPS (для продакшена)

Docker Compose монтирует `nginx/active.conf`, поэтому просто копируем нужный:

```bash
# Создаём директории
mkdir -p nginx/certs

# Ставим начальный конфиг (только HTTP)
cp nginx/nginx.initial.conf nginx/active.conf

# Запускаем
docker compose --profile production up -d

# Получаем сертификат
docker compose --profile production run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  -d kwadle.ru \
  --email dima_may@bk.ru \
  --agree-tos \
  --no-eff-email

# Переключаемся на полный конфиг с HTTPS
cp nginx/nginx.conf nginx/active.conf

# Перезапускаем nginx
docker compose --profile production restart nginx
```

---

## Шаг 5. Запуск production

```bash
cd /opt/tasktracker

# Собираем и запускаем все сервисы
docker compose --profile production up -d --build

# Ждём ~30 секунд пока всё поднимется
```

> ℹ️ Миграция БД (`prisma db push`) и создание начального пользователя (`prisma db seed`) выполняются **автоматически** при старте контейнера.

Проверяем:
```bash
# Логи приложения — убедиться что миграция прошла
docker compose logs app --tail 20

# Health check
curl https://kwadle.ru/api/health
# → {"status":"ok","timestamp":"..."}

# Или просто откройте в браузере: https://kwadle.ru
```

---

## Шаг 6. Настройка Cron-задач

```bash
crontab -e
```

Добавьте строки (замените `YOUR_CRON_SECRET` на значение из `.env`):

```cron
# Генерация повторяющихся задач — каждый день в 06:00 UTC
0 6 * * * curl -s -X POST http://localhost:3000/api/cron/recurrence -H "Authorization: Bearer YOUR_CRON_SECRET" > /dev/null 2>&1

# Очистка корзины — каждое воскресенье в 03:00 UTC
0 3 * * 0 curl -s -X POST http://localhost:3000/api/cron/cleanup -H "Authorization: Bearer YOUR_CRON_SECRET" > /dev/null 2>&1

# Автообновление SSL — 1-го числа каждого месяца
0 0 1 * * cd /opt/tasktracker && docker compose --profile production run --rm certbot renew && docker compose --profile production restart nginx > /dev/null 2>&1

# Бэкап PostgreSQL — каждый день в 02:00 UTC
0 2 * * * docker compose -f /opt/tasktracker/docker-compose.yml exec -T postgres pg_dump -U postgres tasktracker | gzip > /opt/backups/pg_$(date +\%Y\%m\%d).sql.gz 2>/dev/null
```

Создайте папку для бэкапов:
```bash
mkdir -p /opt/backups
```

---

## Шаг 7. Обновление приложения

При пуше нового кода:

```bash
cd /opt/tasktracker
git pull
docker compose --profile production up -d --build
docker compose restart nginx  # nginx кеширует IP контейнера app — нужен рестарт
```

> ℹ️ `prisma db push` и `prisma db seed` выполняются **автоматически** при старте контейнера `app` (см. `docker-entrypoint.sh`). Вручную их запускать не нужно.
>
> ⚠️ После пересборки `app` обязательно перезапустите `nginx` — иначе будет ошибка 502, т.к. nginx кеширует IP-адрес контейнера.

Проверить что всё поднялось:
```bash
docker compose --profile production ps
docker compose logs app --tail 20
```

---

## Полезные команды

| Команда | Описание |
|---|---|
| `docker compose --profile production up -d` | Запуск prod |
| `docker compose --profile production down` | Остановка |
| `docker compose logs -f app` | Логи приложения |
| `docker compose logs -f nginx` | Логи nginx |
| `docker compose exec app npx prisma studio` | GUI для БД |
| `docker compose --profile production restart` | Перезапуск всего |

---

## Бэкапы

### PostgreSQL
```bash
# Бэкап
docker compose exec -T postgres pg_dump -U postgres tasktracker > backup.sql

# Восстановление
docker compose exec -T postgres psql -U postgres tasktracker < backup.sql
```

### MinIO (файлы вложений)
```bash
# Бэкап
docker run --rm \
  -v myboroda_tasks_minio_data:/data \
  -v /opt/backups:/backup \
  alpine tar czf /backup/minio_$(date +%Y%m%d).tar.gz /data

# Восстановление
docker run --rm \
  -v myboroda_tasks_minio_data:/data \
  -v /opt/backups:/backup \
  alpine tar xzf /backup/minio_YYYYMMDD.tar.gz -C /
```

---

## Устранение проблем

```bash
# Проверить что все контейнеры запущены
docker compose --profile production ps

# Проверить логи если что-то не работает
docker compose logs app --tail 50
docker compose logs nginx --tail 50
docker compose logs postgres --tail 50

# Перезапустить один сервис
docker compose restart app

# Пересобрать приложение
docker compose --profile production up -d --build app
```
