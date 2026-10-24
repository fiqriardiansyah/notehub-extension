// API_BASE / APP_BASE come from config.js, loaded by sidepanel.html ahead of
// this file — see that file for the dev switch.
const MAX_IN_MB = 10;
const MAX_SIZE_FILE = 1024 * 1024 * MAX_IN_MB; // 10 MB, matches notehub-app's upload limit

// ── DOM refs ──────────────────────────────────────────────────────────────────
const viewLoading = document.getElementById('view-loading');
const viewLoggedOut = document.getElementById('view-logged-out');
const viewLoggedIn = document.getElementById('view-logged-in');
const viewNoteDetail = document.getElementById('view-note-detail');
const viewFolder = document.getElementById('view-folder');
const folderBackBtn = document.getElementById('folderBackBtn');
const folderTitle = document.getElementById('folderTitle');
const folderLoadingEl = document.getElementById('folder-loading');
const folderEmptyEl = document.getElementById('folder-empty');
const folderEmptyMsg = document.getElementById('folder-empty-msg');
const folderGrid = document.getElementById('folder-grid');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const loginError = document.getElementById('login-error');
const searchInput = document.getElementById('searchInput');
const sortBtn = document.getElementById('sortBtn');
const sortIcon = document.getElementById('sortIcon');
const tagFiltersEl = document.getElementById('tag-filters');
const notesGrid = document.getElementById('notes-grid');
const notesLoadingEl = document.getElementById('notes-loading');
const notesEmptyEl = document.getElementById('notes-empty');
const notesEmptyMsg = document.getElementById('notes-empty-msg');
const noteDetailBackBtn = document.getElementById('noteDetailBackBtn');
const noteDetailTitle = document.getElementById('noteDetailTitle');
const noteDetailDate = document.getElementById('noteDetailDate');
const noteDetailLink = document.getElementById('noteDetailLink');
const noteDetailContent = document.getElementById('noteDetailContent');
const noteDetailEditorHolder = document.getElementById('noteDetailEditorHolder');
const noteDetailAttachments = document.getElementById('noteDetailAttachments');
const noteDetailCopyBtn = document.getElementById('noteDetailCopyBtn');
const noteDetailEditBtn = document.getElementById('noteDetailEditBtn');
const viewNoteEdit = document.getElementById('view-note-edit');
const noteEditBackBtn = document.getElementById('noteEditBackBtn');
const noteEditTitle = document.getElementById('noteEditTitle');
const noteEditSaveBtn = document.getElementById('noteEditSaveBtn');
const noteEditError = document.getElementById('noteEditError');
const viewTodoEdit = document.getElementById('view-todo-edit');
const todoEditBackBtn = document.getElementById('todoEditBackBtn');
const todoEditTitle = document.getElementById('todoEditTitle');
const todoEditSaveBtn = document.getElementById('todoEditSaveBtn');
const todoEditError = document.getElementById('todoEditError');
const todoEditList = document.getElementById('todo-edit-list');
const todoAddInput = document.getElementById('todoAddInput');
const addNoteBtn = document.getElementById('addNoteBtn');
const addNoteDropdown = document.getElementById('addNoteDropdown');
const addFreetextBtn = document.getElementById('addFreetextBtn');
const addTodolistBtn = document.getElementById('addTodolistBtn');
const viewNoteCreate = document.getElementById('view-note-create');
const noteCreateBackBtn = document.getElementById('noteCreateBackBtn');
const noteCreateTitleInput = document.getElementById('noteCreateTitleInput');
const noteCreateSaveBtn = document.getElementById('noteCreateSaveBtn');
const noteCreateError = document.getElementById('noteCreateError');
const viewTodoCreate = document.getElementById('view-todo-create');
const todoCreateBackBtn = document.getElementById('todoCreateBackBtn');
const todoCreateTitleInput = document.getElementById('todoCreateTitleInput');
const todoCreateSaveBtn = document.getElementById('todoCreateSaveBtn');
const todoCreateError = document.getElementById('todoCreateError');
const todoCreateList = document.getElementById('todo-create-list');
const todoCreateAddInput = document.getElementById('todoCreateAddInput');
const appHomeLink = document.getElementById('appHomeLink');
appHomeLink.href = APP_BASE;

const captureBanner = document.getElementById('captureBanner');
const captureBannerSpinner = document.getElementById('captureBannerSpinner');
const captureBannerText = document.getElementById('captureBannerText');
const captureBannerClose = document.getElementById('captureBannerClose');

const currentTabJob = document.getElementById('currentTabJob');
const currentTabHint = document.getElementById('currentTabHint');
const currentTabTitle = document.getElementById('currentTabTitle');
const currentTabCompany = document.getElementById('currentTabCompany');
const currentTabCaptureBtn = document.getElementById('currentTabCaptureBtn');
const currentTabCaptureLabel = document.getElementById('currentTabCaptureLabel');
const applicationsLoading = document.getElementById('applications-loading');
const applicationsEmpty = document.getElementById('applications-empty');
const applicationsList = document.getElementById('applications-list');
const applicationsTableWrap = document.getElementById('applications-table-wrap');
const applicationsTodayCount = document.getElementById('applications-today-count');
const refreshBtn = document.getElementById('refreshBtn');
const tabApplicationsBtn = document.getElementById('tabApplicationsBtn');
const tabNotesBtn = document.getElementById('tabNotesBtn');
const tabApplications = document.getElementById('tab-applications');
const tabNotes = document.getElementById('tab-notes');
const viewCaptureReview = document.getElementById('view-capture-review');
const captureReviewSaveBtn = document.getElementById('captureReviewSaveBtn');
const captureReviewError = document.getElementById('captureReviewError');
const captureReviewLoading = document.getElementById('captureReviewLoading');
const captureReviewForm = document.getElementById('captureReviewForm');
const captureReviewCompany = document.getElementById('captureReviewCompany');
const captureReviewRole = document.getElementById('captureReviewRole');
const captureReviewStatus = document.getElementById('captureReviewStatus');
const captureReviewSalary = document.getElementById('captureReviewSalary');
const captureReviewLocation = document.getElementById('captureReviewLocation');
const captureReviewJobUrl = document.getElementById('captureReviewJobUrl');
const captureReviewDescription = document.getElementById('captureReviewDescription');
const captureReviewDiscardBtn = document.getElementById('captureReviewDiscardBtn');
const captureReviewOpenAppBtn = document.getElementById('captureReviewOpenAppBtn');
const captureFitHint = document.getElementById('captureFitHint');
const captureFitBusy = document.getElementById('captureFitBusy');
const captureFitRetryBtn = document.getElementById('captureFitRetryBtn');
const captureFitResult = document.getElementById('captureFitResult');

// ── State ─────────────────────────────────────────────────────────────────────
let allNotes = [];
let activeTagId = null;
let sortOrder = 'desc';
let currentNote = null;
let editorInstance = null;
let detailEditorInstance = null;
let createEditorInstance = null;
let editingTodos = [];
let creatingTodos = [];
let activeFolder = null;
let signedIn = false;
let reviewingDraft = null; // { draftId, redirectUrl } from chrome.storage.session.captureReview
let viewBeforeReview = null;

// ── Utils ─────────────────────────────────────────────────────────────────────
function extractText(doc) {
  if (!doc || typeof doc !== 'object') return '';
  const parts = [];
  function walk(node) {
    if (!node) return;
    if (node.type === 'text' && node.text) parts.push(node.text);
    if (Array.isArray(node.content)) node.content.forEach(walk);
  }
  walk(doc);
  return parts.join(' ');
}

