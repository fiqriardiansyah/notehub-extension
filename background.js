// API_BASE / APP_BASE come from config.js — see that file for the dev switch.
// job-sites.js: the job boards the "This page" tab and the pill recognise.
importScripts('config.js', 'job-sites.js');

// fetch() itself only rejects when the API can't be reached at all (offline,
// server down, wrong API_BASE) — its bare "Failed to fetch" means nothing to
// the user, so that case gets a readable message of its own.
async function fetchOrNetworkError(url, init) {
  try {
    return await fetch(url, init);
  } catch (_) {
    const err = new Error("Couldn't reach Notespacehub — check your connection and try again.");
    err.code = 'NETWORK';
    throw err;
  }
}

// The API answers every failure as { statusCode, message, errors? } (see
// notehub-api's AllExceptionsFilter), and `message` is already written for the
// user — on AI failures it carries the provider's own reason too, e.g. "Your
// OpenRouter key was rejected — check it in Settings › AI. OpenRouter said:
// "API key expired"". Validation failures list the offending fields in
// `errors`. Anything unparseable (a proxy's HTML error page) falls back to
// the bare status.
async function errorFromResponse(res) {
  let message = '';
  try {
    const body = await res.json();
    const main = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
    const details = Array.isArray(body?.errors) ? body.errors.filter((e) => typeof e === 'string').join(', ') : '';
    message = [main, details].filter(Boolean).join(': ');
  } catch (_) {}
  const err = new Error(message || `Request failed (HTTP ${res.status})`);
  err.status = res.status;
  return err;
}

// Single authenticated-fetch helper — used by notes CRUD AND job capture, so
// both go through identical auth/headers/base-URL handling (no more
// per-call-site duplication of the Bearer header + Content-Type logic).
async function apiFetch(path, init = {}) {
  const { access_token } = await chrome.storage.local.get('access_token');
  if (!access_token) {
    const err = new Error("You're signed out — sign in to Notespacehub and try again.");
    err.code = 'UNAUTHENTICATED';
    throw err;
  }
  const headers = {
    Authorization: `Bearer ${access_token}`,
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...(init.headers || {}),
  };
  return fetchOrNetworkError(`${API_BASE}${path}`, { ...init, headers });
}

// Non-ok throws the API's own error message + {data: result.data||result}
// unwrap, shared by every notes handler instead of duplicated per call site.
async function apiFetchJson(path, init) {
  const res = await apiFetch(path, init);
  if (!res.ok) throw await errorFromResponse(res);
  const result = await res.json();
  return result.data || result;
}

