// "Me" tab: the user's own details, one click away from any application form
// — a copy panel, not a profile page. Read-only: every row links to its field
// in the web app. Loaded last; uses the globals of sidepanel.js (escapeHtml,
// sendMessageAsync, openAppTab, showPanelError, showLoggedOut, signedIn,
// tabMe), sidepanel-documents.js (downloadPdf, fileUrl, safeFileName) and
// sidepanel-thispage.js (page, showToast, isSignedOut).
//
// Data: GET /me/quick-profile — one response, already flattened into
// sections of rows (notehub-api's quick-profile.rules.ts). The last answer is
// kept in chrome.storage.local and rendered at once; a refresh runs in the
// background and re-renders only when its `version` changed. While "This
// page" shows a saved job, that application's tailored answers and cover
// letters come from GET /me/quick-profile/application/:id (kept per id in
// chrome.storage.session).
//
// Kept locally: which sections are open (meOpenSections) and how often each
// row was copied (meCopyCounts). After 20 copies Quick copy switches to the
// rows copied most, unless the user has picked their own pins. The pins
// themselves are the API's (PUT /me/quick-profile/pins), so they follow the
// user to every device.

const meSearch = document.getElementById('meSearch');
const meScroll = document.getElementById('meScroll');
const meBody = document.getElementById('meBody');
const meLive = document.getElementById('meLive');

const ME_CACHE_KEY = 'meQuickProfile';
const ME_OPEN_KEY = 'meOpenSections';
const ME_COUNTS_KEY = 'meCopyCounts';
const ME_APP_CACHE_PREFIX = 'meApp:';
const ME_REFRESH_MIN_MS = 30 * 1000; // between background refreshes on tab switches
const ME_ABOUT_RECHECK_MS = 20 * 1000; // the API is rewriting the headline
const ME_AUTO_PIN_AFTER = 20; // copies
const ME_MAX_PINS = 6;
const ME_LONG_CHARS = 140; // longer, or with a line break: two lines + "more"
const ME_EMPTY_BELOW = 20; // profile completion, %
const ME_COPIED_MS = 1200;
const ME_LONG_PRESS_MS = 500;

const ME_ICON = {
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3z"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.8 9.8 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
};

function blankMe(open) {
  return {
    data: null, // GET /me/quick-profile
    status: 'loading', // 'loading' (nothing to show yet) | 'ready' | 'error'
    fetchedAt: 0,
    stale: '', // why the data on screen is the saved copy ("Offline — …"), '' when fresh
    error: '', // the load error while there is nothing to show
    signedOut: false,
    query: '',
    open: open || new Set(),
    revealed: new Set(), // sensitive rows shown
    expanded: new Set(), // long rows shown in full
    cvId: null, // the CV picked in Files; null = the default one
    generating: false, // POST /me/quick-profile/about
    app: null, // the saved job on "This page": { id, company, role, status, data, error, tailoring, tailorError }
  };
}

let me = blankMe();
let meRows = new Map(); // key → row, from the data on screen (rebuilt by indexMeRows)
let meGroups = new Map(); // group id → group
let meCounts = { counts: {}, total: 0, autoPinned: false };
let meRun = 0;
let meRefreshing = null;
let meAboutTimer = null;
let mePressTimer = null;

// ── Start / refresh ──────────────────────────────────────────────────────────

// On every sign-in (showLoggedIn): the saved copy first, then the API.
async function startMe() {
  meRun++;
  meRefreshing = null;
  me = blankMe(me.open);
  meSearch.value = '';
  let stored = {};
  try {
    stored = await chrome.storage.local.get([ME_CACHE_KEY, ME_OPEN_KEY, ME_COUNTS_KEY]);
  } catch (_) {}
  if (Array.isArray(stored[ME_OPEN_KEY])) me.open = new Set(stored[ME_OPEN_KEY]);
  if (stored[ME_COUNTS_KEY]?.counts) meCounts = stored[ME_COUNTS_KEY];
  if (stored[ME_CACHE_KEY]?.data && !me.data) {
    me.data = stored[ME_CACHE_KEY].data;
    me.status = 'ready';
  }
  renderMe();
  meSyncPage();
  refreshMe({ force: true });
}

