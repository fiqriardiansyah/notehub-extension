// Job boards the extension recognises, and how to read one job off each.
// Loaded by background.js (importScripts), sidepanel.html and the capture
// pill's content script; the "This page" tab, the pill and the worker all go
// through nshMatchJobPage so a job is identified the same way everywhere.
//
// This is the bundled default. background.js fetches a replacement from the
// API (GET /extension/job-sites, the app_config row 'extension.job-sites')
// and stores it under JOB_SITES_STORAGE_KEY, so a selector a board broke is
// fixed there, not by publishing a new extension version. A stored config is
// used only if nshValidateSites keeps at least one site from it.
//
// Per site:
//   source        key saved on the application (Application.source)
//   label         shown in the panel
//   hosts         exact hostnames (each needs a manifest host permission)
//   idRules       tried in order, the first that gives an id wins:
//                   { type: 'path', pattern }  regex on the pathname; the id is
//                     the named group `id`, else group 1, and every other
//                     named group can be used in `canonical`
//                   { type: 'query', param, pathPrefix, valuePattern }
//                 `requireTitleLink` on a rule: the job counts as rendered only
//                 once the detail panel's title link carries its id (list
//                 pages update the panel a moment after the URL)
//   canonical     the URL stored for the job — {id} and the path groups
//   linkIdPattern regex finding the id in a title link's href
//   backupIdPathPrefix  on these paths, a URL with no id takes the one in the
//                 detail panel's title link instead
//   jsonLd        fill company/location the DOM lacks from the page's
//                 JobPosting JSON-LD, when its title is the DOM's
//   aiFill        fields worth an AI call when the DOM didn't give them
//   salaryPattern text that reads as pay — a salary slot can also say the
//                 company doesn't show it
//   selectors     CSS selector lists, each tried in order, first match with
//                 text wins; "{id}" in one is replaced by the job's id.
//                 Only detailRoot is searched in the whole page; everything
//                 else inside it, so the job list beside it is never read.
//                 Class names here change often: check them on the live page
//                 in DevTools before trusting them.

const JOB_SITES_STORAGE_KEY = 'jobSitesRemote';

const NSH_JOB_FIELDS = ['title', 'company', 'location', 'salary', 'description'];

