# S-CODE

S-CODE is an AI-powered dev team inside VS Code.

This folder contains a **rebranded** copy of the upstream Roo Code project (labels + icons changed to S-CODE / SLNC branding).

## What’s Here

- VS Code extension: `src/`
- Webview UI: `webview-ui/`
- Web apps:
  - Marketing site: `apps/web-roo-code/`
  - Evals UI: `apps/web-evals/`
  - Nightly packaging: `apps/vscode-nightly/`

## Branding Assets

- Source images in the parent repo root: `../logoW.png` and `../logoB.png`
- Generated/used icons:
  - Extension icons: `src/assets/icons/`
  - Website icons/logos: `apps/web-roo-code/public/`

## Development

Install dependencies:

```sh
cd roo-code
npx -y pnpm@10.8.1 install
```

Run extension in VS Code (Extension Development Host):

- Open `roo-code/` in VS Code
- Press `F5`

Run extension tests:

```sh
cd roo-code
npx -y pnpm@10.8.1 --filter ./src test
```

Run the website:

```sh
cd roo-code
npx -y pnpm@10.8.1 --filter @roo-code/web-roo-code dev
```

## Notes

- This is a VS Code extension; it **cannot** change VS Code’s app icon/splash/about window/title bar. Rebranding the host IDE requires a VS Code fork/build.

## Upstream

- Upstream project: `https://github.com/RooCodeInc/Roo-Code` (Apache 2.0)
