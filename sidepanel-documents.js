// Application documents view and its editors — the panel's copy of
// notehub-app's DocumentsTab: tailored CV, cover letter, Email Apply,
// portfolio link and additional files. Loaded after sidepanel.js and uses its
// globals (esc, timeAgo, sendMessageAsync, openAppTab, showPanelError,
// ALL_VIEWS, loadRecentApplications).
//
// Generating runs in background.js (startDocuments), not here, so a CV
// half-way through survives the panel closing. This file renders each job's
// state from chrome.storage.session (docJob:<applicationId>:<kind>) and the
// documents themselves from the API.

// ── DOM refs ──────────────────────────────────────────────────────────────────
const viewAppDocs = document.getElementById('view-app-docs');
const appDocsBackBtn = document.getElementById('appDocsBackBtn');
const appDocsRole = document.getElementById('appDocsRole');
const appDocsCompany = document.getElementById('appDocsCompany');
const appDocsOpenAppBtn = document.getElementById('appDocsOpenAppBtn');
const appDocsBody = document.getElementById('appDocsBody');

const viewCvEdit = document.getElementById('view-cv-edit');
const cvEditBackBtn = document.getElementById('cvEditBackBtn');
const cvEditSaveBtn = document.getElementById('cvEditSaveBtn');
const cvEditError = document.getElementById('cvEditError');
const cvEditBody = document.getElementById('cvEditBody');

const viewClEdit = document.getElementById('view-cl-edit');
const clEditBackBtn = document.getElementById('clEditBackBtn');
const clEditSaveBtn = document.getElementById('clEditSaveBtn');
const clEditError = document.getElementById('clEditError');
const clEditSalutation = document.getElementById('clEditSalutation');
const clEditBodyInput = document.getElementById('clEditBodyInput');
const clEditClosing = document.getElementById('clEditClosing');

const viewEmailEdit = document.getElementById('view-email-edit');
const emailEditBackBtn = document.getElementById('emailEditBackBtn');
const emailEditSaveBtn = document.getElementById('emailEditSaveBtn');
const emailEditError = document.getElementById('emailEditError');
const emailEditSubject = document.getElementById('emailEditSubject');
const emailEditBodyInput = document.getElementById('emailEditBodyInput');
const emailEditBackdrop = document.getElementById('emailEditBackdrop');
const emailEditHint = document.getElementById('emailEditHint');
const emailEditCopySubjectBtn = document.getElementById('emailEditCopySubjectBtn');
const emailEditCopyBodyBtn = document.getElementById('emailEditCopyBodyBtn');

// So a capture review arriving over any of these hides and restores it like
// the other views (see openCaptureReviewView).
ALL_VIEWS.push(viewAppDocs, viewCvEdit, viewClEdit, viewEmailEdit);
const DOC_EDITOR_VIEWS = [viewCvEdit, viewClEdit, viewEmailEdit];

// ── Constants ─────────────────────────────────────────────────────────────────
const DOC_KINDS = ['cv', 'coverLetter', 'email'];
const MIN_COMPLETION_TO_GENERATE = 80; // notehub-app's DocumentsTab gate
const STEP_INTERVAL_MS = 2200;
// A job still 'generating' after this long was cut off (the worker was
// stopped, the browser closed) and will never report back.
const STALE_JOB_MS = 5 * 60 * 1000;
const GHOST_LINES = ['34%', '96%', '88%', '62%', '92%', '74%'];
const GENERATING_STEPS = {
  cv: ['Reading the job description…', 'Going through your Master Profile…', 'Picking your most relevant experience…', 'Writing your tailored CV…'],
  coverLetter: ['Reading the job description…', 'Going through your Master Profile…', 'Finding what makes you a fit…', 'Writing your cover letter…'],
  email: ['Reading the job description…', 'Going through your Master Profile…', 'Picking your most relevant experience…', 'Writing your email…'],
};
// Same contract as notehub-app's email-template.ts: a detail the AI had no
// source for is left in square brackets for the user to fill in.
const PLACEHOLDER_PATTERN = /\[[^[\]\n]+\]/g;

// ── Helpers ───────────────────────────────────────────────────────────────────
function api(method, path, body) {
  return sendMessageAsync({ action: 'api', method, path, body });
}

// esc() leaves quotes alone, which an attribute value needs escaped.
function escAttr(str) {
  return esc(str).replace(/"/g, '&quot;');
}

function docJobKey(applicationId, kind) {
  return `docJob:${applicationId}:${kind}`;
}

function countPlaceholders(text) {
  return (text || '').match(PLACEHOLDER_PATTERN)?.length ?? 0;
}

function fileUrl(key) {
  return key && R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : '';
}

function safeFileName(name, fallback) {
  return (name || fallback).replace(/[^a-z0-9-_]+/gi, '-');
}

function autogrow(el) {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight + 2}px`;
}

async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    const label = btn.dataset.label || btn.textContent;
    btn.dataset.label = label;
    btn.textContent = 'Copied ✓';
    setTimeout(() => (btn.textContent = label), 2000);
  } catch (err) {
    showPanelError(`Couldn't copy to clipboard: ${err.message}`);
  }
}

