# Tauri + SvelteKit + TypeScript

This template should help get you started developing with Tauri, SvelteKit and TypeScript in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Svelte](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer).

## Launch Bucks Browser (Web)

Run in browser mode:

```bash
npm run launch:browser
```

Or open browser automatically to the post creation flow:

```bash
npm run launch:browser:open
```

The app runs on:

- `http://localhost:1420/create`
- `http://localhost:1420/feed`

## VS Code Launch

Use `Run and Debug` with:

- `Bucks Browser: Web /create`
- `Bucks Browser: Web /feed`

These configurations auto-start the Vite server via `.vscode/tasks.json`.

## Primary Flow Validation

Manual E2E cases:

- `tests/PRIMARY_USER_FLOW_TEST_CASES.md`

Smoke test script:

```bash
tests/test_primary_flow_smoke.sh
```

If the dev server is running on a custom URL:

```bash
APP_URL=http://127.0.0.1:1420 tests/test_primary_flow_smoke.sh
```
