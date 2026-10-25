// "This page" tab: is the job open in the active tab a job, and has the user
// already saved it? Then one next step. Loaded after sidepanel.js and
// sidepanel-documents.js and uses their globals (escapeHtml, sendMessageAsync,
// openAppTab, showApplicationDocuments, loadRecentApplications, STATUS_LABEL,
// fitTone, FIT_MIN_DESCRIPTION_LENGTH, showDefaultTab, showLoggedOut,
// signedIn) and job-sites.js / job-extract.js.
//
// Pipeline, run while the panel is open (its listeners die with it), each
// time the active tab's URL changes — 500 ms after the last change, so
// clicking through a job list only processes the job the user stops on:
//   1. match the URL against the job sites (job-sites.js) → source + job id
//   2. render from the cache (10 min, chrome.storage.session) if it has it
//   3. GET /application/lookup → saved
//   4. else read the job off the page (job-extract.js via executeScript,
//      the detail panel only)
//   5. only if the page lacked a field the site's aiFill names, ask the AI
//      (POST /application/capture/extract) with the description alone,
//      capped at 8,000 characters
// pageRun is bumped by every run, and anything awaited checks it, so a slow
// answer for a job the user already left never lands on screen.
//
// AI answers (fields and fit) are kept per job in chrome.storage.local for a
// week, so a job seen before costs no tokens; the fit check only runs when
// asked.

const thisPageBody = document.getElementById('thisPageBody');
const panelToast = document.getElementById('panelToast');

const PAGE_DEBOUNCE_MS = 500;
const PAGE_CACHE_PREFIX = 'thisPage:';
const PAGE_CACHE_MAX_AGE_MS = 10 * 60 * 1000;
const AI_CACHE_PREFIX = 'jobAi:';
const AI_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const AI_TEXT_LIMIT = 8000; // POST /application/capture/extract and the fit check
const PAGE_WAIT_MS = 5000; // for the detail panel to show the job in the URL
const UP_NEXT_MAX_AGE_MS = 2 * 60 * 1000;
const TOAST_MS = 6000;

// notehub-app's STATUS_DOT_COLOR (module/application/utils.ts), as hex.
const STAGE_COLOR = {
  SAVED: '#9ca3af',
  APPLIED: '#60a5fa',
  SCREENING: '#fbbf24',
  INTERVIEW: '#84cc16',
  OFFER: '#16a34a',
  REJECTED: '#f87171',
};

let jobSites = NSH_DEFAULT_JOB_SITES;
let pageRun = 0;
let pageTimer = null;
let panelWindowId = null;
let upNext = null; // { at, items } — the not-a-job-page list
let toastTimer = null;
let page = blankPage();

