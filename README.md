# Product API (PostgreSQL + Redis + Docker)

## Стек
- Node.js 18 + Express
- PostgreSQL 17
- Redis 7
- Docker + Docker Compose

## Запуск
docker compose up --build

## Переменные окружения
Все параметры заданы в docker-compose.yml.

## Маршруты
POST   /api/products
GET    /api/products       (с кэшем 60 сек)
GET    /api/products/:id
PATCH  /api/products/:id
DELETE /api/products/:id

## Проверка
curl http://localhost:3000/api/products