// A PDF comes from the worker as a data: URL (see fetchPdfDataUrl there).
async function downloadPdf(path, fileName, btn) {
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Preparing…';
  try {
    const dataUrl = await sendMessageAsync({ action: 'apiPdf', path });
    const blob = await (await fetch(dataUrl)).blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch (err) {
    showPanelError(`Couldn't download the PDF: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}

function setEditorError(el, message) {
  el.textContent = message || '';
  el.style.display = message ? 'block' : 'none';
}

// ── Documents view ────────────────────────────────────────────────────────────

// The application on screen and everything fetched for it; null while the
// view is closed. A document is undefined while loading, null when missing.
let docs = null;
let docsReturnView = null;
let docsStepTimer = null;

async function showApplicationDocuments(app) {
  const current = ALL_VIEWS.find((v) => v.style.display !== 'none');
  if (current && current !== viewAppDocs && !DOC_EDITOR_VIEWS.includes(current)) docsReturnView = current;
  ALL_VIEWS.forEach((v) => (v.style.display = 'none'));
  viewAppDocs.style.display = 'flex';
  appDocsBody.scrollTop = 0;

  docs = { app, loading: true, jobs: {}, errors: {}, revealed: {} };
  appDocsRole.textContent = app.role || 'Untitled role';
  appDocsCompany.textContent = app.company || '';
  renderDocs();
  await loadDocs(app.id);
}

function closeApplicationDocuments() {
  docs = null;
  syncGeneratingSteps();
  viewAppDocs.style.display = 'none';
  (docsReturnView || viewLoggedIn).style.display = 'flex';
  docsReturnView = null;
  loadRecentApplications();
}

// Editors drop back here; `refresh` reloads the document they changed.
function returnToDocs(refresh) {
  DOC_EDITOR_VIEWS.forEach((v) => (v.style.display = 'none'));
  viewAppDocs.style.display = 'flex';
  if (refresh) refreshDoc(refresh);
  else renderDocs();
}

const DOC_LOADERS = {
  cv: async (q) => (await api('GET', `/cv-version?applicationId=${q}&limit=1`))?.[0] ?? null,
  coverLetter: async (q) => (await api('GET', `/cover-letter?applicationId=${q}`))?.[0] ?? null,
  // The API answers { data: null } when there's no email, which
  // apiFetchJson's `result.data || result` unwrap turns into the envelope.
  email: async (q) => {
    const email = await api('GET', `/application-email?applicationId=${q}`);
    return email?.id ? email : null;
  },
  files: async (q) => (await api('GET', `/application-file?applicationId=${q}`)) || [],
};

async function loadDocs(applicationId) {
  const q = encodeURIComponent(applicationId);
  const keys = Object.keys(DOC_LOADERS);
  const [loaded, portfolio, profile, jobs] = await Promise.all([
    Promise.allSettled(keys.map((key) => DOC_LOADERS[key](q))),
    // Fails when the portfolio feature is off — the section is then hidden,
    // as FeatureWrapper does in the app.
    api('GET', '/portfolio/summary').catch(() => null),
    api('GET', '/profile').catch(() => null),
    chrome.storage.session.get(DOC_KINDS.map((kind) => docJobKey(applicationId, kind))),
  ]);
  if (docs?.app.id !== applicationId) return;

  keys.forEach((key, i) => {
    if (loaded[i].status === 'fulfilled') docs[key] = loaded[i].value;
    else docs.errors[key] = loaded[i].reason?.message || 'Failed to load';
  });
  docs.portfolio = portfolio;
  docs.completion = profile?.completion?.percentage ?? null;
  DOC_KINDS.forEach((kind) => (docs.jobs[kind] = jobs[docJobKey(applicationId, kind)] || null));
  docs.loading = false;
  renderDocs();
}

async function refreshDoc(kind) {
  if (!docs) return;
  const applicationId = docs.app.id;
  try {
    const value = await DOC_LOADERS[kind](encodeURIComponent(applicationId));
    if (docs?.app.id !== applicationId) return;
    docs[kind] = value;
    delete docs.errors[kind];
    docs.revealed[kind] = true;
  } catch (err) {
    if (docs?.app.id !== applicationId) return;
    docs.errors[kind] = err.message;
  }
  renderDocs();
}

function activeJob(kind) {
  const job = docs?.jobs[kind];
  if (job?.status === 'generating' && Date.now() - job.at > STALE_JOB_MS) {
    return { status: 'error', error: 'Generating was interrupted — try again.' };
  }
  return job || null;
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'session' || !docs) return;
  for (const kind of DOC_KINDS) {
    const change = changes[docJobKey(docs.app.id, kind)];
    if (!change) continue;
    docs.jobs[kind] = change.newValue || null;
    if (change.newValue?.status === 'done') refreshDoc(kind);
    else renderDocs();
  }
});

// ── Rendering ─────────────────────────────────────────────────────────────────

function stepText(kind) {
  const steps = GENERATING_STEPS[kind];
  const elapsed = Date.now() - (docs?.jobs[kind]?.at || Date.now());
  return steps[Math.min(Math.floor(elapsed / STEP_INTERVAL_MS), steps.length - 1)];
}

// One timer walks every generating card through its steps, and re-renders
// once a job turns stale.
function syncGeneratingSteps() {
  const generating = !!docs && DOC_KINDS.some((kind) => activeJob(kind)?.status === 'generating');
  if (generating && !docsStepTimer) {
    docsStepTimer = setInterval(() => {
      if (!docs || DOC_KINDS.some((kind) => docs.jobs[kind]?.status === 'generating' && activeJob(kind).status !== 'generating')) {
        renderDocs();
        return;
      }
      appDocsBody.querySelectorAll('[data-step-kind]').forEach((el) => (el.textContent = stepText(el.dataset.stepKind)));
    }, 1000);
  } else if (!generating && docsStepTimer) {
    clearInterval(docsStepTimer);
    docsStepTimer = null;
  }
}

function generatingBlock(kind) {
  return `
    <div class="doc-generating" role="status" aria-live="polite">
      <span class="doc-generating-step"><span class="doc-generating-dot"></span><span data-step-kind="${kind}">${esc(stepText(kind))}</span></span>
      ${GHOST_LINES.map((width, i) => `<span class="doc-ghost-line" style="width:${width};animation-delay:${i * 0.12}s"></span>`).join('')}
    </div>`;
}

function card(title, description, body) {
  return `
    <section class="doc-card">
      <div class="doc-card-head">
        <div class="flex flex-col min-w-0">
          <h3 class="doc-card-title">${esc(title)}</h3>
          ${description ? `<p class="doc-card-desc">${esc(description)}</p>` : ''}
        </div>
      </div>
      ${body}
    </section>`;
}

function profileGate() {
  if (docs.completion == null || docs.completion >= MIN_COMPLETION_TO_GENERATE) return null;
  return `Complete your Master Profile to at least ${MIN_COMPLETION_TO_GENERATE}% (currently ${docs.completion}%) to generate with AI.`;
}

// A failed or blocked job, under whatever the card otherwise shows.
function jobNotice(kind) {
  const job = activeJob(kind);
  if (job?.status === 'error') {
    return `<p class="doc-error">Couldn't generate: ${esc(job.error)}</p>`;
  }
  if (job?.status === 'blocked' && !profileGate()) {
    return `<p class="doc-warning">${esc(job.error)}</p>`;
  }
  return '';
}

function generateButton(kind, label, primary) {
  const disabled = !!profileGate();
  return `<button class="doc-btn${primary ? ' doc-btn-primary' : ''}" data-action="generate" data-kind="${kind}" ${disabled ? 'disabled' : ''}>${label}</button>`;
}

function fileRow(name, meta, reveal) {
  return `
    <div class="doc-file${reveal ? ' doc-reveal' : ''}">
      <div class="flex flex-col min-w-0">
        <p class="doc-file-name">${esc(name)}</p>
        ${meta ? `<p class="doc-file-meta">${esc(meta)}</p>` : ''}
      </div>
    </div>`;
}

// Tailored CV and cover letter share a shape: a schema the panel can edit and
// export, or an uploaded file it can only open.
function builtDocCard(kind, { title, description, emptyText, fallbackName }) {
  const doc = docs[kind];
  let body;
  if (activeJob(kind)?.status === 'generating') {
    body = generatingBlock(kind);
  } else if (docs.errors[kind]) {
    body = `<p class="doc-error">Couldn't load: ${esc(docs.errors[kind])}</p>`;
  } else if (doc) {
    const built = !!doc.schemaData;
    const name = doc.name || doc.fileName || fallbackName;
    body = `
      ${fileRow(name, `${built ? 'Updated' : 'Uploaded'} ${timeAgo(doc.updatedAt)}`, docs.revealed[kind])}
      <div class="doc-actions">
        ${built ? `<button class="doc-btn doc-btn-primary" data-action="download" data-kind="${kind}">Download PDF</button>` : ''}
        ${built ? `<button class="doc-btn" data-action="edit" data-kind="${kind}">Edit</button>` : ''}
        ${!built && doc.fileKey ? `<button class="doc-btn" data-action="open-file" data-key="${escAttr(doc.fileKey)}">Open file</button>` : ''}
        ${generateButton(kind, 'Regenerate')}
      </div>`;
  } else {
    body = `
      <p class="doc-muted">${esc(emptyText)}</p>
      <div class="doc-actions">${generateButton(kind, 'Generate with AI', true)}</div>`;
  }
  return card(title, description, body + jobNotice(kind));
}

function emailCard() {
  const email = docs.email;
  let body;
  if (activeJob('email')?.status === 'generating') {
    body = generatingBlock('email');
  } else if (docs.errors.email) {
    body = `<p class="doc-error">Couldn't load: ${esc(docs.errors.email)}</p>`;
  } else if (email) {
    const left = countPlaceholders(email.subject) + countPlaceholders(email.body);
    body = `
      <div class="flex flex-col gap-1${docs.revealed.email ? ' doc-reveal' : ''}">
        <p class="text-xs font-semibold text-gray-900" style="overflow-wrap:anywhere">${esc(email.subject)}</p>
        <p class="doc-email-preview">${esc(email.body)}</p>
      </div>
      ${left ? `<p class="doc-warning">${left} placeholder${left === 1 ? '' : 's'} left to fill in — use Edit to replace ${left === 1 ? 'it' : 'them'}.</p>` : ''}
      <div class="doc-actions">
        <button class="doc-btn doc-btn-primary" data-action="email-copy">Copy email</button>
        <button class="doc-btn" data-action="edit" data-kind="email">Edit</button>
        ${generateButton('email', 'Regenerate')}
      </div>`;
  } else {
    body = `
      <p class="doc-muted">No application email yet.</p>
      <div class="doc-actions">${generateButton('email', 'Generate with AI', true)}</div>`;
  }
  return card('Email Apply', 'The email to send with your application.', body + jobNotice('email'));
}

function portfolioCard() {
  const summary = docs.portfolio;
  if (!summary) return '';
  const shareable = summary.slug && summary.visibility !== 'private';
  const body = shareable
    ? `
      ${fileRow(`${APP_BASE}/p/${summary.slug}`, '')}
      <div class="doc-actions">
        <button class="doc-btn" data-action="portfolio-copy">Copy link</button>
        <button class="doc-btn" data-action="portfolio-open">Open</button>
      </div>`
    : `
      <p class="doc-muted">Your portfolio is private, so there's no link to share yet.</p>
      <button class="doc-link" data-action="open-app-path" data-path="/profile/portfolio">Portfolio settings →</button>`;
  return card('Portfolio', '', body);
}

function filesCard() {
  let body;
  if (docs.errors.files) {
    body = `<p class="doc-error">Couldn't load: ${esc(docs.errors.files)}</p>`;
  } else if (!docs.files?.length) {
    body = `<p class="doc-muted">No additional files.</p>`;
  } else {
    body = docs.files
      .map(
        (file) => `
        <button class="doc-file cursor-pointer text-left" data-action="open-file" data-key="${escAttr(file.fileKey)}" title="Open ${escAttr(file.fileName)}">
          <div class="flex flex-col min-w-0">
            <p class="doc-file-name">${esc(file.fileName)}</p>
            <p class="doc-file-meta">${file.sizeInMb ? `${esc(file.sizeInMb)} MB · ` : ''}${esc(timeAgo(file.createdAt))}</p>
          </div>
        </button>`,
      )
      .join('');
  }
  return card(
    'Additional files',
    'Portfolio, references, take-home tasks.',
    `${body}<button class="doc-link" data-action="open-app-path" data-path="/applications/${escAttr(docs.app.id)}">Upload or manage files in Notespacehub →</button>`,
  );
}

function renderDocs() {
  syncGeneratingSteps();
  if (!docs) return;
  if (docs.loading) {
    appDocsBody.innerHTML = `
      <div class="flex items-center justify-center h-40">
        <div class="w-4 h-4 border-2 border-gray-200 border-t-gray-700 rounded-full animate-spin"></div>
      </div>`;
    return;
  }
  const gate = profileGate();
  appDocsBody.innerHTML = [
    gate
      ? `<p class="doc-warning">${esc(gate)} <button class="doc-link" data-action="open-app-path" data-path="/profile">Open Master Profile →</button></p>`
      : '',
    builtDocCard('cv', {
      title: 'Tailored CV',
      description: 'Your Master Profile tailored to this role, in full detail.',
      emptyText: 'No tailored CV yet.',
      fallbackName: 'Tailored CV',
    }),
    builtDocCard('coverLetter', {
      title: 'Cover letter',
      description: 'Written for this role from your Master Profile.',
      emptyText: 'No cover letter yet.',
      fallbackName: 'Cover letter',
    }),
    emailCard(),
    portfolioCard(),
    filesCard(),
  ].join('');
  // A reveal plays once, on the render right after the document arrived.
  docs.revealed = {};
}

// ── Documents view events ─────────────────────────────────────────────────────

async function generateDoc(kind) {
  if (!docs) return;
  docs.jobs[kind] = { status: 'generating', at: Date.now() };
  renderDocs();
  try {
    await sendMessageAsync({ action: 'generateDocuments', applicationId: docs.app.id, kinds: [kind] });
  } catch (err) {
    if (!docs) return;
    docs.jobs[kind] = { status: 'error', error: err.message, at: Date.now() };
    renderDocs();
  }
}

function openFile(key) {
  const url = fileUrl(key);
  if (url) chrome.tabs.create({ url });
  else openAppTab(`/applications/${docs.app.id}`);
}

const DOC_PDF_PATH = { cv: '/cv-version', coverLetter: '/cover-letter' };

appDocsBody.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn || btn.disabled || !docs) return;
  const { action, kind } = btn.dataset;

  if (action === 'generate') generateDoc(kind);
  else if (action === 'download') {
    const doc = docs[kind];
    downloadPdf(`${DOC_PDF_PATH[kind]}/${doc.id}/pdf`, safeFileName(doc.name, kind === 'cv' ? 'cv' : 'cover-letter'), btn);
  } else if (action === 'edit') {
    if (kind === 'cv') openCvEditor(docs.cv);
    else if (kind === 'coverLetter') openCoverLetterEditor(docs.coverLetter);
    else openEmailEditor(docs.email);
  } else if (action === 'email-copy') copyText(docs.email.body, btn);
  else if (action === 'open-file') openFile(btn.dataset.key);
  else if (action === 'open-app-path') openAppTab(btn.dataset.path);
  else if (action === 'portfolio-copy') copyText(`${APP_BASE}/p/${docs.portfolio.slug}`, btn);
  else if (action === 'portfolio-open') chrome.tabs.create({ url: `${APP_BASE}/p/${docs.portfolio.slug}` });
});