function blankPage(state = 'not_job_page') {
  return {
    state,
    key: null, // `${source}:${sourceJobId}`
    tabId: null,
    match: null, // nshMatchJobPage's answer
    job: null, // { title, company, location, salary, description }
    application: null, // the lookup's answer while saved
    possible: null, // a company + role lookalike while unsaved
    fit: { status: 'idle' },
    editing: false,
    form: null, // the edit form's values, kept across re-renders
    step: null, // 'followup' | 'interview' while that inline form is open
    busy: false, // a next step is being saved
    message: '', // an error for the action just tried
    note: '', // what the action just did ("Marked as applied")
    rereading: false, // "Read the description again" is running
    unreadableReason: '', // why "Couldn't read this job", in words
    savingFrom: null, // 'unsaved' | 'unreadable' — which view the save started in
    signedOut: false, // the error state's error was an auth one
  };
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function isoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// "today", "3d", "2w", "5mo" — for "saved 3d ago".
function shortAgo(dateStr) {
  const days = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  if (days < 1) return 'today';
  if (days < 14) return `${days}d ago`;
  if (days < 60) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function formatDay(dateStr) {
  return new Date(dateStr).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatDateTime(dateStr) {
  return new Date(dateStr).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const isSignedOut = (err) => err?.code === 'UNAUTHENTICATED' || err?.status === 401 || err?.status === 403;

// The lookup's fields, from a full application the API answered with.
function asLookup(app, match = 'source') {
  const { id, company, role, status, jobUrl, dateApplied, nextFollowUp, createdAt, updatedAt } = app;
  return { id, company, role, status, jobUrl, dateApplied, nextFollowUp, createdAt, updatedAt, match };
}

// ── Caches ────────────────────────────────────────────────────────────────────

async function readCache(area, key, maxAge) {
  try {
    const { [key]: entry } = await chrome.storage[area].get(key);
    return entry && Date.now() - entry.at < maxAge ? entry : null;
  } catch (_) {
    return null;
  }
}

async function writeCache(area, key, patch) {
  try {
    const { [key]: previous } = await chrome.storage[area].get(key);
    await chrome.storage[area].set({ [key]: { ...(previous || {}), ...patch, at: Date.now() } });
  } catch (_) {}
}

// Now and then, drop week-old AI answers so storage.local doesn't grow forever.
async function pruneAiCache() {
  if (Math.random() > 0.05) return;
  try {
    const all = await chrome.storage.local.get(null);
    const stale = Object.keys(all).filter(
      (k) => k.startsWith(AI_CACHE_PREFIX) && Date.now() - (all[k]?.at || 0) > AI_CACHE_MAX_AGE_MS,
    );
    if (stale.length) await chrome.storage.local.remove(stale);
  } catch (_) {}
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

async function startThisPage() {
  try {
    panelWindowId = (await chrome.windows.getCurrent()).id;
  } catch (_) {}
  try {
    jobSites = await sendMessageAsync({ action: 'getJobSites' });
  } catch (_) {}
  checkActivePage({ force: true });
}

function schedulePageCheck() {
  clearTimeout(pageTimer);
  pageTimer = setTimeout(() => checkActivePage(), PAGE_DEBOUNCE_MS);
}

// LinkedIn and Glints change the URL without a reload; onUpdated reports
// that (the url is only there for sites the extension has host access to —
// leaving for any other site shows as a 'loading' status instead).
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (!signedIn || !tab.active || (panelWindowId != null && tab.windowId !== panelWindowId)) return;
  if (changeInfo.url || changeInfo.status === 'loading') schedulePageCheck();
});

chrome.tabs.onActivated.addListener(({ windowId }) => {
  if (!signedIn || (panelWindowId != null && windowId !== panelWindowId)) return;
  schedulePageCheck();
});

// checkSeq orders the checks themselves (the tab query can be slow);
// pageRun only moves when a check starts over on another job or page, so a
// focus event on the same job never cancels the read already under way.
let checkSeq = 0;

async function checkActivePage({ force = false } = {}) {
  if (!signedIn) return;
  clearTimeout(pageTimer);
  const seq = ++checkSeq;

  let tab = null;
  try {
    [tab] = await chrome.tabs.query(
      panelWindowId != null ? { active: true, windowId: panelWindowId } : { active: true, currentWindow: true },
    );
  } catch (_) {}
  if (seq !== checkSeq) return;

  // tab.url is only readable for the job sites' hosts (host permissions);
  // any other page has none and is simply not a job page.
  let match = nshMatchJobPage(tab?.url || '', jobSites);
  if (match && !match.sourceJobId && match.backupId && tab?.id != null) {
    const read = await readPage(tab.id, match.site, null, { mode: 'linkId', waitMs: 1500 });
    if (seq !== checkSeq) return;
    match = read.status === 'ok' && read.linkId ? nshJobFromId(match.site, read.linkId) : null;
  }
  if (!match?.sourceJobId) {
    pageRun++;
    showNotJobPage();
    return;
  }

  const key = `${match.source}:${match.sourceJobId}`;
  if (!force && key === page.key && tab.id === page.tabId) {
    if (['unsaved', 'saving', 'saved'].includes(page.state)) revalidate(pageRun);
    // Still loading, or unreadable with the user's form open: leave it be.
    if (page.state !== 'error') return;
  }
  const run = ++pageRun;
  if (key !== page.key) showDefaultTab(true);
  await loadJob(run, tab.id, match, key, force);
}

function showNotJobPage() {
  const wasJob = page.key !== null;
  if (wasJob || page.state !== 'not_job_page') page = blankPage();
  if (wasJob) showDefaultTab(false);
  renderThisPage();
  loadUpNext();
}

async function loadJob(run, tabId, match, key, force) {
  page = { ...blankPage('loading'), key, tabId, match };
  const [cached, ai] = await Promise.all([
    force ? null : readCache('session', PAGE_CACHE_PREFIX + key, PAGE_CACHE_MAX_AGE_MS),
    readCache('local', AI_CACHE_PREFIX + key, AI_CACHE_MAX_AGE_MS),
  ]);
  if (run !== pageRun) return;
  if (ai?.fit) page.fit = { status: 'done', result: ai.fit };
  if (cached?.job) page.job = cached.job;
  if (cached?.application) page.state = 'saved';
  else if (cached?.job) page.state = 'unsaved';
  page.application = cached?.application || null;
  renderThisPage();

  let application;
  try {
    application = await lookup(match);
  } catch (err) {
    if (run === pageRun) failPage(err);
    return;
  }
  if (run !== pageRun) return;
  if (application) {
    showSaved(application);
    return;
  }
  page.application = null;

  if (!page.job) {
    if (page.state !== 'loading') {
      page.state = 'loading';
      renderThisPage();
    }
    const read = await readPage(tabId, match.site, match.sourceJobId, {
      waitMs: PAGE_WAIT_MS,
      requireTitleLink: !!match.rule?.requireTitleLink,
    });
    if (run !== pageRun) return;
    if (read.status !== 'ok') {
      showUnreadable(null, read.reason);
      return;
    }
    page.job = read.job;
    await fillWithAi(run, key, ai);
    if (run !== pageRun) return;
    if (!page.job.title || !page.job.company) {
      showUnreadable(page.job, 'fields');
      return;
    }
    writeCache('session', PAGE_CACHE_PREFIX + key, { job: page.job, application: null });
  }
  page.state = 'unsaved';
  renderThisPage();
  findPossibleMatch(run);
}

function lookup(match, job = null) {
  return sendMessageAsync({
    action: 'lookupJob',
    query: {
      source: match.source,
      sourceJobId: match.sourceJobId,
      company: job?.company || undefined,
      role: job?.title || undefined,
    },
  });
}

async function readPage(tabId, site, jobId, options) {
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      func: nshExtractJob,
      args: [site, jobId, options],
    });
    return injection?.result || { status: 'unreadable', reason: 'error' };
  } catch (_) {
    // A tab the extension can't script (closed meanwhile, an error page…).
    return { status: 'unreadable', reason: 'error' };
  }
}