function timeAgo(dateStr) {
  const date = new Date(dateStr);
  const diffSec = Math.floor((Date.now() - date) / 1000);
  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const m = Math.floor(diffSec / 60);
  if (m < 60) return `${m} minute${m !== 1 ? 's' : ''} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h !== 1 ? 's' : ''} ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d !== 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function convertEditorDataToText(note) {
  const blocks = note?.blocks;
  if (!blocks) return '';
  let result = '';
  blocks.forEach((block) => {
    switch (block.type) {
      case 'header':
      case 'paragraph':
        result += block.data.text + '<br />';
        break;
      case 'list':
        block.data.items.forEach((item) => { result += ' - ' + item + '<br />'; });
        result += '<br />';
        break;
      case 'linkTool':
        result += (block.data?.link || '') + '<br />';
        break;
      case 'checklist':
        block.data.items.forEach((item) => { result += ' - ' + item.text + '<br />'; });
        result += '<br />';
        break;
      case 'quote':
        result += (block.data?.text || '') + ' - ' + (block.data?.caption || '') + '<br /><br />';
        break;
      case 'image':
        if (!result.includes('image-thumbnail')) {
          result += `<img src="${block.data?.url}" class="image-thumbnail" /><br />`;
        }
        break;
      default:
        break;
    }
  });
  return result;
}

function isFolder(item) {
  return item.isHang === null || item.isHang === undefined;
}

// ── Utils (detail view) ───────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function stripInline(html) {
  return new DOMParser().parseFromString(html || '', 'text/html').body.textContent ?? '';
}

function editorJsToPlainText(data) {
  const blocks = data?.blocks;
  if (!blocks?.length) return '';
  return blocks.map((b) => {
    const d = b.data ?? {};
    switch (b.type) {
      case 'paragraph':
      case 'header':
        return stripInline(d.text);
      case 'list': {
        const ordered = d.style === 'ordered';
        return (d.items ?? []).map((it, i) => {
          const text = typeof it === 'string' ? it : it.content ?? '';
          return `${ordered ? `${i + 1}.` : '•'} ${stripInline(text)}`;
        }).join('\n');
      }
      case 'checklist':
        return (d.items ?? []).map((it) => `${it.checked ? '[x]' : '[ ]'} ${stripInline(it.text)}`).join('\n');
      case 'quote':
        return `> ${stripInline(d.text)}`;
      case 'code':
        return d.code ?? '';
      case 'table':
        return (d.content ?? []).map((row) => row.map((c) => stripInline(c)).join('\t')).join('\n');
      case 'delimiter':
        return '———';
      default:
        return '';
    }
  }).filter(Boolean).join('\n\n');
}

function todosToPlainText(todos) {
  return (todos ?? []).map((t) => `${t.isCheck ? '[x]' : '[ ]'} ${t.content ?? ''}`).join('\n');
}

// ── API ───────────────────────────────────────────────────────────────────────
function requestNotes(order) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'fetchNotes', order }, (res) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (res && res.success) {
        resolve(Array.isArray(res.data) ? res.data : []);
      } else {
        reject(new Error(res?.error || 'Failed to load notes'));
      }
    });
  });
}

function requestFolder(id, order) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'fetchFolder', id, order }, (res) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (res && res.success) {
        resolve(res.data);
      } else {
        reject(new Error(res?.error || 'Failed to load folder'));
      }
    });
  });
}

// ── Rendering ─────────────────────────────────────────────────────────────────
function collectTags(notes) {
  const map = new Map();
  notes.forEach((item) => {
    if (!isFolder(item)) {
      (item.tags || []).forEach((tag) => {
        if (tag?.id && !map.has(tag.id)) map.set(tag.id, tag);
      });
    }
  });
  return [...map.values()];
}

function renderTagFilters(notes) {
  const tags = collectTags(notes);
  tagFiltersEl.innerHTML = '';
  tags.forEach((tag) => {
    const active = activeTagId === tag.id;
    const btn = document.createElement('button');
    btn.className = `flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border cursor-pointer transition-colors ${
      active
        ? 'bg-gray-900 text-white border-gray-900'
        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
    }`;
    btn.innerHTML = `
      <svg class="w-2.5 h-2.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
      </svg>
      <span>${esc(tag.text)}</span>
    `;
    btn.addEventListener('click', () => {
      activeTagId = active ? null : tag.id;
      renderAll();
    });
    tagFiltersEl.appendChild(btn);
  });
}

function buildNoteCard(item) {
  const folder = isFolder(item);
  const isPinned = item.isHang === true;

  let preview = '';
  if (!folder) {
    if (item.isSecure) {
      // preview left empty; lock icon rendered separately
    } else if (item.type === 'todolist') {
      const total = (item.todos || []).length;
      const done = (item.todos || []).filter((t) => t?.isCheck).length;
      preview = total > 0 ? `${done}/${total} completed` : '';
    } else {
      preview = convertEditorDataToText(item.note);
    }
  }

  const tags = (item.tags || []).filter(Boolean).slice(0, 3);
  const time = item.updatedAt ? timeAgo(item.updatedAt) : '';

  const el = document.createElement('div');
  el.className =
    'bg-white border border-gray-200 rounded-xl p-3 cursor-pointer hover:border-gray-300 hover:shadow-sm transition-all flex flex-col gap-1.5 min-h-[90px]';

  const pinIcon = isPinned
    ? `<svg class="w-3 h-3 text-gray-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16 2v2l-2 5v3l4 2v2h-5v5l-1 1-1-1v-5H6v-2l4-2V9L8 4V2h8z"/>
       </svg>`
    : '';

  const folderIcon = folder
    ? `<svg class="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
       </svg>`
    : '';

  const bookmarkSvg = `<svg class="w-2.5 h-2.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
  </svg>`;

  el.innerHTML = `
    <div class="flex items-start gap-1">
      ${pinIcon}${folderIcon}
      <h3 class="text-[13px] font-semibold text-gray-900 leading-snug line-clamp-2 flex-1 min-w-0">${esc(item.title || 'Untitled')}</h3>
    </div>
    ${item.isSecure && !folder
      ? `<div class="flex items-center justify-center flex-1 py-2">
           <svg class="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
           </svg>
         </div>`
      : preview ? `<p class="text-[11px] text-gray-500 leading-relaxed line-clamp-3 note-preview"></p>` : ''}
    ${tags.length ? `
      <div class="flex flex-wrap gap-x-2 gap-y-0.5">
        ${tags.map((tag) => `
          <span class="flex items-center gap-0.5 text-[10px] text-gray-400">
            ${bookmarkSvg}
            ${esc(tag.text || '')}
          </span>`).join('')}
      </div>` : ''}
    <p class="text-[10px] text-gray-400 mt-auto pt-0.5">${time}</p>
  `;

  if (preview) {
    el.querySelector('.note-preview').innerHTML = preview;
  }

  el.addEventListener('click', () => {
    if (folder) {
      showFolderView(item);
    } else {
      showNoteDetail(item);
    }
  });

  return el;
}

function filterNotes(notes, query, tagId) {
  const q = query.trim().toLowerCase();
  return notes.filter((item) => {
    if (tagId) {
      if (isFolder(item)) return false;
      if (!(item.tags || []).some((t) => t?.id === tagId)) return false;
    }
    if (!q) return true;
    const haystack = [item.title, isFolder(item) ? '' : extractText(item.note)]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

function renderAll() {
  const query = searchInput.value;
  const filtered = filterNotes(allNotes, query, activeTagId);

  renderTagFilters(allNotes);
  notesGrid.innerHTML = '';

  if (filtered.length === 0) {
    notesGrid.style.display = 'none';
    notesEmptyEl.style.display = 'flex';
    notesEmptyMsg.textContent =
      query || activeTagId ? 'No matching notes' : 'No notes yet';
  } else {
    notesEmptyEl.style.display = 'none';
    notesGrid.style.display = 'grid';
    filtered.forEach((item) => notesGrid.appendChild(buildNoteCard(item)));
  }
}

async function loadNotes() {
  notesLoadingEl.style.display = 'flex';
  notesGrid.style.display = 'none';
  notesEmptyEl.style.display = 'none';

  try {
    allNotes = await requestNotes(sortOrder);
    notesLoadingEl.style.display = 'none';
    renderAll();
  } catch (err) {
    notesLoadingEl.style.display = 'none';
    notesEmptyEl.style.display = 'flex';
    notesEmptyMsg.textContent = `Couldn't load notes: ${err.message}`;
  }
}