appDocsBackBtn.addEventListener('click', closeApplicationDocuments);
appDocsOpenAppBtn.addEventListener('click', () => docs && openAppTab(`/applications/${docs.app.id}`));

// ── Editors: shared leave guard ──────────────────────────────────────────────
// No confirm() in the panel: the first Back with unsaved changes warns, the
// second one discards them.
let leaveArmed = false;

function guardedLeave(isDirty, errorEl) {
  if (isDirty && !leaveArmed) {
    leaveArmed = true;
    setEditorError(errorEl, 'You have unsaved changes — press back again to discard them.');
    return false;
  }
  leaveArmed = false;
  return true;
}

function showEditorView(view) {
  leaveArmed = false;
  ALL_VIEWS.forEach((v) => (v.style.display = 'none'));
  view.style.display = 'flex';
}

// ── Tailored CV editor ────────────────────────────────────────────────────────
// A form over the same CvSchema the app's CV Builder edits; saving PUTs it
// back whole, as CvBuilderView does. Text keeps the **bold** / _italic_
// markdown-lite the PDF renders.

let cvEdit = null; // { id, name, schema, saved }

const CV_LIST_SECTIONS = [
  {
    key: 'experience',
    title: 'Experience',
    entryLabel: 'Position',
    blank: () => ({ organization: '', title: '', location: '', startDate: '', endDate: '', bullets: [] }),
    rows: [
      [{ field: 'title', placeholder: 'Role' }, { field: 'organization', placeholder: 'Company' }],
      [{ field: 'location', placeholder: 'Location' }],
      [{ field: 'startDate', placeholder: 'Start' }, { field: 'endDate', placeholder: 'End' }],
      [{ field: 'bullets', placeholder: 'One achievement per line', lines: true }],
    ],
  },
  {
    key: 'projectsAndCommunity',
    title: 'Projects & community',
    entryLabel: 'Project',
    blank: () => ({ name: '', description: '' }),
    rows: [[{ field: 'name', placeholder: 'Name' }], [{ field: 'description', placeholder: 'Description', area: true }]],
  },
  {
    key: 'education',
    title: 'Education',
    entryLabel: 'Education',
    blank: () => ({ program: '', credential: '', years: '' }),
    rows: [[{ field: 'program', placeholder: 'Program / school' }], [{ field: 'credential', placeholder: 'Credential' }, { field: 'years', placeholder: 'Years' }]],
  },
  {
    key: 'skills',
    title: 'Skills',
    entryLabel: 'Skill group',
    blank: () => ({ category: '', items: '' }),
    rows: [[{ field: 'category', placeholder: 'Category' }], [{ field: 'items', placeholder: 'Skills, comma separated', area: true }]],
  },
];

