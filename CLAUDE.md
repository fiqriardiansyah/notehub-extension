# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## CSS build step

Styles use **Tailwind CSS** compiled via CLI. After changing any Tailwind classes in `sidepanel.html` or `sidepanel.js`, regenerate `sidepanel.css`:

```
npm run build:css
```

For live recompilation while editing:

```
npm run watch:css
```

Source files: `input.css` → compiled output: `sidepanel.css`. Do not edit `sidepanel.css` directly.

## Loading the extension

Load the extension directory directly into Chrome/Edge:

1. Go to `chrome://extensions` (or `edge://extensions`)
2. Enable **Developer mode**
3. Click **Load unpacked** and select this folder
4. After any file change, click the **Reload** button on the extension card (or press `Ctrl+R` on the extensions page)

## Extension ID

The extension ID is pinned to `hfdgjbbcaplgejgalabnfaopggeohmcb` via the `key` field in `manifest.json`. The matching private key lives in `extension.pem` (gitignored). Do not remove the `key` field from `manifest.json`.

## Architecture

This is a **Manifest V3** Chrome extension with no bundler or framework.

| File | Role |
|---|---|
| `manifest.json` | Extension config — permissions, side panel entry point, background worker |
| `config.js` | `API_BASE` / `APP_BASE` origins shared by the worker and the panel, plus the `DEV` dev/prod switch (ships `false`) |
| `sidepanel.html` / `sidepanel.css` / `sidepanel.js` | The persistent side panel UI, opened via `chrome.sidePanel` when the toolbar icon is clicked |
| `background.js` | Service worker — auth, job capture, context menu, and `sidePanel.setPanelBehavior` wiring |
| `content-linkedin.js` / `content-linkedin.css` | Content script injected on LinkedIn job pages — extracts job data, shows a capture pill, and broadcasts `jobChanged` to the side panel |
| `icons/` | PNG icons at 16 / 48 / 128 px |

The side panel (Chrome 114+, `chrome.sidePanel`) is the primary surface and stays open across tab navigation within a window; there is no popup — the `action` has no `default_popup`, and `setPanelBehavior({ openPanelOnActionClick: true })` makes the icon open the panel directly. The panel document is destroyed when closed and rebuilt on reopen, so it re-fetches state on load/focus rather than relying on in-memory state. It communicates with the service worker via `chrome.runtime.sendMessage` / `chrome.runtime.onMessage`, and with the LinkedIn content script directly via `chrome.tabs.sendMessage` to read the active tab's job — this deliberately avoids the `tabs` permission (only the active tab's id is read; the content script is asked whether it has a job rather than the panel inspecting `tab.url`). Persistent state goes through `chrome.storage`. Auth uses the `chrome.identity` API (OAuth2 via `identity` permission declared in manifest). The backend host is `notespacehub.com` (declared in `host_permissions`).