// Only the fields the site's aiFill names and the page didn't give, from the
// cleaned description alone. The answer is cached whatever it holds, so the
// same job never asks twice.
async function fillWithAi(run, key, ai) {
  const wanted = (page.match.site.aiFill || []).filter((field) => !page.job[field]);
  if (!wanted.length) return;
  const apply = (fields) =>
    wanted.forEach((field) => {
      const value = String(fields?.[field] || '').replace(/\s+/g, ' ').trim().slice(0, 200);
      if (value) page.job[field] = value;
    });
  if (ai?.fields) {
    apply(ai.fields);
    return;
  }
  const text = page.job.description.slice(0, AI_TEXT_LIMIT);
  if (text.length < FIT_MIN_DESCRIPTION_LENGTH) return;
  // What the page gave is enough to show while the AI fills in the rest.
  if (page.job.title && page.job.company) {
    page.state = 'unsaved';
    renderThisPage();
  }
  try {
    const fields = await sendMessageAsync({ action: 'extractJobFields', text });
    const { title, company, location, salary } = fields || {};
    writeCache('local', AI_CACHE_PREFIX + key, { fields: { title, company, location, salary } });
    pruneAiCache();
    if (run === pageRun) apply(fields);
  } catch (_) {
    // The page's own fields stand; without a title and company the job
    // shows as unreadable, with the form.
  }
}

async function findPossibleMatch(run) {
  if (!page.job?.title || !page.job?.company) return;
  try {
    const found = await lookup(page.match, page.job);
    if (run !== pageRun || !found) return;
    if (found.match === 'source') showSaved(found);
    else {
      page.possible = found;
      renderThisPage();
    }
  } catch (_) {}
}

// Same job, panel refocused or the page re-rendered: only ask the API again,
// so a stage changed in the web app shows here.
async function revalidate(run) {
  if (page.state === 'saving' || page.busy || page.step || page.editing) return;
  try {
    const found = await lookup(page.match, page.state === 'unsaved' ? page.job : null);
    if (run !== pageRun) return;
    if (found?.match === 'source') showSaved(found);
    else if (page.state === 'saved') loadJob(run, page.tabId, page.match, page.key, true);
    else if (found && !page.possible) {
      page.possible = found;
      renderThisPage();
    }
  } catch (_) {}
}

function showSaved(application) {
  page.application = application;
  page.possible = null;
  page.state = 'saved';
  page.editing = false;
  writeCache('session', PAGE_CACHE_PREFIX + page.key, { job: page.job, application });
  renderThisPage();
}