function cvInput(path, value, { placeholder = '', area = false, lines = false } = {}) {
  if (area || lines) {
    const text = lines ? (value || []).join('\n') : value || '';
    return `<textarea class="doc-input doc-autogrow" rows="2" data-path="${path}"${lines ? ' data-lines="1"' : ''} placeholder="${escAttr(placeholder)}">${esc(text)}</textarea>`;
  }
  return `<input class="doc-input" type="text" data-path="${path}" placeholder="${escAttr(placeholder)}" value="${escAttr(value || '')}" />`;
}

function renderCvEditor() {
  const s = cvEdit.schema;
  const contacts = s.header.contacts
    .map(
      (contact, i) => `
      <div class="cv-entry">
        <div class="cv-entry-head">
          <span class="cv-entry-label">Contact</span>
          <button type="button" class="cv-remove" data-cv-remove="header.contacts.${i}">Remove</button>
        </div>
        <div class="cv-row">
          ${cvInput(`header.contacts.${i}.label`, contact.label, { placeholder: 'Label, e.g. jane@doe.dev' })}
          ${cvInput(`header.contacts.${i}.url`, contact.url, { placeholder: 'Link (optional)' })}
        </div>
      </div>`,
    )
    .join('');

  const lists = CV_LIST_SECTIONS.map((section) => {
    const entries = (s[section.key] || [])
      .map(
        (entry, i) => `
        <div class="cv-entry">
          <div class="cv-entry-head">
            <span class="cv-entry-label">${esc(section.entryLabel)} ${i + 1}</span>
            <button type="button" class="cv-remove" data-cv-remove="${section.key}.${i}">Remove</button>
          </div>
          ${section.rows
            .map((row) => {
              const inputs = row.map((f) => cvInput(`${section.key}.${i}.${f.field}`, entry[f.field], f)).join('');
              return row.length > 1 ? `<div class="cv-row">${inputs}</div>` : inputs;
            })
            .join('')}
        </div>`,
      )
      .join('');
    return `
      <div class="cv-section">
        <div class="cv-section-head">
          <span class="cv-section-title">${esc(section.title)}</span>
          <button type="button" class="doc-link" data-cv-add="${section.key}">+ Add</button>
        </div>
        ${entries || '<p class="doc-muted">Nothing here yet.</p>'}
      </div>`;
  }).join('');

  cvEditBody.innerHTML = `
    <p class="text-[11px] text-gray-400">**bold** and _italic_ work in any text field.</p>
    <div class="cv-section">
      <span class="cv-section-title">Header</span>
      ${cvInput('header.fullName', s.header.fullName, { placeholder: 'Full name' })}
      ${contacts}
      <button type="button" class="doc-link" data-cv-add="header.contacts">+ Add contact</button>
    </div>
    <div class="cv-section">
      <span class="cv-section-title">Summary</span>
      ${cvInput('summary', s.summary, { placeholder: 'A short professional summary', area: true })}
    </div>
    ${lists}`;
  cvEditBody.querySelectorAll('.doc-autogrow').forEach(autogrow);
  syncCvSaveButton();
}

