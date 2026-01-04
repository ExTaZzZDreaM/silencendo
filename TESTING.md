# Тестирование Docs MCP сервера

## Быстрый старт

### 1. Сборка проекта

```bash
npm run build
```

### 2. Тестирование кэша

Проверяет работу SQLite кэша:

```bash
npm run test:cache
```

Этот тест проверяет:
- ✅ Сохранение и получение данных из кэша
- ✅ Хеширование запросов (case-insensitive)
- ✅ Истечение TTL записей

### 3. Тестирование MCP сервера

Полный тест сервера с реальными запросами к DuckDuckGo:

```bash
npm run test:docs
```

Этот тест проверяет:
- ✅ Инициализацию сервера
- ✅ Список доступных инструментов
- ✅ `docs_resolve` - поиск библиотек
- ✅ Кэширование (повторный запрос)
- ✅ `docs_fetch` - получение документации
- ✅ Rate limiting

## Ручное тестирование

### Запуск основного приложения

```bash
npm run dev
```

Это запустит все MCP серверы, включая docs сервер.

### Тестирование через stdin/stdout

Вы можете напрямую взаимодействовать с docs сервером:

```bash
node dist/mcp/servers/docs/index.js
```

Затем отправьте JSON-RPC запросы:

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{}}}
{"jsonrpc":"2.0","id":2,"method":"tools/list"}
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"docs_resolve","arguments":{"query":"react"}}}
```

## Проверка кэша

Кэш хранится в SQLite базе данных:
- Windows: `%TEMP%\silencendo-docs-cache.db`
- Linux/Mac: `/tmp/silencendo-docs-cache.db`

Вы можете проверить содержимое кэша с помощью SQLite:

```bash
sqlite3 %TEMP%\silencendo-docs-cache.db "SELECT query, expires_at FROM docs_cache LIMIT 10;"
```

## Проверка конфигурации

Убедитесь, что `mcp-config.yaml` содержит:

```yaml
docs:
  rate_limits:
    duckduckgo:
      requests_per_minute: 30
```

## Ожидаемые результаты

### Успешный тест кэша:
```
🧪 Testing Docs Cache

1️⃣ Testing set/get...
✅ Cache set/get works correctly

2️⃣ Testing hash function...
✅ Hash is case-insensitive
✅ Different queries produce different hashes

3️⃣ Testing expiration...
✅ Expired entries are not returned

✅ Cache tests completed!
```

### Успешный тест сервера:
```
🧪 Testing Docs MCP Server

1️⃣ Testing initialize...
✅ Initialize: { ... }

2️⃣ Testing tools/list...
✅ Tools: docs_resolve, docs_fetch

3️⃣ Testing docs_resolve with query 'react'...
✅ Found libraries: X

4️⃣ Testing cache (same query 'react' again)...
✅ Cached response received (should be faster)

5️⃣ Testing docs_fetch...
✅ Found snippets: X

6️⃣ Testing rate limiting (5 rapid requests)...
✅ Completed 5/5 requests

✅ All tests completed!
```

## Устранение проблем

### Ошибка "Project not built"
```bash
npm run build
```

### Ошибка "Rate limit exceeded"
Подождите минуту или увеличьте лимит в `mcp-config.yaml`

### Ошибка подключения к DuckDuckGo
Проверьте интернет-соединение и доступность `https://api.duckduckgo.com/`

