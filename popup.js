const APP_BASE = 'https://notespacehub.com';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const viewLoading = document.getElementById('view-loading');
const viewLoggedOut = document.getElementById('view-logged-out');
const viewLoggedIn = document.getElementById('view-logged-in');
const viewNoteDetail = document.getElementById('view-note-detail');
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
      chrome.tabs.create({ url: `${APP_BASE}/folder/${item.id}` });
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
  } catch {
    notesLoadingEl.style.display = 'none';
    notesEmptyEl.style.display = 'flex';
    notesEmptyMsg.textContent = 'Failed to load notes';
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
  loadNotes();
}

function showLoggedOut() {
  viewLoading.style.display = 'none';
  viewLoggedIn.style.display = 'none';
  viewNoteDetail.style.display = 'none';
  viewNoteCreate.style.display = 'none';
  viewTodoCreate.style.display = 'none';
  viewLoggedOut.style.display = 'flex';
}

async function showNoteDetail(item) {
  currentNote = item;
  viewLoggedIn.style.display = 'none';
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
    chrome.tabs.create({ url: `${APP_BASE}/write/${item.id}` });
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
      tools: {
        header: Header,
        list: EditorjsList,
        checklist: Checklist,
        quote: Quote,
      },
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
}

function showHome() {
  viewNoteDetail.style.display = 'none';
  viewNoteEdit.style.display = 'none';
  viewTodoEdit.style.display = 'none';
  viewNoteCreate.style.display = 'none';
  viewTodoCreate.style.display = 'none';
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
    tools: {
      header: Header,
      list: EditorjsList,
      checklist: Checklist,
      quote: Quote,
    },
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
    tools: {
      header: Header,
      list: EditorjsList,
      checklist: Checklist,
      quote: Quote,
    },
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
    else showError(res?.error || 'Sign in failed. Please try again.');
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

noteDetailBackBtn.addEventListener('click', showHome);

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
  } catch (_) {}
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
  else showLoggedOut();
});