function getCvList(path) {
  return path.split('.').reduce((obj, key) => obj[key], cvEdit.schema);
}

function setCvPath(path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((obj, key) => obj[key], cvEdit.schema)[last] = value;
}

function cvDirty() {
  return !!cvEdit && JSON.stringify(cvEdit.schema) !== cvEdit.saved;
}

function syncCvSaveButton() {
  const dirty = cvDirty();
  cvEditSaveBtn.disabled = !dirty;
  cvEditSaveBtn.textContent = dirty ? 'Save' : 'Saved';
}

// Fills in what an older or partial schema may lack, so the form can bind to
// every field.
function normalizeCvSchema(schema) {
  const s = JSON.parse(JSON.stringify(schema || {}));
  s.header = { fullName: '', contacts: [], ...(s.header || {}) };
  s.header.contacts = s.header.contacts || [];
  s.summary = s.summary || '';
  CV_LIST_SECTIONS.forEach((section) => (s[section.key] = s[section.key] || []));
  s.experience.forEach((e) => (e.bullets = e.bullets || []));
  return s;
}

async function openCvEditor(cv) {
  showEditorView(viewCvEdit);
  setEditorError(cvEditError, '');
  cvEditSaveBtn.disabled = true;
  cvEditBody.innerHTML = `
    <div class="flex items-center justify-center h-40">
      <div class="w-4 h-4 border-2 border-gray-200 border-t-gray-700 rounded-full animate-spin"></div>
    </div>`;
  cvEdit = null;
  try {
    const full = await api('GET', `/cv-version/${encodeURIComponent(cv.id)}`);
    const schema = normalizeCvSchema(full.schemaData);
    cvEdit = { id: cv.id, name: full.name, schema, saved: JSON.stringify(schema) };
    renderCvEditor();
  } catch (err) {
    cvEditBody.innerHTML = '';
    setEditorError(cvEditError, `Couldn't open the CV: ${err.message}`);
  }
}

