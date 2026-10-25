// The "Capture to Notespacehub" pill on job pages of the boards in
// job-sites.js (loaded ahead of this file with job-extract.js). Whether to
// show it is decided from the URL alone — the page is read (nshExtractJob,
// the detail panel only) when the pill is clicked, never in the background.
// The side panel's "This page" tab reads pages itself through
// chrome.scripting and doesn't talk to this script.

const PILL_ID = 'nsh-capture-pill';
const PILL_LABEL = 'Capture to Notespacehub';

let sites = NSH_DEFAULT_JOB_SITES;
let currentJob = null; // nshMatchJobPage's answer while the URL is a job page
let lastUrl = '';

// background.js keeps the API's copy of the config here.
chrome.storage.local.get(JOB_SITES_STORAGE_KEY, (res) => {
  sites = nshSitesFromStored(res?.[JOB_SITES_STORAGE_KEY]);
  lastUrl = '';
  refresh();
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes[JOB_SITES_STORAGE_KEY]) return;
  sites = nshSitesFromStored(changes[JOB_SITES_STORAGE_KEY].newValue);
  lastUrl = '';
  refresh();
});

function ensurePill() {
  let pill = document.getElementById(PILL_ID);
  if (pill) return pill;
  pill = document.createElement('button');
  pill.id = PILL_ID;
  pill.type = 'button';
  pill.innerHTML = `<span class="nsh-dot"></span><span class="nsh-label">${PILL_LABEL}</span>`;
  pill.addEventListener('click', onCapture);
  document.body.appendChild(pill);
  return pill;
}

function setState(state, label) {
  const pill = document.getElementById(PILL_ID);
  if (!pill) return;
  pill.dataset.state = state;
  const l = pill.querySelector('.nsh-label');
  if (label && l) l.textContent = label;
  pill.disabled = state === 'busy';
}

async function onCapture() {
  const job = currentJob;
  if (!job) return;
  setState('busy', 'Capturing…');
  const read = await nshExtractJob(job.site, job.sourceJobId, {
    waitMs: 2000,
    requireTitleLink: !!job.rule?.requireTitleLink,
  });
  if (read.status !== 'ok' || !read.job.title) {
    setState('error', 'No job found — select the text instead');
    setTimeout(() => setState('idle', PILL_LABEL), 8000);
    return;
  }
  const fields = { ...read.job, url: job.canonicalUrl, datePosted: '' };
  chrome.runtime.sendMessage(
    { action: 'capture', payload: { source: 'extension-structured', fields, sourceUrl: job.canonicalUrl } },
    (resp) => {
      const ok = !chrome.runtime.lastError && resp?.success;
      // The API's reason (e.g. an expired AI key) — left up longer than a
      // success so it can actually be read.
      const error = chrome.runtime.lastError?.message || resp?.error;
      const done = resp?.data?.review === 'panel' ? 'Captured — review it in the side panel' : 'Captured — opening draft';
      setState(ok ? 'done' : 'error', ok ? done : `Couldn't capture: ${error || 'unknown error'}`);
      setTimeout(() => setState('idle', PILL_LABEL), ok ? 3000 : 8000);
    },
  );
}

// LinkedIn and Glints change the URL without reloading the page, so the URL
// is checked every second — the URL only, which costs nothing.
function refresh() {
  if (location.href === lastUrl) return;
  lastUrl = location.href;
  const match = nshMatchJobPage(location.href, sites);
  currentJob = match?.sourceJobId ? match : null;
  if (currentJob) {
    ensurePill();
    if (document.getElementById(PILL_ID).dataset.state !== 'busy') setState('idle', PILL_LABEL);
  } else {
    document.getElementById(PILL_ID)?.remove();
  }
}
setInterval(refresh, 1000);
refresh();