// Why the read failed, in words — nshExtractJob's reasons, plus 'fields'
// when a job was read but had no title or company.
const UNREADABLE_REASON = {
  'no-root': 'The job panel wasn’t found on the page.',
  stale: 'The page kept showing a different job.',
  empty: 'The job panel had no title or description.',
  error: 'The page couldn’t be read.',
  fields: 'The title or company wasn’t found.',
};

function showUnreadable(partial, reason) {
  page.state = 'unreadable';
  page.editing = true;
  page.form = jobForm(partial);
  page.unreadableReason = UNREADABLE_REASON[reason] || '';
  renderThisPage();
}

function failPage(err) {
  page.state = 'error';
  page.message = err.message || 'Something went wrong';
  page.signedOut = isSignedOut(err);
  renderThisPage();
}

// ── Saving ────────────────────────────────────────────────────────────────────

function jobForm(job) {
  return {
    company: job?.company || '',
    role: job?.title || '',
    location: job?.location || '',
    salaryRange: job?.salary || '',
    jobUrl: page.match?.canonicalUrl || '',
    jobDescription: job?.description || '',
  };
}

async function saveThisJob() {
  const fields = page.editing ? { ...page.form } : jobForm(page.job);
  Object.keys(fields).forEach((k) => (fields[k] = fields[k].trim()));
  if (!fields.company || !fields.role) {
    page.message = 'Company and role are required.';
    renderThisPage();
    return;
  }
  const { key, match } = page;
  const before = page.state;
  page.state = 'saving';
  page.savingFrom = before;
  page.message = '';
  renderThisPage();

  try {
    const created = await sendMessageAsync({
      action: 'saveJob',
      job: { ...fields, source: match.source, sourceJobId: match.sourceJobId },
    });
    const application = asLookup(created);
    const job = { ...(page.job || {}), title: fields.role, company: fields.company, location: fields.location, salary: fields.salaryRange, description: fields.jobDescription };
    writeCache('session', PAGE_CACHE_PREFIX + key, { job, application });
    loadRecentApplications();
    upNext = null;
    if (page.key !== key) return;
    page.job = job;
    showSaved(application);
    showToast('Saved', 'Open in Notespacehub', () => openAppTab(`/applications/${created.id}`));
  } catch (err) {
    if (page.key !== key) return;
    if (err.status === 409) {
      // Saved meanwhile (another tab, a double click) — show that one.
      const existing = await lookup(match).catch(() => null);
      if (existing && page.key === key) {
        showSaved(existing);
        return;
      }
    }
    if (isSignedOut(err)) {
      failPage(err);
      return;
    }
    page.state = before;
    page.message = `Couldn't save: ${err.message}`;
    renderThisPage();
  }
}

// ── Next steps (saved) ────────────────────────────────────────────────────────

async function runStep(request, describe) {
  const { key } = page;
  page.busy = true;
  page.message = '';
  page.note = '';
  renderThisPage();
  try {
    const result = await sendMessageAsync({ action: 'api', ...request });
    if (page.key !== key) return;
    if (result?.status && result?.company) page.application = asLookup(result, page.application.match);
    page.step = null;
    page.note = describe(result);
    writeCache('session', PAGE_CACHE_PREFIX + key, { job: page.job, application: page.application });
    loadRecentApplications();
    upNext = null; // a follow-up or interview just changed
  } catch (err) {
    if (page.key !== key) return;
    page.message = err.message || 'That didn’t work';
  }
  page.busy = false;
  renderThisPage();
}

function markApplied() {
  runStep(
    { method: 'PUT', path: `/application/${page.application.id}`, body: { status: 'APPLIED', dateApplied: isoDate(new Date()) } },
    () => 'Marked as applied today.',
  );
}

function saveFollowUp(date) {
  if (!date) return;
  runStep(
    { method: 'PUT', path: `/application/${page.application.id}`, body: { nextFollowUp: date } },
    () => `Follow-up set for ${formatDay(date)}.`,
  );
}