cvEditBody.addEventListener('input', (e) => {
  const el = e.target.closest('[data-path]');
  if (!el || !cvEdit) return;
  const value = el.dataset.lines ? el.value.split('\n').map((line) => line.trim()).filter(Boolean) : el.value;
  setCvPath(el.dataset.path, value);
  if (el.classList.contains('doc-autogrow')) autogrow(el);
  leaveArmed = false;
  setEditorError(cvEditError, '');
  syncCvSaveButton();
});

cvEditBody.addEventListener('click', (e) => {
  if (!cvEdit) return;
  const add = e.target.closest('[data-cv-add]');
  const remove = e.target.closest('[data-cv-remove]');
  if (add) {
    const path = add.dataset.cvAdd;
    const section = CV_LIST_SECTIONS.find((s) => s.key === path);
    getCvList(path).push(section ? section.blank() : { label: '', url: '' });
  } else if (remove) {
    const keys = remove.dataset.cvRemove.split('.');
    const index = Number(keys.pop());
    getCvList(keys.join('.')).splice(index, 1);
  } else {
    return;
  }
  renderCvEditor();
});

cvEditSaveBtn.addEventListener('click', async () => {
  if (!cvEdit || !cvDirty()) return;
  cvEditSaveBtn.disabled = true;
  cvEditSaveBtn.textContent = 'Saving…';
  setEditorError(cvEditError, '');
  try {
    await api('PUT', `/cv-version/${encodeURIComponent(cvEdit.id)}`, { data: cvEdit.schema });
    cvEdit = null;
    returnToDocs('cv');
  } catch (err) {
    setEditorError(cvEditError, `Couldn't save: ${err.message}`);
    syncCvSaveButton();
  }
});

