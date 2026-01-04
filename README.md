# Silencendo MCP

Система безопасного выполнения команд и скриптов в Docker контейнерах через MCP протокол.

## 🚀 Быстрый старт

```bash
npm install              # Установка зависимостей
npm run setup:docker     # Скачать Docker образы (golang, node, python, rust, alpine)
npm run build            # Сборка TypeScript
npm run dev              # Запуск MCP серверов
npm test                 # Тестирование
```

## 📦 Что внутри

### 🔧 Terminal MCP Server — выполнение команд и скриптов

**2 инструмента:**

1. **`run_command`** — выполнение shell команд
   ```json
   {
     "command": "npm test",
     "working_dir": ".",
     "timeout": 30000
   }
   ```

2. **`run_script`** — выполнение скриптов на разных языках
   ```json
   {
     "interpreter": "python",
     "script": "print('Hello!')",
     "args": ["arg1", "arg2"]
   }
   ```

**Поддерживаемые языки:**
- 🐍 Python → `python:3.12-slim`
- 🟢 Node.js → `node:22-alpine`
- 🔵 Go → `golang:1.23-alpine`
- 🐚 Shell (sh) → `alpine:latest`
- 🦀 Rust → `rust:alpine`

### 📁 Filesystem MCP Server — работа с файлами
- Безопасное чтение/запись файлов
- Path traversal защита

## 🔒 Безопасность

**Docker изоляция:**
- ✅ Каждая команда в отдельном контейнере
- ✅ Проект монтируется **read-only**
- ✅ Сеть **отключена**
- ✅ Лимиты: **256MB RAM**, **1 CPU**, **30s timeout**
- ✅ Контейнеры удаляются автоматически

**Blacklist опасных команд:**
- `rm -rf` — деструктивное удаление
- `| sh`, `| bash` — pipe в shell
- `curl|bash`, `wget|sh` — remote execution
- `> /dev/sd*` — запись на диск
- Fork bombs и другие

**Автовыбор образа:**
- `package.json` → Node контейнер
- `go.mod` → Go контейнер
- `requirements.txt` → Python контейнер
- `Cargo.toml` → Rust контейнер

## ⚙️ Конфигурация

[mcp-config.yaml](mcp-config.yaml):
```yaml
security:
  terminal:
    sandbox:
      enabled: true
      mode: "docker"
      
      docker_images:
        go: "golang:1.23-alpine"
        node: "node:22-alpine"
        python: "python:3.12-slim"
        rust: "rust:alpine"
        default: "alpine:latest"
      
      limits:
        cpu: "1"           # 1 CPU
        memory: "256m"     # 256 МБ
        timeout: "30s"     # 30 секунд
        max_output: "1m"   # 1 МБ вывода
      
      volumes:
        project_root:
          host: "."
          container: "/workspace"
          read_only: true   # Проект read-only!
        temp:
          host: "/tmp"
          container: "/tmp"
          read_only: false  # /tmp доступен для записи
      
      network:
        enabled: false      # Сеть отключена
```

## 🧪 Тестирование

```bash
npm test                  # Все тесты (config, security, images, terminal, script)
npm run test:config       # Проверка загрузки mcp-config.yaml
npm run test:security     # Тест blacklist (8/9 опасных команд блокируются)
npm run test:images       # Автовыбор образа по проекту
npm run test:terminal     # Тест run_command (echo, ls, timeout, блокировка)
npm run test:script       # Тест run_script (sh, python, node, args)
```

**Что проверяется:**
- ✅ Парсинг конфигурации (256m→байты, 30s→мс)
- ✅ Блокировка `rm -rf`, `curl|bash`, fork bombs
- ✅ Автоопределение: package.json→node, go.mod→go
- ✅ Docker execution с лимитами
- ✅ Скрипты на Python/Node/Shell
- ✅ Очистка контейнеров
- ✅ Audit логирование

## 📊 Audit Log

Все команды логируются в [.mcp/audit.log](.mcp/audit.log):
```
[2026-01-04T12:34:56.789Z] [run_command] command="npm test" image=node:22-alpine exit_code=0 duration=1234ms container_id=abc123def456
[2026-01-04T12:35:10.123Z] [run_script] command="python script (50 chars)" image=python:3.12-slim exit_code=0 duration=142ms container_id=xyz789
```