// ── Views ─────────────────────────────────────────────────────────────────────
function showLoggedIn() {
  viewLoading.style.display = 'none';
  viewLoggedOut.style.display = 'none';
  viewNoteDetail.style.display = 'none';
  viewNoteCreate.style.display = 'none';
  viewTodoCreate.style.display = 'none';
  viewLoggedIn.style.display = 'flex';
  signedIn = true;
  setActiveTab('applications');
  loadNotes();
  refreshCurrentJob();
  loadRecentApplications();
  syncCaptureReview();
}

// ── Capture status banner ────────────────────────────────────────────────────
// Driven by chrome.storage.session (set from background.js's capture()) rather
// than a runtime message, since a right-click/pill capture can open or race
// ahead of the panel document — reading storage on init still catches an
// in-flight capture that the panel missed the start of.
const CAPTURE_BANNER_STYLE = {
  capturing: 'bg-gray-900',
  success: 'bg-green-600',
  error: 'bg-red-600',
};

function setCaptureBanner(status, message) {
  if (!status || status === 'idle') {
    captureBanner.style.display = 'none';
    return;
  }
  captureBanner.style.display = 'flex';
  captureBanner.className =
    `fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-white shadow-sm ${CAPTURE_BANNER_STYLE[status] || CAPTURE_BANNER_STYLE.capturing}`;
  captureBannerSpinner.style.display = status === 'capturing' ? 'inline-block' : 'none';
  captureBannerClose.style.display = status === 'error' ? 'inline-block' : 'none';
  captureBannerText.textContent = message || '';
}

// Panel-local failures (opening the app tab, copying…) share the banner with
// capture errors so every error surfaces in one place.
function showPanelError(message) {
  setCaptureBanner('error', message);
}

function dismissCaptureBanner() {
  setCaptureBanner('idle');
  chrome.storage.session.set({ captureStatus: 'idle', captureMessage: '' });
}

captureBannerClose.addEventListener('click', dismissCaptureBanner);

function syncCaptureBanner() {
  chrome.storage.session.get(['captureStatus', 'captureMessage'], (res) => {
    // Reflect an in-flight capture, or an error nobody has dismissed yet (a
    // pill/right-click capture can fail while the panel is closed). A stale
    // success isn't worth surfacing.
    if (res.captureStatus === 'capturing' || res.captureStatus === 'error') {
      setCaptureBanner(res.captureStatus, res.captureMessage);
    }
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'session' || !changes.captureStatus) return;
  const status = changes.captureStatus.newValue;
  chrome.storage.session.get('captureMessage', (res) => setCaptureBanner(status, res.captureMessage));
  // Errors stay up until dismissed — only success clears itself.
  if (status === 'success') {
    setTimeout(() => {
      chrome.storage.session.get('captureStatus', (res) => {
        if (res.captureStatus === 'success') dismissCaptureBanner();
      });
    }, 3000);
  }
});

syncCaptureBanner();

// ── Current tab (capture) ────────────────────────────────────────────────────
// Reads only the active tab's id (no "tabs" permission needed) and asks the
// LinkedIn content script whether it has a job; never inspects tab.url itself.

async function refreshCurrentJob() {
  currentTabJob.style.display = 'none';
  currentTabHint.style.display = 'none';

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id == null) {
    currentTabHint.style.display = 'block';
    return;
  }

  chrome.tabs.sendMessage(tab.id, { action: 'detect' }, (resp) => {
    if (chrome.runtime.lastError || !resp?.job) {
      currentTabHint.style.display = 'block';
      return;
    }
    const job = resp.job;
    currentTabTitle.textContent = job.title || 'Untitled role';
    currentTabCompany.textContent = job.company || '';
    currentTabJob.style.display = 'block';
    // resp.sourceUrl only — the panel never reads tab.url, which would be
    // undefined here anyway without the "tabs" permission.
    currentTabCaptureBtn.onclick = () => captureFromCurrentTab(job, resp.sourceUrl);
  });
}

// React to tab switches (fires with just a tabId — no "tabs" permission needed).
chrome.tabs.onActivated.addListener(refreshCurrentJob);

// React to LinkedIn SPA navigation broadcast from the content script.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.action === 'jobChanged') refreshCurrentJob();
});

// Panel document is torn down on close and rebuilt on reopen — re-sync on focus.
window.addEventListener('focus', () => {
  refreshCurrentJob();
  loadRecentApplications();
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    refreshCurrentJob();
    loadRecentApplications();
  }
});

function captureFromCurrentTab(fields, sourceUrl) {
  currentTabCaptureBtn.disabled = true;
  currentTabCaptureLabel.textContent = 'Capturing…';
  chrome.runtime.sendMessage(
    { action: 'capture', payload: { source: 'extension-structured', fields, sourceUrl } },
    (resp) => {
      currentTabCaptureBtn.disabled = false;
      currentTabCaptureLabel.textContent = !resp?.success
        ? "Couldn't capture, try again"
        : resp.data?.review === 'panel' ? 'Captured' : 'Captured — opening draft';
      // background.js's capture() already put its reason in the banner; this
      // covers the worker not answering at all.
      if (!resp?.success) showPanelError(resp?.error || chrome.runtime.lastError?.message || 'Capture failed');
      setTimeout(() => {
        currentTabCaptureLabel.textContent = 'Capture to Notespacehub';
      }, 3000);
    },
  );
}

function openAppTab(path) {
  chrome.runtime.sendMessage({ action: 'openAppTab', path }, (res) => {
    if (chrome.runtime.lastError) showPanelError(chrome.runtime.lastError.message);
    else if (!res?.success) showPanelError(res?.error || "Couldn't open Notespacehub");
  });
}

// ── Capture review ───────────────────────────────────────────────────────────
// background.js's capture() sets captureReview instead of opening an app tab
// when this panel is open. The draft is fetched here rather than handed over
// in storage, so a reopened panel shows its current state — a draft already
// confirmed or discarded elsewhere (e.g. in the app tab) is just dropped.

const STATUS_LABEL = {
  SAVED: 'Saved',
  APPLIED: 'Applied',
  SCREENING: 'Screening',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  REJECTED: 'Rejected',
};

const ALL_VIEWS = [viewLoggedIn, viewNoteDetail, viewFolder, viewNoteEdit, viewTodoEdit, viewNoteCreate, viewTodoCreate];

function sendMessageAsync(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (res) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else if (res?.success) resolve(res.data);
      else {
        const err = new Error(res?.error || 'Request failed');
        err.status = res?.status;
        reject(err);
      }
    });
  });
}

// The view the review interrupted (possibly a half-written note) is hidden,
// not torn down, and comes back as it was once the review is done.
function openCaptureReviewView() {
  if (viewCaptureReview.style.display === 'none') {
    viewBeforeReview = ALL_VIEWS.find((v) => v.style.display !== 'none') || viewLoggedIn;
  }
  ALL_VIEWS.forEach((v) => (v.style.display = 'none'));
  viewCaptureReview.style.display = 'flex';
}