// The tab was opened (setActiveTab): what's there now, then a quiet refresh.
function showMe() {
  renderMe();
  refreshMe();
}

function refreshMe({ force = false } = {}) {
  if (!signedIn) return Promise.resolve();
  if (meRefreshing) return meRefreshing;
  if (!force && me.fetchedAt && Date.now() - me.fetchedAt < ME_REFRESH_MIN_MS) return Promise.resolve();
  const run = meRun;
  meRefreshing = (async () => {
    try {
      const data = await sendMessageAsync({ action: 'api', path: '/me/quick-profile' });
      if (run !== meRun) return;
      const changed = me.data?.version !== data.version || me.status !== 'ready' || me.stale;
      Object.assign(me, { data, status: 'ready', fetchedAt: Date.now(), stale: '', error: '', signedOut: false });
      saveMeCache();
      if (changed) renderMe();
      scheduleAboutRecheck();
      maybeAutoPin();
    } catch (err) {
      if (run !== meRun) return;
      if (isSignedOut(err)) {
        me.signedOut = true;
      } else if (me.data) {
        me.stale = err.code === 'NETWORK' ? 'Offline — showing saved info' : 'Couldn’t refresh — showing saved info';
      } else {
        me.status = 'error';
        me.error = err.message || 'Something went wrong';
      }
      renderMe();
    } finally {
      if (run === meRun) meRefreshing = null;
    }
  })();
  return meRefreshing;
}

function saveMeCache() {
  chrome.storage.local.set({ [ME_CACHE_KEY]: { data: me.data, savedAt: Date.now() } }).catch(() => {});
}

// The API rewrites the headline and short summary in the background after
// the summary changed; one more look picks up the new text.
function scheduleAboutRecheck() {
  clearTimeout(meAboutTimer);
  if (me.data?.about?.regenerating) meAboutTimer = setTimeout(() => refreshMe({ force: true }), ME_ABOUT_RECHECK_MS);
}

// Called by sidepanel-thispage.js whenever "This page" re-renders.
function meSyncPage() {
  const saved = page.state === 'saved' && page.application ? page.application : null;
  if (!saved) {
    if (me.app) {
      me.app = null;
      renderMe();
    }
    return;
  }
  if (me.app?.id === saved.id) return;
  me.app = {
    id: saved.id,
    company: saved.company,
    role: saved.role,
    status: 'loading',
    data: null,
    error: '',
    tailoring: false,
    tailorError: '',
  };
  renderMe();
  loadMeApp(me.app);
}

async function loadMeApp(app, { force = false } = {}) {
  const key = ME_APP_CACHE_PREFIX + app.id;
  if (!force) {
    try {
      const cached = (await chrome.storage.session.get(key))[key];
      if (cached && me.app === app && !app.data) {
        app.data = cached;
        app.status = 'ready';
        renderMe();
      }
    } catch (_) {}
  }
  try {
    const data = await sendMessageAsync({
      action: 'api',
      path: `/me/quick-profile/application/${encodeURIComponent(app.id)}`,
    });
    if (me.app !== app) return;
    Object.assign(app, { data, company: data.company, role: data.role, status: 'ready', error: '' });
    chrome.storage.session.set({ [key]: data }).catch(() => {});
  } catch (err) {
    if (me.app !== app) return;
    app.status = 'error';
    app.error = err.message;
  }
  renderMe();
}

// ── Rows ─────────────────────────────────────────────────────────────────────

function indexMeRows() {
  meRows = new Map();
  meGroups = new Map();
  for (const section of me.data?.sections || []) {
    section.rows.forEach((row) => meRows.set(row.key, row));
    for (const group of section.groups || []) {
      meGroups.set(group.id, group);
      group.rows.forEach((row) => meRows.set(row.key, row));
    }
  }
  (me.app?.data?.answers || []).forEach((row) => meRows.set(row.key, row));
}

const meIsLong = (value) => value.length > ME_LONG_CHARS || value.includes('\n');

