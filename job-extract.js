// Reads the one open job off a job page, as text. Runs inside the page: the
// "This page" tab injects it with chrome.scripting.executeScript({ func }),
// and the capture pill's content script calls it on click. executeScript
// sends only this function's source, so it must not use anything declared
// outside it — keep every helper inside.
//
// site: a job-sites.js site. jobId: the id the URL gave (null for a backup-id
// read). options:
//   waitMs           how long to wait for the detail panel to show this job
//   requireTitleLink the panel counts as showing it only once its title link
//                    carries jobId (list pages swap the panel in after the URL)
//   mode             'job' (default) or 'linkId' (only the title link's id)
//
// → { status: 'ok', job: { title, company, location, salary, description }, linkId }
//   { status: 'ok', linkId } in 'linkId' mode
//   { status: 'unreadable', reason: 'no-root' | 'stale' | 'empty' | 'error' }
// Only the detail root is read — never the whole page or the job list next
// to it — and only text comes back, never HTML.
async function nshExtractJob(site, jobId, options) {
  const { waitMs = 0, requireTitleLink = false, mode = 'job' } = options || {};
  const MAX_FIELD = 200;
  const MAX_DESCRIPTION = 20000;
  // LinkedIn renders the detail panel in pieces: the description can arrive
  // a moment after the title. Once the title is there, wait this much longer
  // for it.
  const DESCRIPTION_GRACE_MS = 2500;
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'BUTTON', 'IFRAME', 'IMG', 'VIDEO', 'AUDIO', 'CANVAS', 'SELECT', 'INPUT', 'TEXTAREA']);
  const BLOCK = /^(ADDRESS|ARTICLE|ASIDE|BLOCKQUOTE|BR|DD|DIV|DL|DT|FIGCAPTION|FIGURE|FOOTER|H[1-6]|HEADER|HR|LI|MAIN|NAV|OL|P|PRE|SECTION|TABLE|TBODY|TR|UL)$/;

  try {
    const wantedId = jobId ? String(jobId).toLowerCase() : null;
    // "{id}" in a selector stands for this job's id, so a link or block
    // only counts when it belongs to this job — a /jobs/view/ page lists
    // other jobs' links too. Without an id (the backup-id read) such
    // selectors are skipped.
    const selectors = Object.fromEntries(
      Object.entries(site.selectors || {}).map(([field, list]) => [
        field,
        (list || []).flatMap((s) => (!s.includes('{id}') ? [s] : wantedId ? [s.split('{id}').join(wantedId)] : [])),
      ]),
    );
    const compile = (pattern) => {
      try {
        return pattern ? new RegExp(pattern) : null;
      } catch (_) {
        return null;
      }
    };
    const linkIdRe = compile(site.linkIdPattern);
    const salaryRe = compile(site.salaryPattern);

    // A selector a config got wrong throws; it just matches nothing here.
    const query = (root, selector) => {
      try {
        return root.querySelector(selector);
      } catch (_) {
        return null;
      }
    };
    const queryAll = (root, selector) => {
      try {
        return [...root.querySelectorAll(selector)];
      } catch (_) {
        return [];
      }
    };
    const first = (root, list) => {
      for (const selector of list || []) {
        const el = query(root, selector);
        if (el) return el;
      }
      return null;
    };
    const tidy = (text) => (text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_FIELD);
    // The first match with text, per selector — a company link's first match
    // is often its logo, with none.
    const textOf = (root, list) => {
      for (const selector of list || []) {
        for (const el of queryAll(root, selector)) {
          const text = tidy(el.textContent);
          if (text) return text;
        }
      }
      return '';
    };

    // textContent rather than innerText: text a "Show more" keeps hidden
    // still counts. Block elements become line breaks so list items don't
    // run together; buttons ("…see more") and media are skipped.
    const blockText = (el) => {
      const parts = [];
      const walk = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          parts.push(node.data);
          return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE || SKIP.has(node.tagName.toUpperCase())) return;
        const block = BLOCK.test(node.tagName.toUpperCase());
        if (block) parts.push('\n');
        node.childNodes.forEach(walk);
        if (block) parts.push('\n');
      };
      walk(el);
      return parts
        .join('')
        .split('\n')
        .map((line) => line.replace(/[\s ​]+/g, ' ').trim())
        .filter(Boolean)
        .join('\n')
        .slice(0, MAX_DESCRIPTION);
    };

    // '' when there's a title link but no id in it; null when there's none.
    const linkIdIn = (root) => {
      const link = first(root, selectors.titleLink);
      if (!link) return null;
      const m = linkIdRe && (link.getAttribute('href') || '').match(linkIdRe);
      return m ? String(m.groups?.id ?? m[1] ?? '').toLowerCase() : '';
    };

    const check = () => {
      const root = first(document, selectors.detailRoot);
      if (!root) return { state: 'no-root' };
      const linkId = linkIdIn(root);
      if (mode === 'linkId') return linkId ? { state: 'ready', root, linkId } : { state: 'waiting', root };
      // The panel still shows the job opened before this one.
      if (wantedId && linkId && linkId !== wantedId) return { state: 'stale', root };
      if (requireTitleLink && !linkId) return { state: 'waiting', root };
      if (!textOf(root, selectors.title) && !first(root, selectors.description)) return { state: 'empty', root };
      return { state: 'ready', root, linkId };
    };

    // The first description match with text — an empty placeholder can be
    // rendered ahead of the real one.
    const descriptionOf = (root) => {
      for (const selector of selectors.description || []) {
        for (const el of queryAll(root, selector)) {
          const text = blockText(el);
          if (text) return text;
        }
      }
      return '';
    };

    const waitUntil = (test, ms) =>
      new Promise((resolve) => {
        const now = test();
        if (now.state === 'ready' || !ms) {
          resolve(now);
          return;
        }
        let queued = false;
        const finish = (result) => {
          observer.disconnect();
          clearTimeout(timer);
          resolve(result);
        };
        const observer = new MutationObserver(() => {
          if (queued) return;
          queued = true;
          setTimeout(() => {
            queued = false;
            const result = test();
            if (result.state === 'ready') finish(result);
          }, 50);
        });
        const timer = setTimeout(() => finish(test()), ms);
        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true,
          attributeFilter: ['href'],
        });
      });

    let ready = await waitUntil(check, waitMs);
    if (ready.state !== 'ready') {
      return { status: 'unreadable', reason: ready.state === 'waiting' ? 'stale' : ready.state };
    }
    if (mode === 'linkId') return { status: 'ok', linkId: ready.linkId };

    if (waitMs && !descriptionOf(ready.root)) {
      await waitUntil(() => {
        const root = first(document, selectors.detailRoot);
        return { state: root && descriptionOf(root) ? 'ready' : 'waiting' };
      }, DESCRIPTION_GRACE_MS);
      // The panel may have moved on to another job meanwhile.
      ready = check();
      if (ready.state !== 'ready') {
        return { status: 'unreadable', reason: ready.state === 'waiting' ? 'stale' : ready.state };
      }
    }

    const root = ready.root;
    const salary = (() => {
      for (const selector of selectors.salary || []) {
        for (const el of queryAll(root, selector)) {
          const text = tidy(el.textContent);
          if (text && (!salaryRe || salaryRe.test(text))) return text;
        }
      }
      return '';
    })();
    const job = {
      title: textOf(root, selectors.title),
      company: textOf(root, selectors.company),
      location: textOf(root, selectors.location),
      salary,
      description: descriptionOf(root),
    };

    // Structured data for the whole page — trusted only when it's about the
    // job the DOM shows, so a JSON-LD left over from the previous job of a
    // client-side navigation is never used.
    if (site.jsonLd && job.title && (!job.company || !job.location)) {
      for (const node of document.querySelectorAll('script[type="application/ld+json"]')) {
        let parsed;
        try {
          parsed = JSON.parse(node.textContent);
        } catch (_) {
          continue;
        }
        const list = Array.isArray(parsed) ? parsed : parsed?.['@graph'] || [parsed];
        const posting = list.find((item) => item?.['@type'] === 'JobPosting');
        if (!posting || tidy(posting.title).toLowerCase() !== job.title.toLowerCase()) continue;
        const org = posting.hiringOrganization;
        const place = Array.isArray(posting.jobLocation) ? posting.jobLocation[0] : posting.jobLocation;
        const address = place?.address || {};
        if (!job.company) job.company = tidy(typeof org === 'string' ? org : org?.name);
        if (!job.location) {
          job.location = tidy([address.addressLocality, address.addressRegion].filter(Boolean).join(', '));
        }
        break;
      }
    }

    return { status: 'ok', job, linkId: ready.linkId || null };
  } catch (_) {
    return { status: 'unreadable', reason: 'error' };
  }
}