function closeCaptureReviewView() {
  reviewingDraft = null;
  cancelJobFit();
  if (viewCaptureReview.style.display === 'none') return;
  viewCaptureReview.style.display = 'none';
  (viewBeforeReview || viewLoggedIn).style.display = 'flex';
  viewBeforeReview = null;
}

function setCaptureReviewError(message) {
  captureReviewError.textContent = message || '';
  captureReviewError.style.display = message ? 'block' : 'none';
}

function setCaptureReviewBusy(busy, saveLabel = 'Save') {
  captureReviewSaveBtn.disabled = busy;
  captureReviewDiscardBtn.disabled = busy;
  captureReviewSaveBtn.textContent = saveLabel;
}

// Mirrors notehub-app's captureDraftToInitialValues + the create form's
// "APPLIED unless that stage is turned off" default.
function fillCaptureReviewForm(draft, stages) {
  const fields = draft.parsedFields || {};
  const active = stages ? stages.filter((s) => s.isActive).map((s) => s.status) : Object.keys(STATUS_LABEL);
  const statuses = active.length ? active : Object.keys(STATUS_LABEL);
  captureReviewStatus.innerHTML = statuses
    .map((s) => `<option value="${esc(s)}">${esc(STATUS_LABEL[s] || s)}</option>`)
    .join('');
  captureReviewStatus.value = statuses.includes('APPLIED') ? 'APPLIED' : statuses[0];

  captureReviewCompany.value = fields.company || '';
  captureReviewRole.value = fields.title || '';
  captureReviewLocation.value = fields.location || '';
  captureReviewSalary.value = fields.salary || '';
  captureReviewJobUrl.value = fields.url || draft.sourceUrl || '';
  captureReviewDescription.value = fields.description || '';
}

async function showCaptureReview(review) {
  reviewingDraft = review;
  openCaptureReviewView();
  setCaptureReviewError('');
  setCaptureReviewBusy(true);
  captureReviewForm.style.display = 'none';
  captureReviewLoading.style.display = 'flex';

  try {
    const { draft, stages } = await sendMessageAsync({ action: 'fetchCaptureReview', draftId: review.draftId });
    if (reviewingDraft?.draftId !== review.draftId) return; // superseded meanwhile
    if (draft.status !== 'draft') {
      chrome.storage.session.remove('captureReview');
      return;
    }
    fillCaptureReviewForm(draft, stages);
    captureReviewLoading.style.display = 'none';
    captureReviewForm.style.display = 'flex';
    setCaptureReviewBusy(false);
    captureReviewRole.focus();
    resetJobFit();
    scheduleJobFit(true);
  } catch (err) {
    if (reviewingDraft?.draftId !== review.draftId) return;
    captureReviewLoading.style.display = 'none';
    setCaptureReviewError(`Couldn't load the captured job: ${err.message}`);
    captureReviewDiscardBtn.disabled = false;
  }
}

function syncCaptureReview() {
  chrome.storage.session.get('captureReview', (res) => {
    if (res.captureReview) showCaptureReview(res.captureReview);
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'session' || !changes.captureReview || !signedIn) return;
  const review = changes.captureReview.newValue;
  if (review) showCaptureReview(review);
  else closeCaptureReviewView();
});

captureReviewForm.addEventListener('submit', (e) => {
  e.preventDefault();
  captureReviewSaveBtn.click();
});

captureReviewSaveBtn.addEventListener('click', async () => {
  if (!reviewingDraft) return;
  const application = {
    company: captureReviewCompany.value.trim(),
    role: captureReviewRole.value.trim(),
    status: captureReviewStatus.value,
    location: captureReviewLocation.value.trim(),
    salaryRange: captureReviewSalary.value.trim(),
    jobUrl: captureReviewJobUrl.value.trim(),
    jobDescription: captureReviewDescription.value.trim(),
  };
  if (!application.company || !application.role) {
    setCaptureReviewError('Company and role are required.');
    (application.company ? captureReviewRole : captureReviewCompany).focus();
    return;
  }

  setCaptureReviewError('');
  setCaptureReviewBusy(true, 'Saving…');
  try {
    // background.js has already started the tailored CV and the email for
    // it; the documents view picks those jobs up.
    const created = await sendMessageAsync({ action: 'confirmCaptureDraft', draftId: reviewingDraft.draftId, application });
    closeCaptureReviewView();
    await chrome.storage.session.remove('captureReview');
    showApplicationDocuments(created);
  } catch (err) {
    setCaptureReviewBusy(false);
    setCaptureReviewError(err.message || 'Save failed');
  }
});

captureReviewDiscardBtn.addEventListener('click', async () => {
  if (!reviewingDraft) return;
  setCaptureReviewBusy(true);
  try {
    await sendMessageAsync({ action: 'discardCaptureDraft', draftId: reviewingDraft.draftId });
  } catch (err) {
    // 404: already confirmed or discarded elsewhere — nothing left to discard.
    if (err.status !== 404) {
      setCaptureReviewBusy(false);
      setCaptureReviewError(`Couldn't discard: ${err.message}`);
      return;
    }
  }
  chrome.storage.session.remove('captureReview');
});

// ── Profile fit (capture review) ─────────────────────────────────────────────
// The panel's copy of notehub-app's JobFitCheck: scores the Master Profile
// against the job in the form via /ai/job-fit/analyze. Runs by itself once
// there's a description, and again after the description stops changing —
// edits to company/role/location are sent as context but don't trigger a new
// AI call. Nothing is saved.

const FIT_MIN_DESCRIPTION_LENGTH = 50; // shorter is a stub, not worth an AI call
const FIT_TYPING_PAUSE_MS = 1500;
const FIT_MAX_DESCRIPTION_LENGTH = 20000; // AnalyzeJobFitDto's limit
const FIT_RING_SIZE = 48;
const FIT_RING_STROKE = 5;

let fitTimer = null;
let fitRequestId = 0; // bumped per run/cancel so a stale reply is ignored
let fitDescription = null; // the description the result on screen is (being) computed for

function fitTone(score) {
  if (score >= 75) return { color: '#10b981', label: 'Strong fit' };
  if (score >= 50) return { color: '#f59e0b', label: 'Partial fit' };
  return { color: '#f43f5e', label: 'Weak fit' };
}

function setFitBusy(busy) {
  captureFitBusy.style.display = busy ? 'flex' : 'none';
  captureFitRetryBtn.style.display = !busy && fitDescription !== null ? 'inline-block' : 'none';
  captureFitResult.style.opacity = busy ? '0.5' : '1';
}

function setFitHint(text) {
  captureFitHint.textContent = text || '';
  captureFitHint.style.display = text ? 'block' : 'none';
}

function cancelJobFit() {
  clearTimeout(fitTimer);
  fitRequestId++;
}

function resetJobFit() {
  cancelJobFit();
  fitDescription = null;
  captureFitResult.innerHTML = '';
  captureFitResult.style.display = 'none';
  captureFitRetryBtn.textContent = 'Recalculate';
  setFitHint('');
  setFitBusy(false);
}

