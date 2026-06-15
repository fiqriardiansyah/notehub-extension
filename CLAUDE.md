# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## CSS build step

Styles use **Tailwind CSS** compiled via CLI. After changing any Tailwind classes in `popup.html` or `popup.js`, regenerate `popup.css`:

```
npm run build:css
```

For live recompilation while editing:

```
npm run watch:css
```

Source files: `input.css` → compiled output: `popup.css`. Do not edit `popup.css` directly.

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
| `manifest.json` | Extension config — permissions, popup entry point, background worker |
| `popup.html` / `popup.css` / `popup.js` | The 400×600 px popup UI shown when the toolbar icon is clicked |
| `background.js` | Service worker (declared in manifest, not yet created) |
| `icons/` | PNG icons at 16 / 48 / 128 px |

The popup is the primary surface. It communicates with the service worker via `chrome.runtime.sendMessage` / `chrome.runtime.onMessage`. Persistent state goes through `chrome.storage`. Auth uses the `chrome.identity` API (OAuth2 via `identity` permission declared in manifest). The backend host is `notespacehub.com` (declared in `host_permissions`).
