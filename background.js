const API_BASE = 'https://notespacehub.com/api';

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
    console.log('check session')
    checkSession().then((result) => sendResponse(result));
    return true;
  }

  if (msg.action === 'updateNote') {
    chrome.storage.local.get('access_token').then(({ access_token }) => {
      if (!access_token) {
        sendResponse({ success: false, error: 'Not authenticated' });
        return;
      }
      fetch(`${API_BASE}/note/update/${msg.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ note: msg.note }),
      })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((result) => sendResponse({ success: true, data: result.data || result }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
    });
    return true;
  }

  if (msg.action === 'updateTodos') {
    chrome.storage.local.get('access_token').then(({ access_token }) => {
      if (!access_token) {
        sendResponse({ success: false, error: 'Not authenticated' });
        return;
      }
      fetch(`${API_BASE}/note/update/${msg.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ todos: msg.todos }),
      })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((result) => sendResponse({ success: true, data: result.data || result }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
    });
    return true;
  }

  if (msg.action === 'createNote') {
    chrome.storage.local.get('access_token').then(({ access_token }) => {
      if (!access_token) {
        sendResponse({ success: false, error: 'Not authenticated' });
        return;
      }
      fetch(`${API_BASE}/note`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(msg.note),
      })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((result) => sendResponse({ success: true, data: result.data || result }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
    });
    return true;
  }

  if (msg.action === 'fetchNotes') {
    const order = msg.order || 'desc';
    chrome.storage.local.get('access_token').then(({ access_token }) => {
      if (!access_token) {
        sendResponse({ success: false, error: 'Not authenticated' });
        return;
      }
      fetch(`${API_BASE}/note/get-all?order=${order}`, {
        headers: { Authorization: `Bearer ${access_token}` },
      })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((result) => sendResponse({ success: true, data: result.data || result }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
    });
    return true;
  }
});