function renderFitResult(result) {
  const tone = fitTone(result.score);
  const r = (FIT_RING_SIZE - FIT_RING_STROKE) / 2;
  const circumference = 2 * Math.PI * r;
  const c = FIT_RING_SIZE / 2;
  const missing = Array.isArray(result.missing) ? result.missing : [];

  captureFitResult.innerHTML = `
    <div class="flex items-center gap-3">
      <div class="relative shrink-0" style="width:${FIT_RING_SIZE}px;height:${FIT_RING_SIZE}px">
        <svg width="${FIT_RING_SIZE}" height="${FIT_RING_SIZE}" style="transform:rotate(-90deg)">
          <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#e5e7eb" stroke-width="${FIT_RING_STROKE}" />
          <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${tone.color}" stroke-width="${FIT_RING_STROKE}"
            stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference * (1 - result.score / 100)}" />
        </svg>
        <div class="absolute flex items-center justify-center text-xs font-semibold text-gray-900" style="inset:0">${esc(result.score)}%</div>
      </div>
      <div class="flex flex-col gap-0.5 min-w-0">
        <p class="text-sm font-medium text-gray-900">${esc(tone.label)}</p>
        ${result.summary ? `<p class="text-xs text-gray-500">${esc(result.summary)}</p>` : ''}
      </div>
    </div>
    ${
      missing.length
        ? `<p class="text-xs font-medium text-gray-900">Missing from your profile</p>
           ${missing
             .map(
               (group) => `
             <div class="flex flex-col gap-1">
               <p class="text-[11px] text-gray-500">${esc(group.category)}</p>
               <div class="flex flex-wrap gap-1">
                 ${(group.items || [])
                   .map(
                     (item) =>
                       `<span class="rounded-md px-2 py-0.5 text-[11px]" style="border:1px solid #fecdd3;background:#fff1f2;color:#be123c">${esc(item)}</span>`,
                   )
                   .join('')}
               </div>
             </div>`,
             )
             .join('')}`
        : `<p class="text-xs font-medium" style="color:#059669">Your profile covers everything this job asks for</p>`
    }`;
  captureFitResult.style.display = 'flex';
}

async function runJobFit(description) {
  clearTimeout(fitTimer);
  const id = ++fitRequestId;
  fitDescription = description;
  setFitHint('');
  setFitBusy(true);
  try {
    const result = await sendMessageAsync({
      action: 'analyzeJobFit',
      input: {
        jobDescription: description.slice(0, FIT_MAX_DESCRIPTION_LENGTH),
        company: captureReviewCompany.value.trim() || undefined,
        role: captureReviewRole.value.trim() || undefined,
        location: captureReviewLocation.value.trim() || undefined,
      },
    });
    if (id !== fitRequestId) return;
    renderFitResult(result);
    captureFitRetryBtn.textContent = 'Recalculate';
  } catch (err) {
    if (id !== fitRequestId) return;
    // The API's own reason, e.g. a rejected AI key or an empty Master Profile.
    setFitHint(`Couldn't calculate the fit: ${err.message}`);
    captureFitRetryBtn.textContent = 'Try again';
  }
  setFitBusy(false);
}

// immediate: a description that's there on load has nothing to wait for.
function scheduleJobFit(immediate) {
  clearTimeout(fitTimer);
  const description = captureReviewDescription.value.trim();
  if (description.length < FIT_MIN_DESCRIPTION_LENGTH) {
    resetJobFit();
    setFitHint('Add the job description to see how well your Master Profile matches this job.');
    return;
  }
  if (description === fitDescription) return;
  setFitBusy(true);
  fitTimer = setTimeout(() => runJobFit(description), immediate ? 0 : FIT_TYPING_PAUSE_MS);
}

captureReviewDescription.addEventListener('input', () => scheduleJobFit(false));
captureFitRetryBtn.addEventListener('click', () => runJobFit(captureReviewDescription.value.trim()));

// Hands the still-pending draft to the app's full form (job portal picker,
// dates…); the app discards it if the user backs out there.
captureReviewOpenAppBtn.addEventListener('click', () => {
  if (!reviewingDraft) return;
  openAppTab(reviewingDraft.redirectUrl);
  chrome.storage.session.remove('captureReview');
});

// ── Recent applications ──────────────────────────────────────────────────────

function requestApplications() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'fetchApplications' }, (res) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else if (res?.success) resolve(res.data);
      else reject(new Error(res?.error || 'Failed to load applications'));
    });
  });
}

async function loadRecentApplications() {
  applicationsLoading.style.display = 'flex';
  applicationsEmpty.style.display = 'none';
  applicationsTableWrap.style.display = 'none';
  applicationsTodayCount.textContent = '';

  try {
    const { applications, todayCount } = await requestApplications();
    applicationsLoading.style.display = 'none';
    applicationsTodayCount.textContent = `${todayCount} application${todayCount === 1 ? '' : 's'} recorded today`;

    if (!applications?.length) {
      applicationsEmpty.textContent = 'No applications yet. Capture your first job to get started.';
      applicationsEmpty.style.display = 'block';
      return;
    }
    applicationsList.innerHTML = applications
      .map(
        (app) => `
        <tr class="app-row cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0" data-id="${esc(app.id)}">
          <td class="py-2 pr-2 min-w-0">
            <span class="block text-sm text-gray-900 truncate">${esc(app.role)}</span>
          </td>
          <td class="py-2 pl-2 min-w-0 text-right">
            <span class="block text-xs text-gray-400 truncate">${esc(app.company)}</span>
          </td>
        </tr>`,
      )
      .join('');
    // The application's documents open right here (sidepanel-documents.js);
    // that view links on to the full page in the app.
    applicationsList.querySelectorAll('.app-row').forEach((row) => {
      row.addEventListener('click', () => {
        const app = applications.find((a) => a.id === row.dataset.id);
        if (app) showApplicationDocuments(app);
      });
    });
    applicationsTableWrap.style.display = 'block';
  } catch (err) {
    applicationsLoading.style.display = 'none';
    applicationsEmpty.textContent = `Couldn't load applications: ${err.message}`;
    applicationsEmpty.style.display = 'block';
  }
}

// ── Home tabs (Applications / Notes) ─────────────────────────────────────────

const TAB_ACTIVE_CLASS = 'flex-1 text-center text-xs font-medium py-2.5 border-b-2 border-gray-900 text-gray-900 transition-colors cursor-pointer';
const TAB_INACTIVE_CLASS = 'flex-1 text-center text-xs font-medium py-2.5 border-b-2 border-transparent text-gray-400 hover:text-gray-600 transition-colors cursor-pointer';

function setActiveTab(tab) {
  const isApplications = tab === 'applications';
  tabApplications.style.display = isApplications ? 'flex' : 'none';
  tabNotes.style.display = isApplications ? 'none' : 'flex';
  tabApplicationsBtn.className = isApplications ? TAB_ACTIVE_CLASS : TAB_INACTIVE_CLASS;
  tabNotesBtn.className = isApplications ? TAB_INACTIVE_CLASS : TAB_ACTIVE_CLASS;
}

tabApplicationsBtn.addEventListener('click', () => setActiveTab('applications'));
tabNotesBtn.addEventListener('click', () => setActiveTab('notes'));

// ── Refresh ───────────────────────────────────────────────────────────────────

refreshBtn.addEventListener('click', () => {
  refreshBtn.disabled = true;
  refreshBtn.classList.add('animate-spin');
  Promise.allSettled([loadNotes(), refreshCurrentJob(), loadRecentApplications()]).finally(() => {
    refreshBtn.disabled = false;
    refreshBtn.classList.remove('animate-spin');
  });
});

function showLoggedOut() {
  viewLoading.style.display = 'none';
  viewLoggedIn.style.display = 'none';
  viewNoteDetail.style.display = 'none';
  viewNoteCreate.style.display = 'none';
  viewTodoCreate.style.display = 'none';
  viewCaptureReview.style.display = 'none';
  ALL_VIEWS.forEach((v) => (v.style.display = 'none'));
  viewLoggedOut.style.display = 'flex';
  signedIn = false;
  reviewingDraft = null;
  viewBeforeReview = null;
}

