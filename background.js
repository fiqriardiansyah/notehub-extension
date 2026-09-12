// API_BASE / APP_BASE come from config.js — see that file for the dev switch.
importScripts('config.js');

// Single authenticated-fetch helper — used by notes CRUD AND job capture, so
// both go through identical auth/headers/base-URL handling (no more
// per-call-site duplication of the Bearer header + Content-Type logic).
async function apiFetch(path, init = {}) {
  const { access_token } = await chrome.storage.local.get('access_token');
  if (!access_token) {
    const err = new Error('Not authenticated');
    err.code = 'UNAUTHENTICATED';
    throw err;
  }
  const headers = {
    Authorization: `Bearer ${access_token}`,
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...(init.headers || {}),
  };
  return fetch(`${API_BASE}${path}`, { ...init, headers });
}

// Same non-ok-throws-generic-HTTP-status + {data: result.data||result}
// unwrap every existing notes handler already used, just no longer
// duplicated per call site.
async function apiFetchJson(path, init) {
  const res = await apiFetch(path, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const result = await res.json();
  return result.data || result;
}

function appAbsolute(path) {
  return `${APP_BASE}${path.startsWith('/') ? path : '/' + path}`;
}

// Reuse an already-open app tab instead of piling up a new one per
// capture/note/application click — matches on origin only, so navigating
// within the app (e.g. applications/123 -> write/456) still reuses the tab.
async function openOrFocusAppTab(path) {
  const url = appAbsolute(path);
  const [existing] = await chrome.tabs.query({ url: `${APP_BASE}/*` });

  if (existing) {
    await chrome.tabs.update(existing.id, { url, active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
    return;
  }
  await chrome.tabs.create({ url });
}

function todayISODate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Recent-applications panel needs both the 5 most-recently-updated rows AND
// an accurate "recorded today" count — the latter can't come from those 5
// rows alone since more than 5 may have been added today. dateApplied
// defaults to the creation instant unless the user backdates it (see
// ApplicationService.create), so filtering on it approximates "recorded
// today" without a backend change.
async function fetchApplicationsWithTodayCount() {
  const today = todayISODate();
  const [applications, todayRes] = await Promise.all([
    apiFetchJson('/application?limit=5'),
    apiFetch(`/application?dateAppliedFrom=${today}&dateAppliedTo=${today}&limit=1`).then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    }),
  ]);
  return { applications, todayCount: todayRes?.meta?.total ?? 0 };
}

async function login() {
  const redirectUri = chrome.identity.getRedirectURL();
  const state = crypto.randomUUID();

  const authUrl =
    `${API_BASE}/oauth/authorize` +
    `?redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

  const redirect = await chrome.identity.launchWebAuthFlow({
    url: authUrl,
    interactive: true,
  });

  const params = new URL(redirect).searchParams;
  if (params.get('state') !== state) throw new Error('state mismatch');

  const res = await fetch(`${API_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: params.get('code') }),
  });

  if (!res.ok) throw new Error('token exchange failed');

  const result = await res.json();
  const accessToken = result.data.access_token;

  await chrome.storage.local.set({ access_token: accessToken });
  return accessToken;
}

async function logout() {
  await chrome.storage.local.remove('access_token');
}

async function checkSession() {
  const { access_token } = await chrome.storage.local.get('access_token');

  if (!access_token) return { authenticated: false };

  const res = await fetch(`${API_BASE}/me`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!res.ok) {
    await chrome.storage.local.remove('access_token');
    return { authenticated: false };
  }

  return { authenticated: true };
}

// ── Job capture ────────────────────────────────────────────────────────────

const CAPTURE_MENU_ID = 'nsh-capture-selection';

chrome.runtime.onInstalled.addListener(async () => {
  chrome.contextMenus.removeAll(() =>
    chrome.contextMenus.create({
      id: CAPTURE_MENU_ID,
      title: 'Capture job to Notespacehub',
      contexts: ['selection'],
    }),
  );

  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (_) {
    // Chrome < 114 has no sidePanel API.
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== CAPTURE_MENU_ID) return;

  if (tab?.windowId != null) {
    try { await chrome.sidePanel.open({ windowId: tab.windowId }); } catch (_) {}
  }

  const text = (info.selectionText || '').trim();
  if (!text) {
    notify('Nothing selected', 'Highlight the job text first, then capture.');
    return;
  }
  capture({ source: 'extension-selection', text, sourceUrl: tab?.url || '' }).catch(() => {});
});