const NSH_DEFAULT_JOB_SITES = [
  {
    source: 'linkedin',
    label: 'LinkedIn',
    hosts: ['linkedin.com', 'www.linkedin.com'],
    idRules: [
      { type: 'path', pattern: '^/jobs/view/(\\d+)' },
      // /jobs/search/, /jobs/search-results/, /jobs/collections/…
      { type: 'query', param: 'currentJobId', pathPrefix: '/jobs/', valuePattern: '^\\d+$', requireTitleLink: true },
    ],
    canonical: 'https://www.linkedin.com/jobs/view/{id}/',
    linkIdPattern: '/jobs/view/(\\d+)',
    backupIdPathPrefix: '/jobs/',
    jsonLd: false,
    aiFill: ['title', 'company'],
    salaryPattern: '[$€£¥₹]\\s?\\d|\\d\\s?[Kk]?\\s?/\\s?(?:yr|hr|mo)\\b|\\b(?:Rp|IDR|USD|SGD|MYR|EUR|GBP|INR|AUD)\\b',
    // Two layouts. The newer one (/jobs/search-results/, seen 2026-10) has
    // generated class names that change per build, so only its attributes
    // are used: the detail screen's data-sdui-screen, the link to this job
    // (the title), and the About-the-job block, whose id carries the job id.
    // "{id}" is this job's id (see job-extract.js) — never match any
    // /jobs/view/ link: a job page lists other jobs' links too. The older
    // class-named layout's selectors follow as fallbacks.
    selectors: {
      detailRoot: [
        '[data-sdui-screen*="SemanticJobDet"]',
        '.jobs-search__job-details--wrapper',
        '.jobs-search__job-details--container',
        '.scaffold-layout__detail',
        '.job-view-layout',
        '.jobs-details',
        // Any screen holding this job's description (a /jobs/view/ page
        // whose screen is named differently).
        '[data-sdui-screen]:has([id="JobDetails_AboutTheJob_{id}"])',
        'main:has([id="JobDetails_AboutTheJob_{id}"])',
      ],
      title: [
        '.job-details-jobs-unified-top-card__job-title h1',
        '.job-details-jobs-unified-top-card__job-title',
        '.jobs-unified-top-card__job-title',
        'a[href*="/jobs/view/{id}/"]',
        'a[href$="/jobs/view/{id}"]',
        'h1',
      ],
      company: [
        '.job-details-jobs-unified-top-card__company-name a',
        '.job-details-jobs-unified-top-card__company-name',
        '.jobs-unified-top-card__company-name a',
        '.jobs-unified-top-card__company-name',
        'a[href*="/company/"]',
      ],
      location: [
        '.job-details-jobs-unified-top-card__tertiary-description-container .tvm__text',
        '.job-details-jobs-unified-top-card__primary-description-container .tvm__text',
        '.job-details-jobs-unified-top-card__bullet',
        '.jobs-unified-top-card__bullet',
      ],
      salary: [
        '.job-details-fit-level-preferences button',
        '.job-details-preferences-and-skills__pill',
        '.salary-main-rail__data-body',
      ],
      description: [
        // Not the block itself: its "About the job" heading would pass for a
        // description while the text is still loading.
        '[id="JobDetails_AboutTheJob_{id}"] [data-testid="expandable-text-box"]',
        '[id="JobDetails_AboutTheJob_{id}"] p',
        '#job-details',
        '.jobs-description__content .jobs-box__html-content',
        '.jobs-description-content__text',
        '.jobs-box__html-content',
      ],
      titleLink: [
        '.job-details-jobs-unified-top-card__job-title a[href*="/jobs/view/"]',
        '.jobs-unified-top-card__job-title a[href*="/jobs/view/"]',
        'h1 a[href*="/jobs/view/"]',
        'a[href*="/jobs/view/{id}/"]',
        'a[href$="/jobs/view/{id}"]',
      ],
    },
  },
  {
    source: 'glints',
    label: 'Glints',
    hosts: ['glints.com'],
    idRules: [
      // The UUID is the job; the slug before it changes (or is "-") for the
      // same job, so it's kept only for the canonical URL.
      {
        type: 'path',
        pattern:
          '^/(?<country>[a-z]{2})(?:/[a-z]{2})?/opportunities/jobs/(?<slug>[^/]+)/(?<id>[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})',
      },
    ],
    canonical: 'https://glints.com/{country}/opportunities/jobs/{slug}/{id}',
    linkIdPattern: '',
    backupIdPathPrefix: '',
    // The top fold shows no location; the page's JobPosting JSON-LD has it.
    jsonLd: true,
    aiFill: ['title', 'company'],
    // "Perusahaan tidak menampilkan gaji" sits where the pay would.
    salaryPattern: '\\d',
    // Styled-components classes: the readable prefix stays, the hash after
    // it changes with every Glints build — hence [class*=…].
    selectors: {
      detailRoot: ['main[class*="Opportunitysc__Main"]', 'main'],
      title: ['h1[class*="JobOverViewTitle"]', 'h1[aria-label="Job Title"]', 'h1'],
      company: ['[class*="JobOverViewCompanyName"] a', '[class*="JobOverViewCompanyName"]', 'a[href*="/companies/"]'],
      location: ['[class*="JobOverViewInfo"] a[href*="/job-location/"]'],
      salary: ['[class*="SalaryJobOverview"]'],
      description: [
        '[aria-label="Job Description"] [class*="DescriptionContainer"]',
        '[class*="JobDescriptionsc__DescriptionContainer"]',
      ],
      titleLink: [],
    },
  },
];

function nshCompile(pattern) {
  if (!pattern) return null;
  try {
    return new RegExp(pattern);
  } catch (_) {
    return null;
  }
}

function nshFillTemplate(template, values) {
  return template.replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');
}

// The job for an id found some other way (the backup title-link id): the
// canonical URL then has only {id} to go on.
function nshJobFromId(site, sourceJobId, rule = null, groups = {}) {
  const id = String(sourceJobId).toLowerCase();
  return {
    site,
    rule,
    source: site.source,
    sourceJobId: id,
    canonicalUrl: nshFillTemplate(site.canonical, { ...groups, id }),
  };
}