// Same fix as notehub-app's editor-tools.ts: editorjs-button leaves its (hidden)
// text/link contentEditable divs in the DOM even in view state (display:none),
// which throws off EditorJS's hover-toolbar positioning for saved buttons.
// Disabling contentEditable while hidden avoids that.
class AnyButtonTool extends AnyButton {
  changeState(state) {
    super.changeState(state);
    const isEdit = state === AnyButton.STATE.EDIT;
    if (this.nodes.textInput) this.nodes.textInput.contentEditable = isEdit ? 'true' : 'false';
    if (this.nodes.linkInput) this.nodes.linkInput.contentEditable = isEdit ? 'true' : 'false';
  }
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function requestUploadBucket(kind, base64, name, contentType) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'uploadBucket', kind, base64, name, contentType }, (res) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (res && res.success) {
        resolve(res.data);
      } else {
        reject(new Error(res?.error || 'Upload failed'));
      }
    });
  });
}

async function uploadToBucket(file, kind) {
  if (file.size > MAX_SIZE_FILE) {
    throw new Error(`File size is maximal ${MAX_IN_MB}MB`);
  }
  const base64 = await toBase64(file);
  return requestUploadBucket(kind, base64, file.name, file.type);
}

// Mirrors notehub-app's src/components/editor/editor-tools.ts tool-for-tool, so a
// note made in the app doesn't drop any block type EditorJS doesn't recognize
// (table/warning/toggle/image/etc.) when opened here. Shared by all three
// EditorJS instances below (readOnly is a separate top-level EditorJS option).
function buildEditorTools() {
  return {
    header: { class: Header, inlineToolbar: true, config: { placeholder: 'Enter a header', levels: [2, 3, 4], defaultLevel: 3 } },
    list: { class: EditorjsList, inlineToolbar: true },
    checklist: { class: Checklist, inlineToolbar: true },
    quote: { class: Quote, inlineToolbar: true, toolbox: false },
    table: { class: Table, inlineToolbar: true },
    warning: { class: Warning, inlineToolbar: true, config: { titlePlaceholder: 'Title', messagePlaceholder: 'Message' } },
    toggle: { class: ToggleBlock, inlineToolbar: true },
    underline: { class: Underline },
    colorPicker: { class: ColorPicker },
    anyButton: { class: AnyButtonTool, inlineToolbar: false },
    linkTool: { class: LinkTool, config: { endpoint: `${API_BASE}/link` } },
    attaches: { class: AttachesTool, config: { uploader: { uploadByFile: (file) => uploadToBucket(file, 'file') } } },
    image: {
      class: InlineImage,
      inlineToolbar: true,
      toolbox: false,
      config: {
        embed: { display: true },
        unsplash: { apiUrl: `${API_BASE}/unsplash/photos`, maxResults: 30, imageParams: { q: 85, w: 1500 } },
      },
    },
    imageUpload: { class: ImageTool, config: { uploader: { uploadByFile: (file) => uploadToBucket(file, 'image') } } },
  };
}

async function showNoteDetail(item) {
  currentNote = item;
  viewLoggedIn.style.display = 'none';
  viewFolder.style.display = 'none';
  viewNoteEdit.style.display = 'none';
  viewNoteDetail.style.display = 'flex';

  const canEdit = !item.isSecure;
  noteDetailCopyBtn.style.display = canEdit ? 'block' : 'none';
  noteDetailCopyBtn.textContent = 'Copy';
  noteDetailEditBtn.style.display = canEdit ? 'block' : 'none';

  noteDetailTitle.textContent = item.title || 'Untitled';

  const date = new Date(item.updatedAt);
  noteDetailDate.textContent =
    date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) +
    ' · ' + timeAgo(item.updatedAt);

  noteDetailLink.onclick = () => {
    openAppTab(`/write/${item.id}`);
  };

  await destroyDetailEditor();

  const isFreetext = !item.isSecure && item.type !== 'todolist';

  if (isFreetext) {
    noteDetailContent.style.display = 'none';
    noteDetailEditorHolder.style.display = 'block';
    noteDetailEditorHolder.innerHTML = '';

    detailEditorInstance = new EditorJS({
      holder: noteDetailEditorHolder,
      data: item.note && Array.isArray(item.note.blocks) ? item.note : { blocks: [] },
      tools: buildEditorTools(),
      readOnly: true,
    });
  } else {
    noteDetailContent.style.display = '';
    noteDetailEditorHolder.style.display = 'none';

    let html = '';
    if (item.isSecure) {
      html = '<p style="color:#9ca3af;font-style:italic">This note is encrypted.</p>';
    } else {
      const todos = item.todos || [];
      if (todos.length === 0) {
        html = '<p style="color:#9ca3af;font-style:italic">No tasks yet.</p>';
      } else {
        const items = todos.map((t) =>
          `<li><input type="checkbox" disabled ${t.isCheck ? 'checked' : ''}/> ${escapeHtml(t.content ?? '')}</li>`
        ).join('');
        html = DOMPurify.sanitize(`<ul class="checklist">${items}</ul>`);
      }
    }
    noteDetailContent.innerHTML = html;
  }

  renderNoteAttachments(item);
}

// Same rule as notehub-app's getFileUrl: entries saved now carry an R2 key,
// older ones a full url. Anything that isn't http(s) is dropped so a stored
// value can't become a javascript: href.
function getFileUrl(file) {
  const url = file?.key ? `${R2_PUBLIC_URL}/${file.key}` : file?.url || '';
  return /^https?:\/\//.test(url) ? url : '';
}

// Images/files added through the app's attach button live in the note's
// imagesUrl/filesUrl columns, not in its EditorJS blocks, so the read-only
// editor never shows them. Rendered below it the way the app's note view
// lists them: an image grid, then the files.
function renderNoteAttachments(item) {
  noteDetailAttachments.replaceChildren();
  const images = item.isSecure ? [] : (item.imagesUrl || []).filter(getFileUrl);
  const files = item.isSecure ? [] : (item.filesUrl || []).filter(getFileUrl);
  noteDetailAttachments.style.display = images.length || files.length ? 'flex' : 'none';

  if (images.length) {
    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-2 gap-2';
    images.forEach((image) => {
      const link = document.createElement('a');
      link.href = getFileUrl(image);
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.title = image.name || '';
      link.className = 'block overflow-hidden rounded-lg border border-gray-200';
      const img = document.createElement('img');
      img.src = link.href;
      img.alt = image.name || 'image';
      img.loading = 'lazy';
      img.className = 'w-full';
      img.style.cssText = 'height:96px;object-fit:cover;display:block';
      link.appendChild(img);
      grid.appendChild(link);
    });
    noteDetailAttachments.appendChild(grid);
  }

  files.forEach((file) => {
    const link = document.createElement('a');
    link.href = getFileUrl(file);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors';
    link.innerHTML = `
      <svg class="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
      </svg>
      <span class="text-xs font-medium text-gray-700 truncate flex-1 min-w-0"></span>
      ${file.sizeInMb ? '<span class="text-[11px] text-gray-400 shrink-0"></span>' : ''}`;
    link.querySelector('span').textContent = file.name || 'File';
    if (file.sizeInMb) link.querySelectorAll('span')[1].textContent = `${file.sizeInMb} MB`;
    noteDetailAttachments.appendChild(link);
  });
}