// Mirrored into chrome.storage.session so the side panel can show a loading
// banner for every capture trigger (button, right-click selection, LinkedIn
// pill) even when the panel is opened/rebuilt mid-capture and misses the
// runtime message.
function setCaptureStatus(status, message) {
  return chrome.storage.session.set({ captureStatus: status, captureMessage: message || '' });
}

async function capture(payload) {
  const body = { source: payload.source, sourceUrl: payload.sourceUrl || '' };
  if (payload.source === 'extension-structured') body.fields = payload.fields;
  if (payload.source === 'extension-selection') body.text = payload.text;

  await setCaptureStatus('capturing', 'Capturing job…');

  let res;
  try {
    res = await apiFetch('/application/capture', { method: 'POST', body: JSON.stringify(body) });
  } catch (err) {
    if (err.code === 'UNAUTHENTICATED') {
      notify('Sign in to Notespacehub', 'Open the extension and sign in, then capture again.');
      await setCaptureStatus('error', 'Sign in to capture');
    } else {
      notify("Couldn't reach Notespacehub", 'Check your connection and that you are signed in.');
      await setCaptureStatus('error', "Couldn't reach Notespacehub");
    }
    throw err;
  }

  if (res.status === 401 || res.status === 403) {
    notify('Sign in to Notespacehub', 'Open the extension and sign in, then capture again.');
    await setCaptureStatus('error', 'Sign in to capture');
    throw new Error('auth');
  }
  if (!res.ok) {
    notify('Capture failed', `The app returned ${res.status}. Try again in a moment.`);
    await setCaptureStatus('error', 'Capture failed, try again');
    throw new Error('server');
  }

  const result = await res.json();
  const data = result.data || result;
  await openOrFocusAppTab(data.redirectUrl);
  notify('Draft ready', 'Review and confirm it in the app tab.');
  await setCaptureStatus('success', 'Draft ready — opening app tab');
  return data;
}

function notify(title, message) {
  chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon128.png', title, message });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'login') {
    login()
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (msg.action === 'logout') {
    logout().then(() => sendResponse({ success: true }));
    return true;
  }

  if (msg.action === 'checkSession') {
    checkSession().then((result) => sendResponse(result));
    return true;
  }

  if (msg.action === 'updateNote') {
    apiFetchJson(`/note/update/${msg.id}`, { method: 'PUT', body: JSON.stringify({ note: msg.note }) })
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (msg.action === 'updateTodos') {
    apiFetchJson(`/note/update/${msg.id}`, { method: 'PUT', body: JSON.stringify({ todos: msg.todos }) })
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (msg.action === 'createNote') {
    apiFetchJson('/note', { method: 'POST', body: JSON.stringify(msg.note) })
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // kind is 'image' | 'file' -> POST /bucket/image | /bucket/file. Response is
  // already { success: 1, file: {...} } in the exact shape editor.js's
  // image/attaches tools expect from their uploader, so it's returned as-is
  // (apiFetchJson's `result.data || result` unwrap falls through to `result`
  // here since the bucket endpoints don't wrap in the usual { data } envelope).
  if (msg.action === 'uploadBucket') {
    apiFetchJson(`/bucket/${msg.kind}`, {
      method: 'POST',
      body: JSON.stringify({ base64: msg.base64, name: msg.name, contentType: msg.contentType }),
    })
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (msg.action === 'fetchNotes') {
    const order = msg.order || 'desc';
    apiFetchJson(`/note/get-all?order=${order}`)
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (msg.action === 'fetchApplications') {
    fetchApplicationsWithTodayCount()
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (msg.action === 'fetchFolder') {
    const order = msg.order || 'desc';
    apiFetchJson(`/note/f?id=${encodeURIComponent(msg.id)}&order=${order}`)
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (msg.action === 'capture') {
    capture(msg.payload)
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (msg.action === 'openAppTab') {
    openOrFocusAppTab(msg.path).then(() => sendResponse({ success: true }));
    return true;
  }
});