// For an endpoint whose answer can be null ("nothing found"), which
// apiFetchJson's unwrap would turn into the whole envelope.
async function apiFetchData(path, init) {
  const res = await apiFetch(path, init);
  if (!res.ok) throw await errorFromResponse(res);
  const result = await res.json();
  return result.data ?? null;
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

// The panel's Applications tab: up to 100 (the API's max) most recently
// updated rows, matched on company or role when `search` is set. The panel
// groups and orders them by dateAdded itself. Anything added on a day comes
// after it in updatedAt order, so the newest-added rows are always in this
// page; `total` tells the panel when older ones were left out.
async function fetchApplications(search) {
  const params = new URLSearchParams({ limit: '100' });
  if (search?.trim()) params.set('search', search.trim());
  const res = await apiFetch(`/application?${params}`);
  if (!res.ok) throw await errorFromResponse(res);
  const result = await res.json();
  return { applications: result.data ?? [], total: result.meta?.total ?? 0 };
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
  if (params.get('state') !== state) throw new Error('Sign in failed — the response did not match this request. Please try again.');

  const res = await fetchOrNetworkError(`${API_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: params.get('code') }),
  });

  if (!res.ok) {
    const err = await errorFromResponse(res);
    err.message = `Sign in failed: ${err.message}`;
    throw err;
  }

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

  const res = await fetchOrNetworkError(`${API_BASE}/me`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  // Only an auth rejection means the token is dead — a 5xx says nothing about
  // it, so the token is kept and the error surfaced instead.
  if (res.status === 401 || res.status === 403) {
    await chrome.storage.local.remove('access_token');
    return { authenticated: false, error: 'Your session expired — sign in again.' };
  }
  if (!res.ok) throw await errorFromResponse(res);

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
  getJobSites().catch(() => {});
});

// So the pill on a freshly opened job page already has the API's selectors.
chrome.runtime.onStartup.addListener(() => {
  getJobSites().catch(() => {});
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== CAPTURE_MENU_ID) return;

  if (tab?.windowId != null) {
    try { await chrome.sidePanel.open({ windowId: tab.windowId }); } catch (_) {}
  }

  const text = (info.selectionText || '').trim();
  if (!text) {
    notify('Nothing selected', 'Highlight the job text first, then capture.');
    setCaptureStatus('error', 'Nothing selected — highlight the job text first, then capture.');
    return;
  }
  capture({ source: 'extension-selection', text, sourceUrl: tab?.url || '' }, tab?.windowId).catch(() => {});
});

// A capture made while the side panel is open in that window is reviewed
// right there instead of in a new app tab. getContexts is Chrome 116+; older
// Chrome falls back to the app tab. windowId is unknown for a capture started
// from the panel itself, which by definition is open.
async function isSidePanelOpen(windowId) {
  if (!chrome.runtime.getContexts) return false;
  const panels = await chrome.runtime.getContexts({ contextTypes: ['SIDE_PANEL'] });
  return panels.some((c) => windowId == null || c.windowId === windowId || c.windowId === -1);
}

// Mirrored into chrome.storage.session so the side panel can show a loading
// banner for every capture trigger (button, right-click selection, LinkedIn
// pill) even when the panel is opened/rebuilt mid-capture and misses the
// runtime message.
function setCaptureStatus(status, message) {
  return chrome.storage.session.set({ captureStatus: status, captureMessage: message || '' });
}

async function capture(payload, windowId) {
  const body = { source: payload.source, sourceUrl: payload.sourceUrl || '' };
  if (payload.source === 'extension-structured') body.fields = payload.fields;
  if (payload.source === 'extension-selection') body.text = payload.text;

  await setCaptureStatus('capturing', 'Capturing job…');

  let res;
  try {
    res = await apiFetch('/application/capture', { method: 'POST', body: JSON.stringify(body) });
  } catch (err) {
    await failCapture(err.code === 'UNAUTHENTICATED' ? 'Sign in to Notespacehub' : "Couldn't reach Notespacehub", err);
  }

  if (res.status === 401 || res.status === 403) {
    await failCapture('Sign in to Notespacehub', new Error('Your session expired — sign in again, then capture again.'));
  }
  // The API's own message — for an AI extraction failure this is the
  // provider's reason (expired/rejected key, no credits, rate limit…).
  if (!res.ok) await failCapture('Capture failed', await errorFromResponse(res));

  const result = await res.json();
  const data = result.data || result;

  if (await isSidePanelOpen(windowId)) {
    await reviewInPanel(data);
    await setCaptureStatus('success', 'Draft ready — review it below');
    return { ...data, review: 'panel' };
  }

  try {
    await openOrFocusAppTab(data.redirectUrl);
  } catch (err) {
    await failCapture('Draft saved', new Error(`The draft was saved, but the app tab couldn't be opened: ${err.message}`));
  }
  notify('Draft ready', 'Review and confirm it in the app tab.');
  await setCaptureStatus('success', 'Draft ready — opening app tab');
  return data;
}

// The panel watches captureReview in chrome.storage.session (same reason as
// captureStatus: it may be rebuilt mid-capture) and fetches the draft itself.
// Only one draft is reviewed at a time — a newer capture replaces the pending
// one, which is discarded the same way the app's confirm page discards a
// draft the user backs out of. A 404 there just means it was already
// confirmed or discarded elsewhere.
async function reviewInPanel(data) {
  const { captureReview: previous } = await chrome.storage.session.get('captureReview');
  if (previous?.draftId && previous.draftId !== data.draftId) {
    apiFetch(`/application/capture/${previous.draftId}`, { method: 'DELETE' }).catch(() => {});
  }
  await chrome.storage.session.set({ captureReview: { draftId: data.draftId, redirectUrl: data.redirectUrl } });
}

// Stage settings are best-effort: without them the panel offers every status,
// and the API still rejects one the user turned off.
async function fetchCaptureReview(draftId) {
  const [draft, stages] = await Promise.all([
    apiFetchJson(`/application/capture/${encodeURIComponent(draftId)}`),
    apiFetchJson('/application-stage').catch(() => null),
  ]);
  return { draft, stages };
}

// The app's form auto-picks the job portal from the Job URL (find-or-create
// via /job-portal/resolve); the panel has no portal picker, so the same
// lookup runs once at save time. A failed lookup just saves without one.
async function resolveJobPortalId(url) {
  if (!url?.trim()) return null;
  try {
    const portal = await apiFetchJson('/job-portal/resolve', { method: 'POST', body: JSON.stringify({ url: url.trim() }) });
    return portal?.id || null;
  } catch (_) {
    return null;
  }
}

async function confirmCaptureDraft(draftId, application) {
  const jobPortalId = await resolveJobPortalId(application.jobUrl);
  const created = await apiFetchJson('/application', {
    method: 'POST',
    body: JSON.stringify({ ...application, jobPortalId, fromDraftId: draftId }),
  });
  await setCaptureStatus('success', `Saved ${created.role || 'application'} at ${created.company || 'company'}`);
  await startDocuments(created.id, ['cv', 'email']);
  return created;
}

// ── "This page" tab ────────────────────────────────────────────────────────

// The API's copy of the job-site config (see job-sites.js) is kept in
// chrome.storage.local, where the pill's content script reads it too, and
// fetched again once it's an hour old. Unreachable API or no config there:
// the stored copy, else the bundled default.
const JOB_SITES_MAX_AGE_MS = 60 * 60 * 1000;

async function getJobSites() {
  const { [JOB_SITES_STORAGE_KEY]: stored } = await chrome.storage.local.get(JOB_SITES_STORAGE_KEY);
  if (stored && Date.now() - stored.fetchedAt < JOB_SITES_MAX_AGE_MS) return nshSitesFromStored(stored);
  try {
    const res = await fetch(`${API_BASE}/extension/job-sites`);
    if (res.ok) {
      const body = await res.json();
      const fresh = { remote: body?.data ?? null, fetchedAt: Date.now() };
      await chrome.storage.local.set({ [JOB_SITES_STORAGE_KEY]: fresh });
      return nshSitesFromStored(fresh);
    }
  } catch (_) {}
  return nshSitesFromStored(stored);
}

// GET /application/lookup answers the application or null.
function lookupJob({ source, sourceJobId, company, role }) {
  const params = new URLSearchParams({ source, sourceJobId });
  if (company && role) {
    params.set('company', company);
    params.set('role', role);
  }
  return apiFetchData(`/application/lookup?${params}`);
}

// Saved straight to the board at "Saved" (no capture draft — the panel is
// the review step), not yet applied, with the canonical URL as its job URL.
// A second save of the same job is the API's 409, which the panel answers by
// looking the job up again.
async function saveJob(job) {
  const jobPortalId = await resolveJobPortalId(job.jobUrl);
  return apiFetchJson('/application', {
    method: 'POST',
    body: JSON.stringify({
      company: job.company,
      role: job.role,
      location: job.location || undefined,
      salaryRange: job.salaryRange || undefined,
      jobUrl: job.jobUrl || undefined,
      jobDescription: job.jobDescription || undefined,
      status: 'SAVED',
      dateApplied: null,
      source: job.source,
      sourceJobId: job.sourceJobId,
      jobPortalId,
    }),
  });
}

// ── Application documents ──────────────────────────────────────────────────

// The panel's documents view (sidepanel-documents.js) reads and edits CV
// versions, cover letters, the email, files and the portfolio summary — a
// dozen endpoints that need nothing beyond apiFetchJson, so they share the
// 'api' proxy action instead of a handler apiece. A PDF can't cross
// sendMessage as a Blob, so it comes back as a data: URL.
async function fetchPdfDataUrl(path) {
  const res = await apiFetch(path);
  if (!res.ok) throw await errorFromResponse(res);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:application/pdf;base64,${btoa(binary)}`;
}

// Generation jobs. Saving a captured job in the panel starts the tailored CV
// and the email right away, and the documents view can (re)generate any of
// the three. A job runs here rather than in the panel so closing the panel
// doesn't lose a CV half-way. Its state lives in chrome.storage.session under
// one key per job (docJob:<applicationId>:<kind>), so jobs running side by
// side never overwrite each other's state.
//
// Each generator does what the app does across its AI dialog + editor
// (GenerateAiDialog -> createCvDraft -> CvBuilderView save, etc.), minus the
// review step: the result is saved straight away and edited afterwards.
const MIN_COMPLETION_TO_GENERATE = 80; // notehub-app's DocumentsTab gate

async function saveIntoDraft(draftPath, updatePath, applicationId, data) {
  const draft = await apiFetchJson(draftPath, { method: 'POST', body: JSON.stringify({ applicationId }) });
  try {
    await apiFetchJson(`${updatePath}/${draft.id}`, { method: 'PUT', body: JSON.stringify({ data }) });
  } catch (err) {
    // A blank draft left behind would show up as "the" tailored document.
    apiFetch(`${updatePath}/${draft.id}`, { method: 'DELETE' }).catch(() => {});
    throw err;
  }
}

const DOC_GENERATORS = {
  // `tailoring` comes back beside the schema but isn't part of a CV.
  cv: async (applicationId) => {
    const { tailoring: _tailoring, ...schema } = await apiFetchJson('/ai/cv/generate', {
      method: 'POST',
      body: JSON.stringify({ applicationId, mode: 'complete' }),
    });
    await saveIntoDraft('/cv-version/draft', '/cv-version', applicationId, schema);
  },
  coverLetter: async (applicationId) => {
    const schema = await apiFetchJson('/ai/cover-letter/generate', {
      method: 'POST',
      body: JSON.stringify({ applicationId }),
    });
    await saveIntoDraft('/cover-letter/draft', '/cover-letter', applicationId, schema);
  },
  email: async (applicationId) => {
    const { subject, body } = await apiFetchJson('/ai/application-email/generate', {
      method: 'POST',
      body: JSON.stringify({ applicationId }),
    });
    await apiFetchJson('/application-email', { method: 'PUT', body: JSON.stringify({ applicationId, subject, body }) });
  },
};

// The app only enforces this in its UI, so the same gate is checked here.
async function assertProfileReady() {
  const profile = await apiFetchJson('/profile');
  const percentage = profile?.completion?.percentage ?? 0;
  if (percentage < MIN_COMPLETION_TO_GENERATE) {
    const err = new Error(
      `Complete your Master Profile to at least ${MIN_COMPLETION_TO_GENERATE}% (currently ${percentage}%) to generate with AI.`,
    );
    err.code = 'PROFILE_INCOMPLETE';
    throw err;
  }
}

// An idle worker is stopped after 30s even with a fetch in flight, and an AI
// call can take longer than that. Any extension API call resets the idle
// timer, so one is made every 20s while a job runs.
let runningDocJobs = 0;
let keepAliveTimer = null;
function holdWorker(delta) {
  runningDocJobs += delta;
  if (runningDocJobs > 0 && !keepAliveTimer) {
    keepAliveTimer = setInterval(() => chrome.runtime.getPlatformInfo(), 20000);
  } else if (runningDocJobs === 0 && keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}

function setDocJob(applicationId, kind, state) {
  return chrome.storage.session.set({ [`docJob:${applicationId}:${kind}`]: { ...state, at: Date.now() } });
}

// Resolves once every job is marked 'generating', so a panel opening the
// documents view right after never sees the empty state first.
async function startDocuments(applicationId, kinds) {
  await Promise.all(kinds.map((kind) => setDocJob(applicationId, kind, { status: 'generating' })));
  runDocuments(applicationId, kinds);
}

async function runDocuments(applicationId, kinds) {
  holdWorker(1);
  try {
    try {
      await assertProfileReady();
    } catch (err) {
      const status = err.code === 'PROFILE_INCOMPLETE' ? 'blocked' : 'error';
      await Promise.all(kinds.map((kind) => setDocJob(applicationId, kind, { status, error: err.message })));
      return;
    }
    await Promise.all(
      kinds.map(async (kind) => {
        try {
          await DOC_GENERATORS[kind](applicationId);
          await setDocJob(applicationId, kind, { status: 'done' });
        } catch (err) {
          await setDocJob(applicationId, kind, { status: 'error', error: err.message });
        }
      }),
    );
  } finally {
    holdWorker(-1);
  }
}

// Every capture failure reaches the user the same way: an OS notification
// (the panel may be closed) plus the panel banner, both with the full reason.
async function failCapture(title, err) {
  notify(title, err.message);
  await setCaptureStatus('error', err.message);
  throw err;
}

function notify(title, message) {
  chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon128.png', title, message });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
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

  // A network failure (API down / wrong API_BASE) must still answer, or the
  // panel's startup spinner never clears. The token is kept — it may be valid.
  if (msg.action === 'checkSession') {
    checkSession()
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ authenticated: false, error: err.message }));
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
    fetchApplications(msg.search)
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

  // sender.tab is set for the LinkedIn pill and absent for the panel itself.
  if (msg.action === 'capture') {
    capture(msg.payload, sender.tab?.windowId)
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (msg.action === 'fetchCaptureReview') {
    fetchCaptureReview(msg.draftId)
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (msg.action === 'confirmCaptureDraft') {
    confirmCaptureDraft(msg.draftId, msg.application)
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // Profile fit in the panel's capture review — same endpoint as the app's
  // JobFitCheck; persists nothing.
  if (msg.action === 'analyzeJobFit') {
    apiFetchJson('/ai/job-fit/analyze', { method: 'POST', body: JSON.stringify(msg.input) })
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message, status: err.status, code: err.code }));
    return true;
  }

  if (msg.action === 'discardCaptureDraft') {
    apiFetchJson(`/application/capture/${encodeURIComponent(msg.draftId)}`, { method: 'DELETE' })
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message, status: err.status }));
    return true;
  }

  if (msg.action === 'openAppTab') {
    openOrFocusAppTab(msg.path)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: `Couldn't open Notespacehub: ${err.message}` }));
    return true;
  }

  if (msg.action === 'api') {
    const init = { method: msg.method || 'GET' };
    if (msg.body !== undefined) init.body = JSON.stringify(msg.body);
    apiFetchJson(msg.path, init)
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message, status: err.status, code: err.code }));
    return true;
  }

  if (msg.action === 'getJobSites') {
    getJobSites()
      .then((data) => sendResponse({ success: true, data }))
      .catch(() => sendResponse({ success: true, data: NSH_DEFAULT_JOB_SITES }));
    return true;
  }

  if (msg.action === 'lookupJob') {
    lookupJob(msg.query)
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message, status: err.status, code: err.code }));
    return true;
  }

  // Only the cleaned description of the one open job, already capped by the
  // panel at the API's 8,000 characters.
  if (msg.action === 'extractJobFields') {
    apiFetchJson('/application/capture/extract', { method: 'POST', body: JSON.stringify({ text: msg.text }) })
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message, status: err.status, code: err.code }));
    return true;
  }

  if (msg.action === 'saveJob') {
    saveJob(msg.job)
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message, status: err.status, code: err.code }));
    return true;
  }

  if (msg.action === 'apiPdf') {
    fetchPdfDataUrl(msg.path)
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // Answers once the jobs are marked 'generating'; they finish in the
  // background and report through chrome.storage.session.
  if (msg.action === 'generateDocuments') {
    startDocuments(msg.applicationId, msg.kinds)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
});