async function showFolderView(item) {
  activeFolder = item;
  viewLoggedIn.style.display = 'none';
  viewNoteDetail.style.display = 'none';
  viewFolder.style.display = 'flex';
  folderTitle.textContent = item.title || 'Untitled folder';

  folderLoadingEl.style.display = 'flex';
  folderEmptyEl.style.display = 'none';
  folderGrid.style.display = 'none';
  folderGrid.innerHTML = '';

  try {
    const { notes } = await requestFolder(item.id, sortOrder);
    folderLoadingEl.style.display = 'none';
    if (!notes?.length) {
      folderEmptyMsg.textContent = 'No notes in this folder';
      folderEmptyEl.style.display = 'flex';
    } else {
      folderGrid.style.display = 'grid';
      notes.forEach((note) => folderGrid.appendChild(buildNoteCard(note)));
    }
  } catch (err) {
    folderLoadingEl.style.display = 'none';
    folderEmptyMsg.textContent = `Couldn't load folder: ${err.message}`;
    folderEmptyEl.style.display = 'flex';
  }
}

function showHome() {
  viewNoteDetail.style.display = 'none';
  viewNoteEdit.style.display = 'none';
  viewTodoEdit.style.display = 'none';
  viewNoteCreate.style.display = 'none';
  viewTodoCreate.style.display = 'none';
  viewFolder.style.display = 'none';
  activeFolder = null;
  viewLoggedIn.style.display = 'flex';
  destroyEditor();
  destroyDetailEditor();
  destroyCreateEditor();
}

async function destroyEditor() {
  if (editorInstance) {
    try { await editorInstance.destroy(); } catch (_) {}
    editorInstance = null;
  }
}

async function destroyDetailEditor() {
  if (detailEditorInstance) {
    try { await detailEditorInstance.destroy(); } catch (_) {}
    detailEditorInstance = null;
  }
}

async function showNoteEdit(item) {
  currentNote = item;
  viewNoteDetail.style.display = 'none';
  viewNoteEdit.style.display = 'flex';
  noteEditTitle.textContent = item.title || 'Untitled';
  noteEditSaveBtn.disabled = false;
  noteEditSaveBtn.textContent = 'Save';
  noteEditError.style.display = 'none';

  await destroyEditor();
  document.getElementById('editorjs-holder').innerHTML = '';

  editorInstance = new EditorJS({
    holder: 'editorjs-holder',
    data: item.note && Array.isArray(item.note.blocks) ? item.note : { blocks: [] },
    tools: buildEditorTools(),
    placeholder: 'Start writing…',
  });
}

function requestUpdateNote(id, note) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'updateNote', id, note }, (res) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (res && res.success) {
        resolve(res.data);
      } else {
        reject(new Error(res?.error || 'Save failed'));
      }
    });
  });
}

function requestUpdateTodos(id, todos) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'updateTodos', id, todos }, (res) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (res && res.success) {
        resolve(res.data);
      } else {
        reject(new Error(res?.error || 'Save failed'));
      }
    });
  });
}

function requestCreateNote(note) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'createNote', note }, (res) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (res && res.success) {
        resolve(res.data);
      } else {
        reject(new Error(res?.error || 'Create failed'));
      }
    });
  });
}

async function destroyCreateEditor() {
  if (createEditorInstance) {
    try { await createEditorInstance.destroy(); } catch (_) {}
    createEditorInstance = null;
  }
}

function buildTodoEditItem(todo, idx) {
  const row = document.createElement('div');
  row.className = 'flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0';
  row.dataset.idx = idx;

  const checkBtn = document.createElement('button');
  checkBtn.type = 'button';
  checkBtn.className = [
    'mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer',
    todo.isCheck ? 'bg-gray-900 border-gray-900' : 'border-gray-300 hover:border-gray-500',
  ].join(' ');
  checkBtn.innerHTML = todo.isCheck
    ? `<svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/>
       </svg>`
    : '';
  checkBtn.addEventListener('click', () => {
    const t = editingTodos[idx];
    t.isCheck = !t.isCheck;
    t.checkedAt = t.isCheck ? new Date().toISOString() : '';
    renderTodoEditList();
  });

  const input = document.createElement('input');
  input.type = 'text';
  input.value = todo.content ?? '';
  input.className = [
    'flex-1 text-sm bg-transparent outline-none border-b border-transparent focus:border-gray-300 transition-colors pb-0.5',
    todo.isCheck ? 'line-through text-gray-400' : 'text-gray-800',
  ].join(' ');
  input.addEventListener('input', (e) => {
    editingTodos[idx].content = e.target.value;
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'shrink-0 text-gray-300 hover:text-red-400 transition-colors cursor-pointer';
  deleteBtn.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
  </svg>`;
  deleteBtn.addEventListener('click', () => {
    editingTodos.splice(idx, 1);
    renderTodoEditList();
  });

  row.appendChild(checkBtn);
  row.appendChild(input);
  row.appendChild(deleteBtn);
  return row;
}

function renderTodoEditList() {
  todoEditList.innerHTML = '';
  if (editingTodos.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'text-sm text-gray-400 italic py-4 text-center';
    empty.textContent = 'No tasks yet.';
    todoEditList.appendChild(empty);
  } else {
    editingTodos.forEach((todo, idx) => {
      todoEditList.appendChild(buildTodoEditItem(todo, idx));
    });
  }
}

function buildTodoCreateItem(todo, idx) {
  const row = document.createElement('div');
  row.className = 'flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0';

  const checkBtn = document.createElement('button');
  checkBtn.type = 'button';
  checkBtn.className = [
    'mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer',
    todo.isCheck ? 'bg-gray-900 border-gray-900' : 'border-gray-300 hover:border-gray-500',
  ].join(' ');
  checkBtn.innerHTML = todo.isCheck
    ? `<svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/>
       </svg>`
    : '';
  checkBtn.addEventListener('click', () => {
    creatingTodos[idx].isCheck = !creatingTodos[idx].isCheck;
    creatingTodos[idx].checkedAt = creatingTodos[idx].isCheck ? new Date().toISOString() : '';
    renderTodoCreateList();
  });

  const input = document.createElement('input');
  input.type = 'text';
  input.value = todo.content ?? '';
  input.className = [
    'flex-1 text-sm bg-transparent outline-none border-b border-transparent focus:border-gray-300 transition-colors pb-0.5',
    todo.isCheck ? 'line-through text-gray-400' : 'text-gray-800',
  ].join(' ');
  input.addEventListener('input', (e) => {
    creatingTodos[idx].content = e.target.value;
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'shrink-0 text-gray-300 hover:text-red-400 transition-colors cursor-pointer';
  deleteBtn.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
  </svg>`;
  deleteBtn.addEventListener('click', () => {
    creatingTodos.splice(idx, 1);
    renderTodoCreateList();
  });

  row.appendChild(checkBtn);
  row.appendChild(input);
  row.appendChild(deleteBtn);
  return row;
}

function renderTodoCreateList() {
  todoCreateList.innerHTML = '';
  if (creatingTodos.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'text-sm text-gray-400 italic py-4 text-center';
    empty.textContent = 'No tasks yet.';
    todoCreateList.appendChild(empty);
  } else {
    creatingTodos.forEach((todo, idx) => {
      todoCreateList.appendChild(buildTodoCreateItem(todo, idx));
    });
  }
}

function showTodoEdit(item) {
  currentNote = item;
  viewNoteDetail.style.display = 'none';
  viewTodoEdit.style.display = 'flex';
  todoEditTitle.textContent = item.title || 'Untitled';
  todoEditSaveBtn.disabled = false;
  todoEditSaveBtn.textContent = 'Save';
  todoEditError.style.display = 'none';

  editingTodos = (item.todos || []).map((t) => ({ ...t }));
  todoAddInput.value = '';
  renderTodoEditList();
}

async function showNoteCreate() {
  viewLoggedIn.style.display = 'none';
  viewNoteCreate.style.display = 'flex';
  noteCreateTitleInput.value = '';
  noteCreateSaveBtn.disabled = false;
  noteCreateSaveBtn.textContent = 'Save';
  noteCreateError.style.display = 'none';

  await destroyCreateEditor();
  document.getElementById('noteCreate-editorjs-holder').innerHTML = '';

  createEditorInstance = new EditorJS({
    holder: 'noteCreate-editorjs-holder',
    data: { blocks: [] },
    tools: buildEditorTools(),
    placeholder: 'Start writing…',
  });

  noteCreateTitleInput.focus();
}

function showTodoCreate() {
  viewLoggedIn.style.display = 'none';
  viewTodoCreate.style.display = 'flex';
  todoCreateTitleInput.value = '';
  todoCreateSaveBtn.disabled = false;
  todoCreateSaveBtn.textContent = 'Save';
  todoCreateError.style.display = 'none';

  creatingTodos = [];
  todoCreateAddInput.value = '';
  renderTodoCreateList();
  todoCreateTitleInput.focus();
}

function showError(msg) {
  loginError.textContent = msg;
  loginError.style.display = 'block';
}

function hideError() {
  loginError.style.display = 'none';
}

// ── Events ────────────────────────────────────────────────────────────────────
loginBtn.addEventListener('click', () => {
  hideError();
  loginBtn.disabled = true;
  loginBtn.textContent = 'Signing in…';
  chrome.runtime.sendMessage({ action: 'login' }, (res) => {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Sign in';
    if (res?.success) showLoggedIn();
    else showError(res?.error || chrome.runtime.lastError?.message || 'Sign in failed. Please try again.');
  });
});

logoutBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'logout' }, () => showLoggedOut());
});