function meRowHtml(row, { tailored = false } = {}) {
  if (row.value == null) return meEmptyRowHtml(row);
  const key = escapeHtml(row.key);
  const label = escapeHtml(row.label);
  const pinned = me.data.pins.includes(row.key);
  const long = meIsLong(row.value);
  const expanded = me.expanded.has(row.key);
  const hidden = row.sensitive && !me.revealed.has(row.key);
  const classes = ['me-row', long && 'is-long', hidden && 'is-hidden', pinned && 'is-pinned'].filter(Boolean).join(' ');
  return `
    <div class="${classes}" role="button" tabindex="0" draggable="true" data-key="${key}"
         aria-label="Copy ${label}${hidden ? ' (hidden)' : ''}" title="Click to copy · drag into a form field">
      <div class="me-row-main">
        <span class="me-row-label">${tailored ? '<span class="me-tag">Tailored</span>' : ''}${label}</span>
        <span class="me-row-value${long && !expanded ? ' is-clamped' : ''}"${hidden ? ' aria-hidden="true"' : ''}>${escapeHtml(row.value)}</span>
        ${long ? `<button type="button" class="me-more" data-act="more" data-key="${key}" aria-expanded="${expanded}">${expanded ? 'less' : 'more'}</button>` : ''}
      </div>
      <div class="me-row-side">
        ${long ? `<span class="me-chars">${row.value.length} chars</span>` : ''}
        ${
          row.sensitive
            ? `<button type="button" class="me-icon" data-act="reveal" data-key="${key}" aria-pressed="${!hidden}"
                 aria-label="${hidden ? 'Show' : 'Hide'} ${label}" title="${hidden ? 'Show' : 'Hide'}">${hidden ? ME_ICON.eye : ME_ICON.eyeOff}</button>`
            : ''
        }
        <button type="button" class="me-icon me-pin" data-act="pin" data-key="${key}" aria-pressed="${pinned}"
          aria-label="${pinned ? `Unpin ${label} from` : `Pin ${label} to`} Quick copy" title="${pinned ? 'Unpin' : 'Pin to Quick copy'}">${ME_ICON.pin}</button>
        <span class="me-copy-icon" aria-hidden="true">${ME_ICON.copy}</span>
      </div>
      <span class="me-copied" aria-hidden="true">Copied ✓</span>
    </div>`;
}

// A field the user hasn't filled in: never hidden, it says what to add and
// opens that field in the web app. The headline and short summary can be
// written by the AI instead, from the summary.
function meEmptyRowHtml(row) {
  const add = escapeHtml(row.addLabel || `Add ${row.label.toLowerCase()}`);
  if (row.generate) {
    return `
      <div class="me-row me-row-empty">
        <div class="me-row-main">
          <span class="me-row-label">${escapeHtml(row.label)}</span>
          <span class="me-row-hint">Not written yet</span>
        </div>
        <div class="me-row-side">
          <button type="button" class="doc-btn" data-act="generate" data-key="${escapeHtml(row.key)}" ${me.generating ? 'disabled' : ''}
            title="Write the headline and short summary from your summary">${me.generating ? `${spinner} Writing…` : 'Generate'}</button>
          <button type="button" class="doc-link" data-act="add" data-key="${escapeHtml(row.key)}" data-url="${escapeHtml(row.editUrl)}">Write</button>
        </div>
      </div>`;
  }
  // An unanswered question keeps the question above its prompt.
  const question = row.key.startsWith('qna:') || row.key.startsWith('appqna:');
  return `
    <button type="button" class="me-row me-row-add" data-act="add" data-key="${escapeHtml(row.key)}" data-url="${escapeHtml(row.editUrl)}">
      ${question ? `<span class="me-row-label">${escapeHtml(row.label)}</span>` : ''}
      <span class="me-add-text">${add} +</span>
    </button>`;
}

function meChevron(open) {
  return `<span class="me-chevron${open ? ' is-open' : ''}" aria-hidden="true">${ME_ICON.chevron}</span>`;
}

function meSectionHtml(id, title, body, { missing = 0 } = {}) {
  const open = me.open.has(id);
  return `
    <section class="me-section">
      <button type="button" class="me-section-head" data-act="toggle" data-id="${id}" aria-expanded="${open}" aria-controls="me-sec-${id}">
        <span class="me-section-title">${escapeHtml(title)}</span>
        ${missing ? `<span class="me-missing">${missing} to add</span>` : ''}
        ${meChevron(open)}
      </button>
      <div class="me-section-body" id="me-sec-${id}"${open ? '' : ' hidden'}>${body}</div>
    </section>`;
}