cvEditBackBtn.addEventListener('click', () => {
  if (!guardedLeave(cvDirty(), cvEditError)) return;
  cvEdit = null;
  returnToDocs();
});

// ── Cover letter editor ───────────────────────────────────────────────────────
// Salutation, body and closing of the CoverLetterSchema; the header (the
// contact block from the Master Profile) is kept as it is.

let clEdit = null; // { id, schema, saved }

function clCurrent() {
  return {
    ...clEdit.schema,
    salutation: clEditSalutation.value,
    body: clEditBodyInput.value
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean),
    closing: clEditClosing.value,
  };
}

function clDirty() {
  return !!clEdit && JSON.stringify(clCurrent()) !== clEdit.saved;
}

function syncClSaveButton() {
  const dirty = clDirty();
  clEditSaveBtn.disabled = !dirty;
  clEditSaveBtn.textContent = dirty ? 'Save' : 'Saved';
}

async function openCoverLetterEditor(coverLetter) {
  showEditorView(viewClEdit);
  setEditorError(clEditError, '');
  clEdit = null;
  [clEditSalutation, clEditBodyInput, clEditClosing].forEach((el) => {
    el.value = '';
    el.disabled = true;
  });
  clEditSaveBtn.disabled = true;
  try {
    const full = await api('GET', `/cover-letter/${encodeURIComponent(coverLetter.id)}`);
    const schema = { header: { fullName: '', contacts: [] }, salutation: '', body: [], closing: '', ...(full.schemaData || {}) };
    clEditSalutation.value = schema.salutation;
    clEditBodyInput.value = (schema.body || []).join('\n\n');
    clEditClosing.value = schema.closing;
    [clEditSalutation, clEditBodyInput, clEditClosing].forEach((el) => (el.disabled = false));
    clEdit = { id: coverLetter.id, schema };
    // Compared through clCurrent() so the paragraph split round-trips.
    clEdit.saved = JSON.stringify(clCurrent());
    [clEditBodyInput, clEditClosing].forEach(autogrow);
    syncClSaveButton();
  } catch (err) {
    setEditorError(clEditError, `Couldn't open the cover letter: ${err.message}`);
  }
}

[clEditSalutation, clEditBodyInput, clEditClosing].forEach((el) =>
  el.addEventListener('input', () => {
    if (el.classList.contains('doc-autogrow')) autogrow(el);
    leaveArmed = false;
    setEditorError(clEditError, '');
    if (clEdit) syncClSaveButton();
  }),
);

clEditSaveBtn.addEventListener('click', async () => {
  if (!clEdit || !clDirty()) return;
  clEditSaveBtn.disabled = true;
  clEditSaveBtn.textContent = 'Saving…';
  setEditorError(clEditError, '');
  try {
    await api('PUT', `/cover-letter/${encodeURIComponent(clEdit.id)}`, { data: clCurrent() });
    clEdit = null;
    returnToDocs('coverLetter');
  } catch (err) {
    setEditorError(clEditError, `Couldn't save: ${err.message}`);
    syncClSaveButton();
  }
});

clEditBackBtn.addEventListener('click', () => {
  if (!guardedLeave(clDirty(), clEditError)) return;
  clEdit = null;
  returnToDocs();
});

// ── Email Apply editor ────────────────────────────────────────────────────────
// The panel's take on the app's EmailApplyDialog: placeholders are
// highlighted, a click on one selects all of it so typing replaces it, and
// Tab / Shift-Tab jump between them. A plain textarea sits over a backdrop
// that draws the highlights, so the email stays plain text throughout.

let emailEdit = null; // { applicationId, saved: { subject, body } }