## 📁 Структура проекта

```
silencendo/
├── mcp-config.yaml              # Конфигурация Docker sandbox
├── package.json                 # Зависимости + npm скрипты
├── scripts/
│   └── pull-sandbox-images.sh   # Скачивание Docker образов
├── src/
│   ├── index.ts                 # Точка входа (запуск MCP серверов)
│   ├── config/
│   │   └── mcp-config.ts        # Загрузка и парсинг YAML конфига
│   ├── mcp/servers/
│   │   ├── filesystem/
│   │   │   └── index.ts         # Filesystem MCP server
│   │   └── terminal/
│   │       ├── index.ts         # Terminal MCP server (JSON-RPC)
│   │       └── sandbox.ts       # Docker Sandbox executor
│   └── utils/
│       ├── dockerCheck.ts       # Проверка Docker daemon
│       └── audit.ts             # Логирование в .mcp/audit.log
└── test/
    ├── config-test.mjs          # Тест конфигурации
    ├── security-test.mjs        # Тест blacklist
    ├── image-detection-test.mjs # Тест автовыбора образа
    ├── terminal-test.mjs        # Тест run_command
    ├── script-test.mjs          # Тест run_script
    └── run-all-tests.sh         # Запуск всех тестов
```

## 🎯 Примеры использования

### run_command — выполнение команд

**Простая команда:**
```json
{
  "name": "run_command",
  "arguments": {
    "command": "ls -la"
  }
}
```

**С рабочей директорией и timeout:**
```json
{
  "name": "run_command",
  "arguments": {
    "command": "npm test",
    "working_dir": "./",
    "timeout": 60000,
    "env": { "NODE_ENV": "test" }
  }
}
```

### run_script — выполнение скриптов

**Python скрипт:**
```json
{
  "name": "run_script",
  "arguments": {
    "interpreter": "python",
    "script": "import sys\nprint(f'Python {sys.version}')"
  }
}
```

**Node скрипт с аргументами:**
```json
{
  "name": "run_script",
  "arguments": {
    "interpreter": "node",
    "script": "console.log('Args:', process.argv.slice(2))",
    "args": ["hello", "world"]
  }
}
```

**Shell скрипт:**
```json
{
  "name": "run_script",
  "arguments": {
    "interpreter": "sh",
    "script": "#!/bin/sh\necho 'Hello from Docker'\npwd"
  }
}
```

### Ответ от сервера

```json
{
  "stdout": "Python 3.12.12\n",
  "stderr": "",
  "exit_code": 0,
  "duration_ms": 142,
  "container_id": "abc123def456..."
}
```

## 🐳 Требования

- **Node.js** 20+
- **Docker Desktop** (должен быть запущен)
- **Диск:** ~1.5 GB для Docker образов

**Проверка:**
```bash
node --version   # v20+
docker --version # Docker version 29.1.2+
docker ps        # Должен работать без ошибок
```

## 🔧 NPM команды

```bash
# Установка
npm install              # Установить зависимости
npm run setup:docker     # Скачать Docker образы

# Разработка
npm run build            # Скомпилировать TypeScript
npm run dev              # Запустить MCP серверы

# Тестирование
npm test                 # Все тесты
npm run test:config      # Только конфигурация
npm run test:security    # Только безопасность
npm run test:images      # Только автовыбор образов
npm run test:terminal    # Только run_command
npm run test:script      # Только run_script
```

## ⚠️ Fallback режим

Если Docker недоступен, система работает в **небезопасном режиме**:
- ❌ Команды выполняются на хосте (не в контейнере)
- ✅ Работает только whitelist команд: `ls`, `cat`, `npm`, `git`, `node`, `go`
- ⚠️ Выводится предупреждение при запуске

**Чтобы включить Docker:**
1. Установить [Docker Desktop](https://www.docker.com/products/docker-desktop)
2. Запустить Docker daemon
3. Выполнить `npm run setup:docker`

## 📝 Что дальше

- [ ] Streaming вывода для long-running команд
- [ ] Кэширование Docker образов
- [ ] Поддержка Ruby, PHP, Java
- [ ] Кастомные Docker образы
- [ ] Metrics и мониторинг