function meGroupHtml(group) {
  const id = `group:${group.id}`;
  const open = me.open.has(id);
  return `
    <div class="me-group">
      <button type="button" class="me-group-head" data-act="toggle" data-id="${escapeHtml(id)}" aria-expanded="${open}">
        <span class="me-group-text">
          <span class="me-group-title">${escapeHtml(group.title)}</span>
          ${group.subtitle ? `<span class="me-group-sub">${escapeHtml(group.subtitle)}</span>` : ''}
        </span>
        ${meChevron(open)}
      </button>
      <div class="me-group-body"${open ? '' : ' hidden'}>
        ${group.copyAll ? `<button type="button" class="doc-btn me-copy-all" data-act="copy-all" data-id="${escapeHtml(group.id)}">${ME_ICON.copy} Copy all</button>` : ''}
        ${group.rows.map((row) => meRowHtml(row)).join('')}
      </div>
    </div>`;
}

const meMissing = (rows) => rows.filter((row) => row.value == null).length;

function meApiSectionHtml(section) {
  const groups = section.groups || [];
  const groupRows = groups.flatMap((group) => group.rows);
  let body;
  if (section.id === 'answers') body = meAnswersHtml(section);
  // One school needs no item of its own to open.
  else if (section.id === 'education' && groups.length === 1)
    body = [...section.rows, ...groups[0].rows].map((row) => meRowHtml(row)).join('');
  else body = section.rows.map((row) => meRowHtml(row)).join('') + groups.map(meGroupHtml).join('');
  return meSectionHtml(section.id, section.title, body, { missing: meMissing([...section.rows, ...groupRows]) });
}

function meQuickCopyHtml() {
  const rows = me.data.pins.map((key) => meRows.get(key)).filter(Boolean);
  return `
    <section class="me-section me-quick" aria-labelledby="meQuickTitle">
      <div class="me-quick-head">
        <h2 id="meQuickTitle" class="me-section-title">Quick copy</h2>
        <span class="me-hint">${rows.length}/${ME_MAX_PINS}</span>
      </div>
      <div class="me-section-body">
        ${rows.length ? rows.map((row) => meRowHtml(row)).join('') : '<p class="tp-muted">Pin up to 6 rows here with their pin icon.</p>'}
      </div>
    </section>`;
}

// With a saved job open on "This page", its tailored answers come first —
// or the button that writes them (the app's per-application Q&A generator).
function meAnswersHtml(section) {
  let html = '';
  const app = me.app;
  if (app) {
    html += `<div class="tp-banner me-for">For <strong>${escapeHtml(app.company)}</strong>${app.role ? ` · ${escapeHtml(app.role)}` : ''}</div>`;
    if (!app.data && app.status === 'loading') html += meSkeleton(2);
    else if (!app.data && app.status === 'error')
      html += `<p class="doc-error">Couldn’t load this job’s answers: ${escapeHtml(app.error)} <button type="button" class="doc-link" data-act="app-retry">Retry</button></p>`;
    else if (app.data.answers.length) html += app.data.answers.map((row) => meRowHtml(row, { tailored: true })).join('');
    else
      html += `
        <div class="me-tailor">
          <button type="button" class="doc-btn doc-btn-primary" data-act="tailor" ${app.tailoring ? 'disabled' : ''}>
            ${app.tailoring ? `${spinner} Tailoring…` : `Tailor for ${escapeHtml(app.company)}`}
          </button>
          <span class="tp-muted">Answers to likely questions for this job, from your profile.</span>
        </div>
        ${app.tailorError ? `<p class="doc-error">${escapeHtml(app.tailorError)}</p>` : ''}`;
    if (section.rows.length) html += '<p class="me-subhead">Your answers</p>';
  }
  html += section.rows.length
    ? section.rows.map((row) => meRowHtml(row)).join('')
    : `<button type="button" class="me-row me-row-add" data-act="add" data-url="/profile/qna"><span class="me-add-text">Add an answer +</span></button>`;
  return html;
}