function placeholderRanges(text) {
  return [...text.matchAll(PLACEHOLDER_PATTERN)].map((m) => ({ from: m.index, to: m.index + m[0].length }));
}

function renderEmailBackdrop() {
  const text = emailEditBodyInput.value;
  let html = '';
  let last = 0;
  for (const { from, to } of placeholderRanges(text)) {
    html += `${esc(text.slice(last, from))}<mark class="email-template">${esc(text.slice(from, to))}</mark>`;
    last = to;
  }
  // The zero-width space keeps a trailing empty line as tall as the
  // textarea's.
  emailEditBackdrop.innerHTML = `${html}${esc(text.slice(last))}​`;
}

function emailDirty() {
  return (
    !!emailEdit &&
    (emailEditSubject.value !== emailEdit.saved.subject || emailEditBodyInput.value !== emailEdit.saved.body)
  );
}

function syncEmailEditor() {
  renderEmailBackdrop();
  autogrow(emailEditBodyInput);
  const left = countPlaceholders(emailEditSubject.value) + countPlaceholders(emailEditBodyInput.value);
  emailEditHint.textContent = left
    ? `${left} placeholder${left === 1 ? '' : 's'} left to fill in — click one, or press Tab to jump to the next.`
    : 'No placeholders left — ready to send.';
  emailEditHint.style.color = left ? '#b45309' : '#6b7280';
  const dirty = emailDirty();
  emailEditSaveBtn.disabled = !dirty || !emailEditBodyInput.value.trim();
  emailEditSaveBtn.textContent = dirty ? 'Save' : 'Saved';
}

function openEmailEditor(email) {
  showEditorView(viewEmailEdit);
  setEditorError(emailEditError, '');
  emailEdit = { applicationId: email.applicationId, saved: { subject: email.subject, body: email.body } };
  emailEditSubject.value = email.subject;
  emailEditBodyInput.value = email.body;
  syncEmailEditor();
  // Straight to the first placeholder, if any. Setting the value leaves the
  // caret at the end, so the search starts from the top.
  emailEditBodyInput.focus();
  emailEditBodyInput.setSelectionRange(0, 0);
  jumpPlaceholder(emailEditBodyInput, 1);
}

// A click inside a placeholder selects the whole of it.
function selectPlaceholderAtCaret(el) {
  if (el.selectionStart !== el.selectionEnd) return;
  const pos = el.selectionStart;
  const range = placeholderRanges(el.value).find(({ from, to }) => pos >= from && pos <= to);
  if (range) el.setSelectionRange(range.from, range.to);
}

function jumpPlaceholder(el, direction) {
  const ranges = placeholderRanges(el.value);
  const { selectionStart: from, selectionEnd: to } = el;
  const isCurrent = (r) => r.from === from && r.to === to;
  const target =
    direction === 1
      ? ranges.find((r) => r.from >= to && !isCurrent(r))
      : [...ranges].reverse().find((r) => r.to <= from && !isCurrent(r));
  if (!target) return false;
  el.focus();
  el.setSelectionRange(target.from, target.to);
  return true;
}

[emailEditSubject, emailEditBodyInput].forEach((el) => {
  el.addEventListener('click', () => selectPlaceholderAtCaret(el));
  // No placeholder that way: Tab is left to the browser, so focus can still
  // move on.
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    if (jumpPlaceholder(el, e.shiftKey ? -1 : 1)) e.preventDefault();
  });
  el.addEventListener('input', () => {
    leaveArmed = false;
    setEditorError(emailEditError, '');
    syncEmailEditor();
  });
});

emailEditCopySubjectBtn.addEventListener('click', () => copyText(emailEditSubject.value, emailEditCopySubjectBtn));
emailEditCopyBodyBtn.addEventListener('click', () => copyText(emailEditBodyInput.value, emailEditCopyBodyBtn));

// Stays in the editor after saving — copying the finished email is what
// usually comes next.
emailEditSaveBtn.addEventListener('click', async () => {
  if (!emailEdit || !emailDirty()) return;
  const draft = { subject: emailEditSubject.value, body: emailEditBodyInput.value };
  emailEditSaveBtn.disabled = true;
  emailEditSaveBtn.textContent = 'Saving…';
  setEditorError(emailEditError, '');
  try {
    const saved = await api('PUT', '/application-email', { applicationId: emailEdit.applicationId, ...draft });
    emailEdit.saved = { subject: saved?.subject ?? draft.subject, body: saved?.body ?? draft.body };
    if (docs) docs.email = saved?.id ? saved : { ...docs.email, ...draft };
  } catch (err) {
    setEditorError(emailEditError, `Couldn't save: ${err.message}`);
  }
  syncEmailEditor();
});

emailEditBackBtn.addEventListener('click', () => {
  if (!guardedLeave(emailDirty(), emailEditError)) return;
  emailEdit = null;
  returnToDocs();
});
