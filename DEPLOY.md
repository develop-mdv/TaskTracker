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

## Шаг 7. Безопасное обновление приложения

При выходе новых версий (особенно с изменениями в базе данных) следуйте этому алгоритму, чтобы не потерять данные.

### 1. Подготовка и Бэкап (ОБЯЗАТЕЛЬНО)

Перед обновлением сохраните текущее состояние базы данных.

```bash
cd /opt/tasktracker

# 1. Скачиваем обновления кода, но пока не применяем
git pull

# 2. Создаем бэкап базы данных (PostgreSQL)
# Файл сохранится в /opt/backups/manual_backup_YYYYMMDD.sql
mkdir -p /opt/backups
docker compose exec -T postgres pg_dump -U postgres tasktracker > /opt/backups/manual_backup_$(date +%Y%m%d_%H%M).sql

# (Опционально) Бэкап файлов (MinIO)
# Если менялась структура хранения файлов
docker run --rm \
  -v myboroda_tasks_minio_data:/data \
  -v /opt/backups:/backup \
  alpine tar czf /backup/minio_backup_$(date +%Y%m%d_%H%M).tar.gz /data
```

### 2. Применение миграций БД

Если в обновлении есть изменения в `prisma/schema.prisma` (новые таблицы, поля), нужно обновить структуру БД.

**Вариант А: Автоматически (Простой)**
При перезапуске контейнера `app` скрипт запуска автоматически выполняет `prisma db push`.
Если изменений немного и они безопасные (добавление полей), можно просто перезапустить.

**Вариант Б: Вручную (Безопасный)**
Если вы хотите убедиться, что данные не потеряются (например, при переименовании полей):

```bash
# Заходим в контейнер
docker compose exec app sh

# Проверяем статус миграции (без применения)
# Если команда недоступна, используем npx
npx prisma migrate status

# Или пробуем push с подтверждением (покажет предупреждения если есть риск потери данных)
npx prisma db push --skip-generate

exit
```

### 3. Сборка и Перезапуск

```bash
# Пересобираем и запускаем контейнеры в фоне
docker compose --profile production up -d --build

# Перезапускаем nginx (ОБЯЗАТЕЛЬНО после пересборки app, чтобы обновить IP)
docker compose --profile production restart nginx
```

### 4. Проверка

```bash
# Смотрим логи приложения (нет ли ошибок Prisma)
docker compose logs app --tail 50

# Проверяем статус
docker compose --profile production ps
```

> ⚠️ **Важно**: Если после обновления сайт выдает "502 Bad Gateway", выполните `docker compose --profile production restart nginx`.

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

---

## Автоматический деплой (CI/CD)

В репозитории настроен **GitHub Actions** (`.github/workflows/deploy.yml`), который автоматически обновляет код на сервере при пуше в ветку `main`.

### Настройка (Один раз)

Чтобы GitHub мог подключаться к вашему серверу, нужно добавить **Secrets** в настройках репозитория.

#### 1. Создание SSH-ключей (на вашем ПК)
Сгенерируйте новую пару ключей специально для деплоя (без пароля):
```bash
ssh-keygen -t ed25519 -C "github-actions" -f github_deploy_key
```
*На все вопросы нажимайте Enter (пароль должен быть пустой).*

#### 2. Добавление ключа на сервер (на VPS)
Скопируйте содержимое **публичного** ключа (`github_deploy_key.pub`) на сервер:
```bash
# На сервере
nano ~/.ssh/authorized_keys
# Вставьте ключ с новой строки, сохраните (Ctrl+O, Enter, Ctrl+X)
```

#### 3. Добавление секретов в GitHub
В репозитории перейдите: **Settings** -> **Secrets and variables** -> **Actions** -> **New repository secret**.

Добавьте 3 секрета:
1.  **`HOST`**: IP-адрес вашего сервера.
2.  **`USERNAME`**: Имя пользователя (обычно `root`).
3.  **`SSH_KEY`**: Содержимое **приватного** ключа (`github_deploy_key`). Копируйте всё, включая `-----BEGIN...` и `...END-----`.

### Как это работает
1.  Вы делаете `git push origin main`.
2.  GitHub запускает workflow.
3.  Он подключается к серверу по SSH.
4.  Выполняет `git pull`, пересобирает контейнеры и перезапускает Nginx.