function meFilesHtml() {
  const files = me.data.files;
  const parts = [];

  if (files.cvs.length) {
    const cvId = files.cvs.some((cv) => cv.id === me.cvId) ? me.cvId : files.favouriteCvId;
    const cv = files.cvs.find((c) => c.id === cvId) || files.cvs[0];
    parts.push(`
      <div class="me-file">
        <span class="me-row-label">CV</span>
        <div class="me-file-line">
          <select class="doc-input me-select" data-act="pick-cv" aria-label="CV version">
            ${files.cvs
              .map(
                (c) =>
                  `<option value="${escapeHtml(c.id)}"${c.id === cv.id ? ' selected' : ''}>${escapeHtml(c.name)}${c.id === files.favouriteCvId ? ' (default)' : ''}</option>`,
              )
              .join('')}
          </select>
          <button type="button" class="doc-btn" data-act="download-cv" data-id="${escapeHtml(cv.id)}">${cv.kind === 'builder' ? 'Download PDF' : 'Open file'}</button>
        </div>
      </div>`);
  } else {
    parts.push(meEmptyRowHtml({ key: 'cv', label: 'CV', value: null, editUrl: files.editUrls.cv, addLabel: 'Add a CV' }));
  }

  // The saved job's own cover letter first, when it has one.
  const tailored = me.app?.data?.coverLetters?.[0];
  if (tailored) {
    parts.push(`
      <div class="me-file">
        <span class="me-row-label"><span class="me-tag">Tailored</span>Cover letter · ${escapeHtml(me.app.company)}</span>
        <div class="me-file-line">
          <span class="me-file-name">${escapeHtml(tailored.name || tailored.fileName || 'Cover letter')}</span>
          <button type="button" class="doc-btn" data-act="download-cl">${tailored.kind === 'builder' ? 'Download PDF' : 'Open file'}</button>
        </div>
      </div>`);
  }
  if (files.coverLetter) {
    parts.push(`
      <div class="me-file">
        <span class="me-row-label">Cover letter</span>
        <div class="me-file-line">
          <span class="me-file-name">Master cover letter</span>
          <button type="button" class="doc-btn" data-act="download-master-cl">Download PDF</button>
        </div>
      </div>`);
  } else if (!tailored) {
    parts.push(
      meEmptyRowHtml({ key: 'coverLetter', label: 'Cover letter', value: null, editUrl: files.editUrls.coverLetter, addLabel: 'Add a cover letter' }),
    );
  }
  return meSectionHtml('files', 'Files', parts.join(''));
}

// ── Search ───────────────────────────────────────────────────────────────────

const meNormalize = (text) =>
  String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// Every row the tab has, the saved job's tailored answers first, each once.
function meAllRows() {
  const out = [];
  const seen = new Set();
  const push = (row, tailored = false) => {
    if (seen.has(row.key)) return;
    seen.add(row.key);
    out.push({ row, tailored });
  };
  (me.app?.data?.answers || []).forEach((row) => push(row, true));
  for (const section of me.data.sections) {
    section.rows.forEach((row) => push(row));
    (section.groups || []).forEach((group) => group.rows.forEach((row) => push(row)));
  }
  return out;
}

// By label and value: every word typed has to be in one or the other.
function meSearchHtml() {
  const words = meNormalize(me.query).split(/\s+/).filter(Boolean);
  const matches = meAllRows().filter(({ row }) => {
    const haystack = meNormalize(`${row.label} ${row.value ?? row.addLabel ?? ''}`);
    return words.every((word) => haystack.includes(word));
  });
  if (!matches.length) return `<p class="me-none">Nothing matches “${escapeHtml(me.query.trim())}”.</p>`;
  return `<div class="me-results">${matches.map(({ row, tailored }) => meRowHtml(row, { tailored })).join('')}</div>`;
}

// ── Render ───────────────────────────────────────────────────────────────────

function meSkeleton(count) {
  return Array.from(
    { length: count },
    () => '<div class="me-skel-row"><span class="tp-skel" style="width:30%"></span><span class="tp-skel" style="width:75%"></span></div>',
  ).join('');
}