function saveInterview(localDateTime, round) {
  const at = new Date(localDateTime);
  if (!localDateTime || Number.isNaN(at.getTime())) return;
  runStep(
    {
      method: 'POST',
      path: '/interview',
      body: {
        applicationId: page.application.id,
        scheduledAt: at.toISOString(),
        round: round.trim() || undefined,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    },
    () => `Interview added for ${formatDateTime(at)}.`,
  );
}

// ── Fit check ─────────────────────────────────────────────────────────────────

async function checkFit() {
  const { key, job } = page;
  const description = (job?.description || '').slice(0, AI_TEXT_LIMIT);
  if (description.length < FIT_MIN_DESCRIPTION_LENGTH) return;
  page.fit = { status: 'loading' };
  renderThisPage();
  try {
    const result = await sendMessageAsync({
      action: 'analyzeJobFit',
      input: {
        jobDescription: description,
        company: job.company || undefined,
        role: job.title || undefined,
        location: job.location || undefined,
      },
    });
    writeCache('local', AI_CACHE_PREFIX + key, { fit: result });
    pruneAiCache();
    if (page.key !== key) return;
    page.fit = { status: 'done', result };
  } catch (err) {
    if (page.key !== key) return;
    page.fit = { status: 'error', error: err.message };
  }
  renderThisPage();
}

// LinkedIn renders "About the job" in a section of its own, sometimes only
// once it's scrolled into view — so a description missing the first time can
// be read again on request.
async function rereadDescription() {
  const { key, tabId, match } = page;
  page.rereading = true;
  page.message = '';
  renderThisPage();
  const read = await readPage(tabId, match.site, match.sourceJobId, {
    waitMs: 1500,
    requireTitleLink: !!match.rule?.requireTitleLink,
  });
  if (page.key !== key) return;
  page.rereading = false;
  if (read.status === 'ok' && read.job.description) {
    page.job = {
      ...page.job,
      description: read.job.description,
      location: page.job.location || read.job.location,
      salary: page.job.salary || read.job.salary,
    };
    if (page.form && !page.form.jobDescription) page.form.jobDescription = read.job.description;
    writeCache('session', PAGE_CACHE_PREFIX + key, { job: page.job, application: null });
  } else {
    page.message = 'Still no description on the page. Scroll the job to “About the job”, then try again.';
  }
  renderThisPage();
}

// ── Up next (not a job page) ──────────────────────────────────────────────────

async function loadUpNext() {
  if (upNext && Date.now() - upNext.at < UP_NEXT_MAX_AGE_MS) return;
  const followUpTo = isoDate(addDays(new Date(), 3));
  const [summary, followUps] = await Promise.all([
    sendMessageAsync({ action: 'api', path: '/home/summary' }).catch(() => null),
    sendMessageAsync({
      action: 'api',
      path: `/application?followUpTo=${followUpTo}&status=APPLIED,SCREENING,INTERVIEW&limit=3`,
    }).catch(() => []),
  ]);
  const items = [
    ...(summary?.interviews || []).map((i) => ({
      kind: 'interview',
      applicationId: i.applicationId,
      what: [i.title || 'Interview', i.companyName].filter(Boolean).join(' · '),
      at: i.startsAt,
    })),
    ...(Array.isArray(followUps) ? followUps : [])
      .filter((a) => a.nextFollowUp)
      .map((a) => ({ kind: 'followup', applicationId: a.id, what: `Follow up · ${a.company}`, at: a.nextFollowUp })),
  ]
    .sort((a, b) => new Date(a.at) - new Date(b.at))
    .slice(0, 4);
  upNext = { at: Date.now(), items };
  if (page.state === 'not_job_page') renderThisPage();
}

// ── Rendering ─────────────────────────────────────────────────────────────────

const spinner = '<span class="tp-spinner" aria-hidden="true"></span>';

function jobHeader(job, site) {
  const meta = [job.company, job.location, site?.label].filter(Boolean).map(escapeHtml).join(' · ');
  return `
    <h2 class="tp-title">${escapeHtml(job.title || 'Untitled role')}</h2>
    <p class="tp-meta">${meta}</p>
    ${job.salary ? `<p class="tp-salary">${escapeHtml(job.salary)}</p>` : ''}`;
}

function stageBadge(status) {
  return `<span class="tp-stage"><span class="tp-dot" style="background:${STAGE_COLOR[status] || '#9ca3af'}"></span>${escapeHtml(STATUS_LABEL[status] || status)}</span>`;
}

function messages() {
  return [
    page.message ? `<p class="doc-error">${escapeHtml(page.message)}</p>` : '',
    page.note ? `<p class="tp-note">${escapeHtml(page.note)}</p>` : '',
  ].join('');
}

function renderNotJobPage() {
  const items = upNext?.items || [];
  return `
    <div class="tp-empty">
      <p class="tp-empty-title">No job on this page</p>
      <p class="tp-muted">Open a job on LinkedIn or Glints, or highlight text and right-click → <b>Capture job</b>.</p>
    </div>
    ${
      items.length
        ? `<section class="tp-section">
            <p class="tp-section-title">Up next</p>
            ${items
              .map((item) => {
                const overdue = item.kind === 'followup' && new Date(item.at) < new Date(isoDate(new Date()));
                const when = overdue ? 'Overdue' : item.kind === 'interview' ? formatDateTime(item.at) : formatDay(item.at);
                return `
                  <button type="button" class="tp-upnext" data-action="open-app" data-id="${escapeHtml(item.applicationId)}">
                    <span class="tp-upnext-when${overdue ? ' tp-overdue' : ''}">${escapeHtml(when)}</span>
                    <span class="tp-upnext-what">${escapeHtml(item.what)}</span>
                  </button>`;
              })
              .join('')}
          </section>`
        : ''
    }`;
}

function renderLoading() {
  return `
    <div class="tp-card" aria-busy="true">
      <span class="tp-skel" style="width:72%;height:16px"></span>
      <span class="tp-skel" style="width:48%"></span>
      <span class="tp-skel" style="width:100%;height:34px;margin-top:8px"></span>
      <span class="tp-skel" style="width:40%"></span>
    </div>
    <p class="tp-muted tp-center">Reading this job…</p>`;
}

function renderFit() {
  const { fit } = page;
  const description = page.job?.description || '';
  if (fit.status === 'loading') {
    return `<div class="tp-fit"><span class="tp-muted">${spinner} Checking how your Master Profile fits…</span></div>`;
  }
  if (fit.status === 'done') {
    const { score, summary } = fit.result;
    const tone = fitTone(score);
    const missing = Array.isArray(fit.result.missing) ? fit.result.missing : [];
    return `
      <div class="tp-fit">
        <div class="tp-fit-head">
          <span class="tp-score" style="color:${tone.color}">${escapeHtml(score)}<small>/100</small></span>
          <span class="tp-fit-label">${escapeHtml(tone.label)}</span>
          <button type="button" class="doc-link tp-push" data-action="check-fit">Recalculate</button>
        </div>
        ${summary ? `<p class="tp-muted">${escapeHtml(summary)}</p>` : ''}
        ${
          missing.length
            ? `<details class="tp-gaps"${page.fitOpen ? ' open' : ''}>
                <summary>See gaps</summary>
                ${missing
                  .map(
                    (group) => `
                  <p class="tp-gap-cat">${escapeHtml(group.category)}</p>
                  <div class="tp-chips">${(group.items || []).map((item) => `<span class="tp-chip">${escapeHtml(item)}</span>`).join('')}</div>`,
                  )
                  .join('')}
              </details>`
            : '<p class="tp-good">Your profile covers everything this job asks for.</p>'
        }
      </div>`;
  }
  const short = description.length < FIT_MIN_DESCRIPTION_LENGTH;
  return `
    <div class="tp-fit">
      <button type="button" class="doc-btn" data-action="check-fit"${short ? ' disabled' : ''}>Check fit</button>
      ${fit.status === 'error' ? `<p class="doc-error">Couldn't check the fit: ${escapeHtml(fit.error)}</p>` : ''}
      ${
        short
          ? `<p class="tp-muted">No job description found on the page.
              <button type="button" class="doc-link" data-action="reread"${page.rereading ? ' disabled' : ''}>${
                page.rereading ? `${spinner} Reading…` : 'Read the description again'
              }</button></p>`
          : ''
      }
    </div>`;
}

function renderForm() {
  const f = page.form || jobForm(null);
  const input = (name, label, placeholder, required) => `
    <label class="tp-field">
      <span>${label}${required ? ' *' : ''}</span>
      <input class="doc-input" name="${name}" value="${escapeHtml(f[name])}" placeholder="${escapeHtml(placeholder)}" />
    </label>`;
  return `
    <form class="tp-form" data-form="job">
      ${input('company', 'Company', 'Acme Inc.', true)}
      ${input('role', 'Role', 'Frontend Engineer', true)}
      <div class="tp-row">
        ${input('location', 'Location', 'Remote')}
        ${input('salaryRange', 'Salary range', 'Rp 8–12 jt')}
      </div>
      ${input('jobUrl', 'Job URL', 'https://…')}
      <label class="tp-field">
        <span>Job description</span>
        <textarea class="doc-input" name="jobDescription" rows="6">${escapeHtml(f.jobDescription)}</textarea>
      </label>
    </form>`;
}

function saveButton(label = 'Save this job') {
  const saving = page.state === 'saving';
  return `<button type="button" class="doc-btn doc-btn-primary tp-primary" data-action="save"${saving ? ' disabled' : ''}>${saving ? `${spinner} Saving…` : label}</button>`;
}

function renderUnsaved() {
  const { job, possible } = page;
  return `
    ${
      possible
        ? `<div class="tp-banner">
            Looks like you saved this already — ${escapeHtml(possible.role)} at ${escapeHtml(possible.company)}, ${escapeHtml(STATUS_LABEL[possible.status] || possible.status)}.
            <button type="button" class="doc-link" data-action="open-app" data-id="${escapeHtml(possible.id)}">Open</button>
          </div>`
        : ''
    }
    <div class="tp-card">
      ${jobHeader(job, page.match.site)}
      ${renderFit()}
    </div>
    ${page.editing ? renderForm() : ''}
    ${messages()}
    <div class="tp-actions">
      ${saveButton()}
      ${
        page.editing
          ? '<button type="button" class="doc-link" data-action="cancel-edit">Cancel</button>'
          : '<button type="button" class="doc-link" data-action="edit">Edit details before saving</button>'
      }
    </div>`;
}

function renderUnreadable() {
  return `
    <div class="tp-banner tp-banner-warn">
      Couldn't read this job. Highlight the job description and right-click → <b>Capture job</b>, or fill in the details.
      ${page.unreadableReason ? `<span class="tp-reason">${escapeHtml(page.unreadableReason)}</span>` : ''}
    </div>
    ${renderForm()}
    ${messages()}
    <div class="tp-actions">${saveButton()}</div>`;
}

function nextStep(app) {
  const disabled = page.busy ? ' disabled' : '';
  const busy = (label) => (page.busy ? `${spinner} ${label}` : label);
  if (page.step === 'followup') {
    const value = app.nextFollowUp ? isoDate(new Date(app.nextFollowUp)) : isoDate(addDays(new Date(), 7));
    return `
      <form class="tp-step" data-form="followup">
        <label class="tp-field"><span>Follow up on</span><input class="doc-input" type="date" name="date" value="${value}" required /></label>
        <div class="tp-actions">
          <button type="submit" class="doc-btn doc-btn-primary"${disabled}>${busy('Set follow-up')}</button>
          <button type="button" class="doc-link" data-action="cancel-step">Cancel</button>
        </div>
      </form>`;
  }
  if (page.step === 'interview') {
    const tomorrow = addDays(new Date(), 1);
    return `
      <form class="tp-step" data-form="interview">
        <label class="tp-field"><span>When</span><input class="doc-input" type="datetime-local" name="at" value="${isoDate(tomorrow)}T10:00" required /></label>
        <label class="tp-field"><span>Round</span><input class="doc-input" name="round" placeholder="e.g. HR screen" /></label>
        <div class="tp-actions">
          <button type="submit" class="doc-btn doc-btn-primary"${disabled}>${busy('Add interview')}</button>
          <button type="button" class="doc-link" data-action="cancel-step">Cancel</button>
        </div>
      </form>`;
  }
  switch (app.status) {
    case 'SAVED':
      return `<button type="button" class="doc-btn doc-btn-primary tp-primary" data-action="mark-applied"${disabled}>${busy('Mark as Applied')}</button>`;
    case 'APPLIED':
      return `<button type="button" class="doc-btn doc-btn-primary tp-primary" data-action="step" data-step="followup">${app.nextFollowUp ? 'Change follow-up' : 'Set follow-up'}</button>`;
    case 'SCREENING':
    case 'INTERVIEW':
      return `<button type="button" class="doc-btn doc-btn-primary tp-primary" data-action="step" data-step="interview">Add interview</button>`;
    default:
      return `<button type="button" class="doc-btn doc-btn-primary tp-primary" data-action="open-app" data-id="${escapeHtml(app.id)}">Open in Notespacehub</button>`;
  }
}

function renderSaved() {
  const app = page.application;
  const opensApp = !['SAVED', 'APPLIED', 'SCREENING', 'INTERVIEW'].includes(app.status);
  return `
    <div class="tp-card">
      <h2 class="tp-title">${escapeHtml(app.role)}</h2>
      <p class="tp-meta">${escapeHtml(app.company)} · ${stageBadge(app.status)} · saved ${escapeHtml(shortAgo(app.createdAt))}</p>
      ${app.nextFollowUp ? `<p class="tp-muted">Follow-up ${escapeHtml(formatDay(app.nextFollowUp))}</p>` : ''}
    </div>
    ${messages()}
    <div class="tp-actions tp-actions-stack">${nextStep(app)}</div>
    <div class="tp-links">
      <button type="button" class="doc-link" data-action="docs">Tailor CV (PDF)</button>
      <button type="button" class="doc-link" data-action="docs">Write cover letter</button>
      <button type="button" class="doc-link" data-action="add-note">Add a note</button>
      ${opensApp ? '' : `<button type="button" class="doc-link" data-action="open-app" data-id="${escapeHtml(app.id)}">Open in Notespacehub ↗</button>`}
    </div>`;
}

function renderError() {
  return `
    <div class="tp-empty">
      <p class="tp-empty-title">${page.signedOut ? "You're signed out" : "Couldn't check this job"}</p>
      <p class="tp-muted">${escapeHtml(page.message)}</p>
      ${
        page.signedOut
          ? '<button type="button" class="doc-btn doc-btn-primary" data-action="sign-in">Sign in</button>'
          : '<button type="button" class="doc-btn" data-action="retry">Retry</button>'
      }
    </div>`;
}

function renderThisPage() {
  const views = {
    not_job_page: renderNotJobPage,
    loading: renderLoading,
    unsaved: renderUnsaved,
    saving: () => (page.savingFrom === 'unreadable' ? renderUnreadable() : renderUnsaved()),
    saved: renderSaved,
    unreadable: renderUnreadable,
    error: renderError,
  };
  thisPageBody.innerHTML = (views[page.state] || renderNotJobPage)();
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function showToast(text, actionLabel, onAction) {
  clearTimeout(toastTimer);
  panelToast.innerHTML = `<span>${escapeHtml(text)}</span>${
    actionLabel ? ` · <button type="button" class="tp-toast-action">${escapeHtml(actionLabel)}</button>` : ''
  }`;
  panelToast.querySelector('.tp-toast-action')?.addEventListener('click', () => {
    panelToast.style.display = 'none';
    onAction();
  });
  panelToast.style.display = 'flex';
  toastTimer = setTimeout(() => (panelToast.style.display = 'none'), TOAST_MS);
}

// ── Events ────────────────────────────────────────────────────────────────────

thisPageBody.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn || btn.disabled) return;
  const app = page.application;
  switch (btn.dataset.action) {
    case 'save':
      saveThisJob();
      break;
    case 'edit':
      page.editing = true;
      page.form = jobForm(page.job);
      renderThisPage();
      thisPageBody.querySelector('[name="company"]')?.focus();
      break;
    case 'cancel-edit':
      page.editing = false;
      page.message = '';
      renderThisPage();
      break;
    case 'check-fit':
      checkFit();
      break;
    case 'reread':
      rereadDescription();
      break;
    case 'mark-applied':
      markApplied();
      break;
    case 'step':
      page.step = btn.dataset.step;
      page.message = '';
      page.note = '';
      renderThisPage();
      thisPageBody.querySelector('.tp-step input')?.focus();
      break;
    case 'cancel-step':
      page.step = null;
      page.message = '';
      renderThisPage();
      break;
    case 'docs':
      if (app) showApplicationDocuments({ id: app.id, role: app.role, company: app.company });
      break;
    case 'add-note':
      if (app) openAppTab(`/applications/${app.id}?tab=notes`);
      break;
    case 'open-app':
      openAppTab(`/applications/${btn.dataset.id}`);
      break;
    case 'retry':
      checkActivePage({ force: true });
      break;
    case 'sign-in':
      showLoggedOut();
      break;
  }
});

// "See gaps" stays open across re-renders.
thisPageBody.addEventListener(
  'toggle',
  (e) => {
    if (e.target.matches?.('.tp-gaps')) page.fitOpen = e.target.open;
  },
  true,
);

thisPageBody.addEventListener('input', (e) => {
  const form = e.target.closest('form[data-form="job"]');
  if (form && page.form && e.target.name in page.form) page.form[e.target.name] = e.target.value;
});

thisPageBody.addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;
  if (form.dataset.form === 'job') saveThisJob();
  if (form.dataset.form === 'followup') saveFollowUp(form.elements.date.value);
  if (form.dataset.form === 'interview') saveInterview(form.elements.at.value, form.elements.round.value);
});

renderThisPage();
