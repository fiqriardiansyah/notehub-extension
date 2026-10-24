// Shared origins for background.js (pulled in via importScripts) and
// sidepanel.js (loaded ahead of it by sidepanel.html). Both files read these
// globals instead of declaring their own, so a dev/prod switch is one edit
// here rather than four scattered string literals.
//
// Flip DEV to true to point a locally loaded unpacked extension at a dev
// server. It ships as false — a released build must talk to production.
// Both origins are already in manifest.json's host_permissions, which is what
// lets openOrFocusAppTab() run a url-filtered chrome.tabs.query without the
// broad "tabs" permission.
const DEV = true;

const API_BASE = DEV ? 'http://localhost:1111/api' : 'https://notespacehub.com/api';
const APP_BASE = DEV ? 'http://localhost:3000' : 'https://notespacehub.com';
// Public R2 origin uploaded note attachments are served from — the
// extension's copy of notehub-app's VITE_R2_PUBLIC_URL.
const R2_PUBLIC_URL = DEV ? 'https://notehub-dev.kasigo.online' : '';
