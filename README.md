# S-CODE

This repo contains:

- `src/` (`dist/`): TypeScript MCP servers (filesystem + terminal) packaged for S-CODE.
- `roo-code/`: S-CODE-branded fork of Roo Code (VS Code extension + web apps).

## S-CODE Extension

- VS Code extension: `roo-code/src`
- Webview UI: `roo-code/webview-ui`
- Website: `roo-code/apps/web-roo-code`

### Dev (roo-code)

- `cd roo-code`
- `npx -y pnpm@10.8.1 install`
- `npx -y pnpm@10.8.1 --filter ./src test`

To run in VS Code, open `roo-code/` and press `F5` to launch an Extension Development Host.

Note: a VS Code extension cannot change the VS Code app icon/splash/about window; that requires a VS Code fork.

## Dev

- `npm install`
- `npm run build`
- `npm run dev`

## MCP Config

- `.scode/mcp.json` points at `./dist/mcp/servers/filesystem/index.js`