// → { site, rule, source, sourceJobId, canonicalUrl } for a job page;
//   { site, sourceJobId: null, backupId } for a page of a known board that
//   has no job id in its URL (backupId: the title link may still give one);
//   null for anything else. Everything in the URL but the id is ignored.
function nshMatchJobPage(url, sites) {
  let u;
  try {
    u = new URL(url);
  } catch (_) {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  const site = sites.find((s) => s.hosts.includes(u.hostname));
  if (!site) return null;

  for (const rule of site.idRules) {
    if (rule.type === 'path') {
      const m = u.pathname.match(nshCompile(rule.pattern) || /$^/);
      const id = m && (m.groups?.id ?? m[1]);
      if (id) return nshJobFromId(site, id, rule, m.groups || {});
    } else if (rule.type === 'query') {
      if (rule.pathPrefix && !u.pathname.startsWith(rule.pathPrefix)) continue;
      const id = u.searchParams.get(rule.param);
      const valid = nshCompile(rule.valuePattern);
      if (id && (!valid || valid.test(id))) return nshJobFromId(site, id, rule);
    }
  }
  const backupId = !!(site.backupIdPathPrefix && site.linkIdPattern && u.pathname.startsWith(site.backupIdPathPrefix));
  return { site, sourceJobId: null, backupId };
}

const nshStringList = (value) =>
  Array.isArray(value) ? value.filter((s) => typeof s === 'string' && s.trim()) : [];

// A remote config is used as a whole or not at all: every site that passes
// is kept, cleaned down to the keys above; none passing → null (the caller
// falls back to the default). Selectors aren't checked against any page — a
// selector that matches nothing just leaves its field empty, and a missing
// detail root shows "Couldn't read this job".
function nshValidateSites(raw) {
  if (!Array.isArray(raw)) return null;
  const sites = raw
    .map((s) => {
      if (!s || typeof s !== 'object' || !/^[a-z0-9-]{1,32}$/.test(s.source || '')) return null;
      const hosts = nshStringList(s.hosts);
      const idRules = (Array.isArray(s.idRules) ? s.idRules : []).filter(
        (r) =>
          r &&
          ((r.type === 'path' && nshCompile(r.pattern)) ||
            (r.type === 'query' && typeof r.param === 'string' && r.param)),
      );
      const selectors = s.selectors && typeof s.selectors === 'object' ? s.selectors : {};
      const detailRoot = nshStringList(selectors.detailRoot);
      if (!hosts.length || !idRules.length || typeof s.canonical !== 'string' || !s.canonical.includes('{id}') || !detailRoot.length) {
        return null;
      }
      return {
        source: s.source,
        label: typeof s.label === 'string' && s.label ? s.label : s.source,
        hosts,
        idRules: idRules.map((r) => ({
          type: r.type,
          pattern: r.pattern || '',
          param: r.param || '',
          pathPrefix: r.pathPrefix || '',
          valuePattern: nshCompile(r.valuePattern) ? r.valuePattern : '',
          requireTitleLink: !!r.requireTitleLink,
        })),
        canonical: s.canonical,
        linkIdPattern: nshCompile(s.linkIdPattern) ? s.linkIdPattern : '',
        backupIdPathPrefix: typeof s.backupIdPathPrefix === 'string' ? s.backupIdPathPrefix : '',
        jsonLd: !!s.jsonLd,
        aiFill: nshStringList(s.aiFill).filter((f) => NSH_JOB_FIELDS.includes(f) && f !== 'description'),
        salaryPattern: nshCompile(s.salaryPattern) ? s.salaryPattern : '',
        selectors: {
          detailRoot,
          ...Object.fromEntries(
            [...NSH_JOB_FIELDS, 'titleLink'].map((field) => [field, nshStringList(selectors[field])]),
          ),
        },
      };
    })
    .filter(Boolean);
  return sites.length ? sites : null;
}

// What background.js stored ({ remote, fetchedAt }) → the sites to use.
function nshSitesFromStored(stored) {
  return nshValidateSites(stored?.remote?.sites) || NSH_DEFAULT_JOB_SITES;
}