searchInput.addEventListener('input', () => renderAll());

sortBtn.addEventListener('click', () => {
  sortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
  sortIcon.style.transform =
    sortOrder === 'asc' ? 'rotate(180deg)' : 'rotate(0deg)';
  loadNotes();
});

noteDetailBackBtn.addEventListener('click', () => {
  if (activeFolder) showFolderView(activeFolder);
  else showHome();
});

folderBackBtn.addEventListener('click', showHome);

noteDetailEditBtn.addEventListener('click', () => {
  if (currentNote.type === 'todolist') showTodoEdit(currentNote);
  else showNoteEdit(currentNote);
});

noteDetailCopyBtn.addEventListener('click', async () => {
  const text = currentNote.type === 'todolist'
    ? todosToPlainText(currentNote.todos)
    : editorJsToPlainText(currentNote.note);
  try {
    await navigator.clipboard.writeText(DOMPurify.sanitize(text));
    noteDetailCopyBtn.textContent = 'Copied!';
    setTimeout(() => { noteDetailCopyBtn.textContent = 'Copy'; }, 1500);
  } catch (err) {
    showPanelError(`Couldn't copy: ${err.message}`);
  }
});

noteEditBackBtn.addEventListener('click', () => {
  destroyEditor();
  showNoteDetail(currentNote);
});

todoEditBackBtn.addEventListener('click', () => showNoteDetail(currentNote));

todoAddInput.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const content = todoAddInput.value.trim();
  if (!content) return;
  e.preventDefault();

  editingTodos.push({ id: crypto.randomUUID(), content, isCheck: false, checkedAt: '' });
  renderTodoEditList();
  todoAddInput.value = '';
});

todoEditSaveBtn.addEventListener('click', async () => {
  todoEditSaveBtn.disabled = true;
  todoEditSaveBtn.textContent = 'Saving…';
  todoEditError.style.display = 'none';

  try {
    await requestUpdateTodos(currentNote.id, editingTodos);

    const idx = allNotes.findIndex((n) => n.id === currentNote.id);
    if (idx !== -1) allNotes[idx].todos = editingTodos;
    currentNote = { ...currentNote, todos: editingTodos };

    showNoteDetail(currentNote);
  } catch (err) {
    todoEditSaveBtn.disabled = false;
    todoEditSaveBtn.textContent = 'Save';
    todoEditError.textContent = err.message || 'Save failed';
    todoEditError.style.display = 'block';
  }
});

noteEditSaveBtn.addEventListener('click', async () => {
  noteEditSaveBtn.disabled = true;
  noteEditSaveBtn.textContent = 'Saving…';
  noteEditError.style.display = 'none';

  try {
    const data = await editorInstance.save();
    await requestUpdateNote(currentNote.id, data);

    const idx = allNotes.findIndex((n) => n.id === currentNote.id);
    if (idx !== -1) allNotes[idx].note = data;
    currentNote = { ...currentNote, note: data };

    showNoteDetail(currentNote);
  } catch (err) {
    noteEditSaveBtn.disabled = false;
    noteEditSaveBtn.textContent = 'Save';
    noteEditError.textContent = err.message || 'Save failed';
    noteEditError.style.display = 'block';
  }
});

noteDetailContent.addEventListener('click', (e) => {
  const link = e.target.closest('a');
  if (link) {
    e.preventDefault();
    chrome.tabs.create({ url: link.href });
  }
});

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
  }
});

addNoteBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const isVisible = addNoteDropdown.style.display !== 'none';
  addNoteDropdown.style.display = isVisible ? 'none' : 'block';
});

document.addEventListener('click', () => {
  addNoteDropdown.style.display = 'none';
});

addFreetextBtn.addEventListener('click', () => {
  addNoteDropdown.style.display = 'none';
  showNoteCreate();
});

addTodolistBtn.addEventListener('click', () => {
  addNoteDropdown.style.display = 'none';
  showTodoCreate();
});

noteCreateBackBtn.addEventListener('click', () => {
  destroyCreateEditor();
  showHome();
});

noteCreateSaveBtn.addEventListener('click', async () => {
  const title = noteCreateTitleInput.value.trim();
  if (!title) {
    noteCreateError.textContent = 'Title is required';
    noteCreateError.style.display = 'block';
    return;
  }

  noteCreateSaveBtn.disabled = true;
  noteCreateSaveBtn.textContent = 'Saving…';
  noteCreateError.style.display = 'none';

  try {
    const data = await createEditorInstance.save();
    await requestCreateNote({ title, type: 'freetext', note: data });
    await destroyCreateEditor();
    await loadNotes();
    showHome();
  } catch (err) {
    noteCreateSaveBtn.disabled = false;
    noteCreateSaveBtn.textContent = 'Save';
    noteCreateError.textContent = err.message || 'Create failed';
    noteCreateError.style.display = 'block';
  }
});

todoCreateBackBtn.addEventListener('click', () => showHome());

todoCreateAddInput.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const content = todoCreateAddInput.value.trim();
  if (!content) return;
  e.preventDefault();

  creatingTodos.push({ id: crypto.randomUUID(), content, isCheck: false, checkedAt: '' });
  renderTodoCreateList();
  todoCreateAddInput.value = '';
});

todoCreateSaveBtn.addEventListener('click', async () => {
  const title = todoCreateTitleInput.value.trim();
  if (!title) {
    todoCreateError.textContent = 'Title is required';
    todoCreateError.style.display = 'block';
    return;
  }

  todoCreateSaveBtn.disabled = true;
  todoCreateSaveBtn.textContent = 'Saving…';
  todoCreateError.style.display = 'none';

  try {
    await requestCreateNote({ title, type: 'todolist', todos: creatingTodos });
    await loadNotes();
    showHome();
  } catch (err) {
    todoCreateSaveBtn.disabled = false;
    todoCreateSaveBtn.textContent = 'Save';
    todoCreateError.textContent = err.message || 'Create failed';
    todoCreateError.style.display = 'block';
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────
chrome.runtime.sendMessage({ action: 'checkSession' }, (res) => {
  if (res?.authenticated) showLoggedIn();
  else {
    showLoggedOut();
    const error = res?.error || chrome.runtime.lastError?.message;
    if (error) showError(error);
  }
});
