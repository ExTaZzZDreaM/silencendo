# Быстрое тестирование Docs MCP сервера

## Шаг 1: Сборка проекта
```bash
npm run build
```

## Шаг 2: Тест кэша (быстрый, без интернета)
```bash
npm run test:cache
```
✅ Проверяет работу SQLite кэша

## Шаг 3: Тест сервера (требует интернет)
```bash
npm run test:docs
```
✅ Проверяет полную работу сервера с DuckDuckGo API

## Шаг 4: Запуск всего приложения
```bash
npm run dev
```
✅ Запускает все MCP серверы, включая docs

---

## Что проверяется:

### test:cache
- Сохранение/получение из кэша
- Хеширование запросов
- Истечение TTL

### test:docs
- Инициализация сервера
- Список инструментов
- Поиск документации (docs_resolve)
- Кэширование результатов
- Получение сниппетов (docs_fetch)
- Rate limiting

---

## Проверка кэша вручную

Кэш находится в: `%TEMP%\silencendo-docs-cache.db` (Windows)

```bash
# Просмотр кэша
sqlite3 %TEMP%\silencendo-docs-cache.db "SELECT query, datetime(expires_at/1000, 'unixepoch') as expires FROM docs_cache;"
```