function meHtml() {
  if (me.signedOut) {
    return `
      <div class="tp-empty">
        <p class="tp-empty-title">You’re signed out</p>
        <p class="tp-muted">Sign in to see your details here.</p>
        <button type="button" class="doc-btn doc-btn-primary" data-act="sign-in">Sign in</button>
      </div>`;
  }
  if (!me.data) {
    if (me.status === 'error') {
      return `
        <div class="tp-empty">
          <p class="tp-empty-title">Couldn’t load your info</p>
          <p class="tp-muted">${escapeHtml(me.error)}</p>
          <button type="button" class="doc-btn" data-act="retry">Retry</button>
        </div>`;
    }
    return `<div class="me-loading" aria-busy="true" aria-label="Loading your info">${meSkeleton(6)}</div>`;
  }

  const parts = [];
  if (me.stale) parts.push(`<p class="me-stale">${escapeHtml(me.stale)}</p>`);
  if (me.query.trim()) {
    parts.push(meSearchHtml());
  } else {
    if (me.data.completion < ME_EMPTY_BELOW) {
      parts.push(`
        <div class="tp-card me-empty-card">
          <p class="tp-title">Your profile is empty</p>
          <p class="tp-muted">Import your CV and we’ll fill this in.</p>
          <button type="button" class="doc-btn doc-btn-primary" data-act="import-cv">Import CV</button>
        </div>`);
    }
    parts.push(meQuickCopyHtml());
    me.data.sections.forEach((section) => parts.push(meApiSectionHtml(section)));
    parts.push(meFilesHtml());
  }
  parts.push(
    '<button type="button" class="doc-link me-footer" data-act="edit-profile">Edit profile in Notespacehub ↗</button>',
  );
  return parts.join('');
}

// A re-render replaces the rows, so the focused one is found again by its key.
function meFocusedTarget() {
  const el = document.activeElement;
  if (!el || !meBody.contains(el)) return null;
  return { act: el.dataset.act || null, key: el.dataset.key || null, id: el.dataset.id || null };
}

function meRestoreFocus(target) {
  if (!target) return;
  const attrs = [
    target.act ? `[data-act="${CSS.escape(target.act)}"]` : ':not([data-act])',
    target.key ? `[data-key="${CSS.escape(target.key)}"]` : '',
    target.id ? `[data-id="${CSS.escape(target.id)}"]` : '',
  ].join('');
  meBody.querySelector(attrs)?.focus({ preventScroll: true });
}

function renderMe() {
  const focus = meFocusedTarget();
  indexMeRows();
  meBody.innerHTML = meHtml();
  meRestoreFocus(focus);
}

// ── Copy ─────────────────────────────────────────────────────────────────────

async function meWriteClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    // The panel can lose focus to the page between click and write.
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    if (!ok) throw err;
  }
}

function meAnnounce(text) {
  meLive.textContent = '';
  // A new node each time, so the same message twice is read twice.
  setTimeout(() => (meLive.textContent = text), 30);
}

async function meCopy(text, label, el, key) {
  try {
    await meWriteClipboard(text);
  } catch (err) {
    showPanelError(`Couldn’t copy to the clipboard: ${err.message}`);
    return;
  }
  el.classList.add('is-copied');
  clearTimeout(el.meCopiedTimer);
  el.meCopiedTimer = setTimeout(() => el.classList.remove('is-copied'), ME_COPIED_MS);
  meAnnounce(`Copied ${label}`);
  if (key) meCountCopy(key);
}

function meCopyRow(rowEl) {
  const row = meRows.get(rowEl.dataset.key);
  if (row?.value != null) meCopy(row.value, row.label, rowEl, row.key);
}

function meCopyAll(btn) {
  const group = meGroups.get(btn.dataset.id);
  if (!group?.copyAll) return;
  meCopy(group.copyAll, group.title, btn, null).then(() => {
    if (!btn.classList.contains('is-copied')) return;
    btn.innerHTML = 'Copied ✓';
    setTimeout(() => (btn.innerHTML = `${ME_ICON.copy} Copy all`), ME_COPIED_MS);
  });
}

// ── Pins ─────────────────────────────────────────────────────────────────────

function meCountCopy(key) {
  meCounts.counts[key] = (meCounts.counts[key] || 0) + 1;
  meCounts.total += 1;
  chrome.storage.local.set({ [ME_COUNTS_KEY]: meCounts }).catch(() => {});
  maybeAutoPin();
}

