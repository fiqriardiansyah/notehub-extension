/**
 * MAINTENANCE: LinkedIn changes class names periodically. If DOM extraction
 * stops finding a field, update the arrays below — each field tries its
 * selectors in order. JSON-LD is preferred and usually keeps working.
 */
const SELECTORS = {
  title: [
    '.job-details-jobs-unified-top-card__job-title',
    '.jobs-unified-top-card__job-title',
    'h1',
  ],
  company: [
    '.job-details-jobs-unified-top-card__company-name a',
    '.job-details-jobs-unified-top-card__company-name',
    'a[href*="/company/"]',
  ],
  location: [
    '.job-details-jobs-unified-top-card__primary-description-container span.tvm__text',
    '.job-details-jobs-unified-top-card__bullet',
    '.jobs-unified-top-card__bullet',
  ],
  description: [
    '#job-details',
    '.jobs-description__content .jobs-box__html-content',
    '.jobs-description-content__text',
    '.jobs-box__html-content',
  ],
};

const PILL_ID = 'nsh-capture-pill';
let lastSignature = '';
let lastJob = null;

function textFrom(sels) {
  for (const s of sels) {
    const el = document.querySelector(s);
    const t = el?.textContent?.trim();
    if (t) return t.replace(/\s+/g, ' ');
  }
  return '';
}

function stripHtml(html) {
  const d = document.createElement('div');
  d.innerHTML = html || '';
  return (d.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}

function fromJsonLd() {
  for (const node of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const parsed = JSON.parse(node.textContent);
      const list = Array.isArray(parsed) ? parsed : parsed['@graph'] || [parsed];
      for (const c of list) {
        if (c?.['@type'] !== 'JobPosting') continue;
        const org = c.hiringOrganization;
        const loc = Array.isArray(c.jobLocation) ? c.jobLocation[0] : c.jobLocation;
        const addr = loc?.address;
        return {
          title: c.title || '',
          company: (typeof org === 'string' ? org : org?.name) || '',
          location: [addr?.addressLocality, addr?.addressRegion, addr?.addressCountry].filter(Boolean).join(', '),
          description: stripHtml(c.description),
          datePosted: c.datePosted || '',
        };
      }
    } catch (_) {}
  }
  return null;
}

function fromDom() {
  const descEl = SELECTORS.description.map((s) => document.querySelector(s)).find(Boolean);
  return {
    title: textFrom(SELECTORS.title),
    company: textFrom(SELECTORS.company),
    location: textFrom(SELECTORS.location),
    description: descEl ? stripHtml(descEl.innerHTML) : '',
    datePosted: '',
  };
}

function extractJob() {
  const j = fromJsonLd() || {};
  const d = fromDom();
  const merged = {
    title: j.title || d.title,
    company: j.company || d.company,
    location: j.location || d.location,
    description: j.description || d.description,
    datePosted: j.datePosted || d.datePosted,
  };
  return merged.title ? merged : null; // no title => no job present (guards feed/list-empty)
}

function ensurePill() {
  let pill = document.getElementById(PILL_ID);
  if (pill) return pill;
  pill = document.createElement('button');
  pill.id = PILL_ID;
  pill.type = 'button';
  pill.innerHTML = '<span class="nsh-dot"></span><span class="nsh-label">Capture to Notespacehub</span>';
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

function onCapture() {
  const fields = extractJob();
  if (!fields) return setState('error', 'No job found — select the text instead');
  setState('busy', 'Capturing…');
  chrome.runtime.sendMessage(
    { action: 'capture', payload: { source: 'extension-structured', fields, sourceUrl: location.href } },
    (resp) => {
      const ok = !chrome.runtime.lastError && resp?.success;
      // The API's reason (e.g. an expired AI key) — left up longer than a
      // success so it can actually be read.
      const error = chrome.runtime.lastError?.message || resp?.error;
      setState(ok ? 'done' : 'error', ok ? 'Captured — opening draft' : `Couldn't capture: ${error || 'unknown error'}`);
      setTimeout(() => setState('idle', 'Capture to Notespacehub'), ok ? 3000 : 8000);
    },
  );
}

// LinkedIn is a SPA: poll gently rather than trusting any single nav event.
function refresh() {
  const job = extractJob();
  lastJob = job;
  const sig = job ? `${location.pathname}|${job.title}|${job.company}` : 'none';
  if (sig === lastSignature) return;
  lastSignature = sig;
  chrome.runtime.sendMessage({ action: 'jobChanged', job, sourceUrl: location.href }).catch(() => {});
  if (job) {
    ensurePill();
    setState('idle', 'Capture to Notespacehub');
  } else {
    document.getElementById(PILL_ID)?.remove();
  }
}
setInterval(refresh, 1000);
refresh();

// Lets the side panel's "current tab" section show a job preview + Capture
// button without re-running extraction itself.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'detect') {
    sendResponse({ job: lastJob, sourceUrl: location.href });
    return true;
  }
});
