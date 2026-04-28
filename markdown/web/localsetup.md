# VitePress Local Setup and Usage Guide

This guide explains how to install Node.js, switch Node versions, and run this project locally on Windows.

## 0. Quick install and usage (Windows)

If you just want the shortest path, run in this order:

1. Install Node.js 20.x LTS from official MSI:
   - https://nodejs.org/en/download
2. Open a new PowerShell and verify:

```powershell
node -v
npm -v
```

3. In project root, install dependencies:

```powershell
npm install
```

4. Start local docs site:

```powershell
npm run docs:dev
```

5. Build production docs:

```powershell
npm run docs:build
```

6. If something is weird, clean and rebuild:

```powershell
npm run rebuild
```

## 1. Recommended versions

- Node.js: 20.x LTS
- npm: bundled with Node.js

This repository is validated with Node.js 20 in CI.

## 2. Install Node.js from official website (MSI)

Use the official Node.js MSI installer first.

1. Open the official Node.js download page:
   - https://nodejs.org/en/download
2. Download the Windows Installer (.msi) for Node.js 20.x LTS.
3. Run the MSI installer and keep default options.
4. Restart your terminal.

Verify installation:

```powershell
node -v
npm -v
```

## 3. Install project dependencies

In project root:

```powershell
npm install
```

## 4. Start local development server

```powershell
npm run docs:dev
```

After startup, open the local URL shown in terminal (usually `http://localhost:5173`).

## 5. Build and preview

Build docs:

```powershell
npm run docs:build
```

Preview built site:

```powershell
npm run docs:preview
```

## 6. Clean cache and rebuild

Only clean cache:

```powershell
npm run clean:cache
```

Fast rebuild (clean + build):

```powershell
npm run rebuild:fast
```

Full rebuild (clean + fresh install + build):

```powershell
npm run rebuild
```

## 6.1 Common usage commands

Start development server:

```powershell
npm run docs:dev
```

Build static site:

```powershell
npm run docs:build
```

Export PDFs (same pipeline as GitHub Actions):

```powershell
npm run docs:pdf
```

Preview build output:

```powershell
npm run docs:preview
```

Clean cache only:

```powershell
npm run clean:cache
```

Fast rebuild:

```powershell
npm run rebuild:fast
```

## 7. Optional: switch Node versions with nvm-windows

If you need to switch between multiple Node versions, use nvm-windows.

### 7.1 Install nvm-windows

1. Download installer from:
   - https://github.com/coreybutler/nvm-windows/releases
2. Run installer and restart terminal.

### 7.2 Install and switch versions

Run in PowerShell:

```powershell
nvm install 20.19.0
nvm use 20.19.0
node -v
npm -v
```

Optional checks:

```powershell
nvm list
nvm current
```

Example: switch to Node 22 for testing, then switch back to 20.

```powershell
nvm install 22.15.0
nvm use 22.15.0
node -v

nvm use 20.19.0
node -v
```

## 8. Common issues

### 8.1 node command not found after MSI install

- Restart terminal or restart Windows.
- Reinstall Node.js MSI and ensure Add to PATH is enabled.

### 8.2 nvm command not found

- Close and reopen terminal.
- Confirm nvm-windows is installed in PATH.

### 8.3 npm ci fails in rebuild

This usually means package-lock.json is out of sync with package.json.

Fix:

```powershell
npm install
npm run rebuild
```

### 8.4 Port already in use

Use another port:

```powershell
npx vitepress dev docs --port 5174
```