// Once, after 20 copies, for a user still on the default pins: the rows they
// copy most, topped up with the defaults.
function maybeAutoPin() {
  const data = me.data;
  if (!data || data.pinsCustomised || meCounts.autoPinned || meCounts.total < ME_AUTO_PIN_AFTER) return;
  const top = Object.entries(meCounts.counts)
    .filter(([key]) => meRows.get(key)?.value != null)
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => key)
    .slice(0, ME_MAX_PINS);
  if (!top.length) return;
  meCounts.autoPinned = true;
  chrome.storage.local.set({ [ME_COUNTS_KEY]: meCounts }).catch(() => {});
  meSavePins([...top, ...data.pins.filter((key) => !top.includes(key))].slice(0, ME_MAX_PINS), { auto: true });
}

function meTogglePin(key) {
  const pins = me.data.pins;
  if (pins.includes(key)) {
    meSavePins(pins.filter((k) => k !== key));
  } else if (pins.length >= ME_MAX_PINS) {
    showToast(`Quick copy holds ${ME_MAX_PINS} rows — unpin one first`);
  } else {
    meSavePins([...pins, key]);
  }
}

// Shown at once; the API's answer (the whole profile) replaces it.
async function meSavePins(pins, { auto = false } = {}) {
  const data = me.data;
  const before = { pins: data.pins, pinsCustomised: data.pinsCustomised };
  data.pins = pins;
  data.pinsCustomised = true;
  renderMe();
  try {
    const fresh = await sendMessageAsync({ action: 'api', method: 'PUT', path: '/me/quick-profile/pins', body: { pins } });
    if (me.data !== data) return;
    me.data = fresh;
    saveMeCache();
    renderMe();
    if (auto) showToast('Quick copy now shows the rows you copy most');
  } catch (err) {
    if (me.data !== data) return;
    Object.assign(data, before);
    if (auto) meCounts.autoPinned = false;
    renderMe();
    showToast(`Couldn’t save your pins: ${err.message}`);
  }
}

// ── Actions ──────────────────────────────────────────────────────────────────

function meToggleOpen(id) {
  if (me.open.has(id)) me.open.delete(id);
  else me.open.add(id);
  chrome.storage.local.set({ [ME_OPEN_KEY]: [...me.open] }).catch(() => {});
  renderMe();
}

async function meGenerateAbout() {
  if (me.generating) return;
  me.generating = true;
  renderMe();
  try {
    me.data = await sendMessageAsync({ action: 'api', method: 'POST', path: '/me/quick-profile/about' });
    saveMeCache();
  } catch (err) {
    showPanelError(err.message);
  } finally {
    me.generating = false;
    renderMe();
  }
}

// The app's own "Generate with AI" for an application's Q&A (HR questions:
// motivation, salary, notice period — what application forms ask).
async function meTailor() {
  const app = me.app;
  if (!app || app.tailoring) return;
  app.tailoring = true;
  app.tailorError = '';
  renderMe();
  try {
    await sendMessageAsync({
      action: 'api',
      method: 'POST',
      path: '/ai/qna/generate-for-application',
      body: { applicationId: app.id, mode: 'hr' },
    });
    if (me.app === app) await loadMeApp(app, { force: true });
  } catch (err) {
    if (me.app === app) app.tailorError = err.message;
  } finally {
    app.tailoring = false;
    if (me.app === app) renderMe();
  }
}

function meOpenFile(key, fallbackPath) {
  const url = fileUrl(key);
  if (url) chrome.tabs.create({ url });
  else openAppTab(fallbackPath);
}

function meDownloadCv(btn) {
  const cv = me.data.files.cvs.find((c) => c.id === btn.dataset.id);
  if (!cv) return;
  if (cv.kind === 'builder') downloadPdf(`/cv-version/${encodeURIComponent(cv.id)}/pdf`, safeFileName(cv.name, 'cv'), btn);
  else meOpenFile(cv.fileKey, me.data.files.editUrls.cv);
}

function meDownloadTailoredLetter(btn) {
  const letter = me.app?.data?.coverLetters?.[0];
  if (!letter) return;
  if (letter.kind === 'builder')
    downloadPdf(`/cover-letter/${encodeURIComponent(letter.id)}/pdf`, safeFileName(letter.name, 'cover-letter'), btn);
  else meOpenFile(letter.fileKey, `/applications/${me.app.id}`);
}

function meAct(el) {
  const { act, key, id } = el.dataset;
  switch (act) {
    case 'toggle':
      meToggleOpen(id);
      break;
    case 'more':
      if (me.expanded.has(key)) me.expanded.delete(key);
      else me.expanded.add(key);
      renderMe();
      break;
    case 'reveal':
      if (me.revealed.has(key)) me.revealed.delete(key);
      else me.revealed.add(key);
      renderMe();
      break;
    case 'pin':
      meTogglePin(key);
      break;
    case 'add':
      openAppTab(el.dataset.url);
      break;
    case 'generate':
      meGenerateAbout();
      break;
    case 'copy-all':
      meCopyAll(el);
      break;
    case 'tailor':
      meTailor();
      break;
    case 'app-retry':
      if (me.app) loadMeApp(me.app, { force: true });
      break;
    case 'retry':
      me.status = 'loading';
      renderMe();
      refreshMe({ force: true });
      break;
    case 'sign-in':
      showLoggedOut();
      break;
    case 'import-cv':
      openAppTab('/profile?import=cv');
      break;
    case 'edit-profile':
      openAppTab('/profile');
      break;
    case 'download-cv':
      meDownloadCv(el);
      break;
    case 'download-cl':
      meDownloadTailoredLetter(el);
      break;
    case 'download-master-cl':
      downloadPdf('/cover-letter/master/pdf', 'cover-letter', el);
      break;
  }
}

// ── Events ───────────────────────────────────────────────────────────────────

meBody.addEventListener('click', (e) => {
  const actEl = e.target.closest('[data-act]');
  if (actEl && meBody.contains(actEl)) {
    if (actEl.tagName !== 'SELECT' && !actEl.disabled) meAct(actEl);
    return;
  }
  const rowEl = e.target.closest('.me-row[data-key]');
  if (!rowEl) return;
  // The click that ends a long press only showed the row's buttons.
  if (rowEl.dataset.pressed) {
    delete rowEl.dataset.pressed;
    return;
  }
  meCopyRow(rowEl);
});

meBody.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const rowEl = e.target.closest?.('.me-row[data-key]');
  if (!rowEl || e.target !== rowEl || rowEl.tagName === 'BUTTON') return;
  e.preventDefault();
  meCopyRow(rowEl);
});

meBody.addEventListener('change', (e) => {
  if (e.target.dataset.act !== 'pick-cv') return;
  me.cvId = e.target.value;
  renderMe();
});

// Dropped onto a field in the page, the value is typed into it.
meBody.addEventListener('dragstart', (e) => {
  const rowEl = e.target.closest?.('.me-row[data-key]');
  const row = rowEl && meRows.get(rowEl.dataset.key);
  if (row?.value == null) {
    e.preventDefault();
    return;
  }
  e.dataTransfer.setData('text/plain', row.value);
  e.dataTransfer.effectAllowed = 'copy';
  meCountCopy(row.key);
});

// Touch has no hover: a long press shows the row's pin (and eye) instead.
meBody.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'touch') return;
  const rowEl = e.target.closest('.me-row[data-key]');
  if (!rowEl) return;
  clearTimeout(mePressTimer);
  mePressTimer = setTimeout(() => {
    rowEl.classList.add('show-actions');
    rowEl.dataset.pressed = '1';
  }, ME_LONG_PRESS_MS);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach((type) =>
  meBody.addEventListener(type, () => clearTimeout(mePressTimer)),
);

meSearch.addEventListener('input', () => {
  me.query = meSearch.value;
  renderMe();
  meScroll.scrollTop = 0;
});

meSearch.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !meSearch.value) return;
  e.preventDefault();
  meSearch.value = '';
  me.query = '';
  renderMe();
});

const meTyping = (el) => el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

document.addEventListener('keydown', (e) => {
  if (tabMe.style.display === 'none' || viewLoggedIn.style.display === 'none') return;
  if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !meTyping(e.target)) {
    e.preventDefault();
    meSearch.focus();
    meSearch.select();
  } else if (e.key === 'Escape' && me.query && e.target !== meSearch) {
    meSearch.value = '';
    me.query = '';
    renderMe();
  }
});

window.addEventListener('focus', () => {
  if (signedIn && tabMe.style.display !== 'none') refreshMe();
});
