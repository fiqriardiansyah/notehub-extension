# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## CSS build step

Styles use **Tailwind CSS** compiled via CLI. After changing any Tailwind classes in `sidepanel.html` or `sidepanel.js`, regenerate `sidepanel.css`:

```
npm run build:css
```

For live recompilation while editing:

```
npm run watch:css
```

Source files: `input.css` → compiled output: `sidepanel.css`. Do not edit `sidepanel.css` directly.

## Loading the extension

Load the extension directory directly into Chrome/Edge:

1. Go to `chrome://extensions` (or `edge://extensions`)
2. Enable **Developer mode**
3. Click **Load unpacked** and select this folder
4. After any file change, click the **Reload** button on the extension card (or press `Ctrl+R` on the extensions page)

## Extension ID

The extension ID is pinned to `hfdgjbbcaplgejgalabnfaopggeohmcb` via the `key` field in `manifest.json`. The matching private key lives in `extension.pem` (gitignored). Do not remove the `key` field from `manifest.json`.

## Architecture

This is a **Manifest V3** Chrome extension with no bundler or framework.

| File | Role |
|---|---|
| `manifest.json` | Extension config — permissions, side panel entry point, background worker |
| `config.js` | `API_BASE` / `APP_BASE` origins shared by the worker and the panel, plus the `DEV` dev/prod switch (ships `false`) |
| `sidepanel.html` / `sidepanel.css` / `sidepanel.js` | The persistent side panel UI, opened via `chrome.sidePanel` when the toolbar icon is clicked |
| `sidepanel-documents.js` / `sidepanel-documents.css` | An application's documents in the panel (tailored CV, cover letter, Email Apply, portfolio, files) and their editors. Loaded after `sidepanel.js` and uses its globals. The CSS is hand-written component styles, not Tailwind |
| `sidepanel-thispage.js` / `sidepanel-thispage.css` | The "This page" tab (see below) and the panel toast. Loaded last; uses the globals of both files above. Hand-written CSS like the documents view's; it also sets the panel's font (Plus Jakarta Sans, the web app's) |
| `sidepanel-me.js` / `sidepanel-me.css` | The "Me" tab (see below). Loaded after `sidepanel-thispage.js` and uses the globals of all three files above. Hand-written CSS |
| `sidepanel-applications.css` | The Applications tab's list (recorded today, then earlier, newest first by `dateAdded`; search by role or company goes to `GET /application?search=`). Hand-written like the two above |
| `job-sites.js` | The job boards the extension recognises (LinkedIn, Glints): URL rules → job id + canonical URL, and the DOM selectors to read a job with. Bundled default `NSH_DEFAULT_JOB_SITES`, matcher `nshMatchJobPage`, validator for the API's copy. Loaded by the worker, the panel and the content script |
| `job-extract.js` | `nshExtractJob` — reads the one open job (detail panel only, text only) inside the page. Self-contained: the panel passes it to `chrome.scripting.executeScript({ func })`, and the content script calls it on a pill click |
| `background.js` | Service worker — auth, job capture, context menu, `sidePanel.setPanelBehavior` wiring, the panel's `api` proxy, the job-site config fetch, and AI document generation jobs (state in `chrome.storage.session` under `docJob:<applicationId>:<kind>`) |
| `content-jobs.js` / `content-jobs.css` | Content script on linkedin.com and glints.com — shows the "Capture to Notespacehub" pill when the URL is a job page (URL only; the page is read on click) |
| `icons/` | PNG icons at 16 / 48 / 128 px |

The side panel (Chrome 114+, `chrome.sidePanel`) is the primary surface and stays open across tab navigation within a window; there is no popup — the `action` has no `default_popup`, and `setPanelBehavior({ openPanelOnActionClick: true })` makes the icon open the panel directly. The panel document is destroyed when closed and rebuilt on reopen, so it re-fetches state on load/focus rather than relying on in-memory state. It communicates with the service worker via `chrome.runtime.sendMessage` / `chrome.runtime.onMessage`, and reads the active tab's job itself with `chrome.scripting.executeScript` (see "This page"). There is still no `tabs` permission: `tab.url` is readable only for the hosts in `host_permissions`, so on any other site it's undefined and the page simply isn't a job page. Persistent state goes through `chrome.storage`. A job capture made while the panel is open in that window (checked with `chrome.runtime.getContexts`, Chrome 116+) is reviewed and saved in the panel's `view-capture-review` via `chrome.storage.session.captureReview`; otherwise it opens the app's `/applications/new?draft=` page in a tab. Auth uses the `chrome.identity` API (OAuth2 via `identity` permission declared in manifest). The backend host is `notespacehub.com` (declared in `host_permissions`).

## "Me" tab

The fourth tab: the user's own details, one click to copy — a copy panel, read-only (each row links into the web app to edit). Data is `GET /me/quick-profile`, already made into sections of rows by the API (see notehub-api's CLAUDE.md, "Me" tab). Everything is in `sidepanel-me.js`:

- **Cache**: the last answer is in `chrome.storage.local.meQuickProfile` and rendered at once (on sign-in, before the tab is opened); a background refresh (on opening the tab at most every 30 s, on focus, on the Refresh button) re-renders only when `version` changed. A failed refresh keeps the saved copy with "Offline — showing saved info"; with no copy, an error and Retry. Login and logout clear it (and `meCopyCounts`, `meApp:*`).
- **Rows**: click (or Enter) copies the full value — long text shows two lines + "more" and its character count — with "Copied ✓" for 1.2 s and an `aria-live` announcement; rows are `draggable` with `text/plain`. Sensitive rows are blurred until the eye is clicked; copying works anyway. Empty fields are "Add … +" rows that open `editUrl`; an empty headline / short summary offers **Generate** (`POST /me/quick-profile/about`).
- **Quick copy** shows the API's pins (max 6, `PUT /me/quick-profile/pins`, so they sync); the pin icon shows on hover / focus or after a long press. Copy counts are local (`meCopyCounts`); after 20 copies a user still on the default pins gets their most-copied rows instead, once.
- **Sections** start collapsed; which are open is `chrome.storage.local.meOpenSections`. Search (`/` focuses it, Esc clears) shows a flat list of every row whose label + value hold all the words typed.
- **This page context**: `renderThisPage` calls `meSyncPage()`; while it shows a saved job, Answers gets "For {company}" with that application's answers (`GET /me/quick-profile/application/:id`, cached in `chrome.storage.session` `meApp:<id>`) marked Tailored — or **Tailor for {company}** (`POST /ai/qna/generate-for-application`, mode `hr`) — and Files offers its tailored cover letter first.
- **Files**: the default CV (a picker for the others) and the master cover letter, through the documents view's `downloadPdf`; an uploaded file opens from the bucket.

## "This page" tab

The side panel's tabs are **This page · Applications · Notes · Me**. "This page" comes up by itself whenever the active tab's job changes to a supported job page; otherwise the panel shows the tab the user last picked (`chrome.storage.local.panelTab`). It answers "is this a job, and have I saved it?" and offers one next step. Everything is in `sidepanel-thispage.js`:

1. **URL change** — `chrome.tabs.onUpdated` / `onActivated` in the panel (so only while it's open), debounced 500 ms: clicking through a job list only processes the job the user stops on. `pageRun` is bumped per new job/page, and every await checks it, so a late answer for a job already left never renders.
2. **Match** — `nshMatchJobPage(tab.url)` (job-sites.js) → `source` + `sourceJobId` + canonical URL. Only the id identifies a job: LinkedIn's number from `/jobs/view/{id}` or `currentJobId` on any `/jobs/…` path (other params ignored); Glints' UUID (the slug before it changes for the same job). A LinkedIn `/jobs/…` URL without an id takes the one in the detail panel's title link.
3. **Cache** — `chrome.storage.session` `thisPage:<source>:<id>` (10 min) renders at once.
4. **Saved?** — `GET /application/lookup`. Saved → stage badge and the stage's next step (Saved → Mark as Applied; Applied → Set follow-up; Screening/Interview → Add interview; Offer/Rejected → Open in Notespacehub), plus Tailor CV / cover letter (the panel's documents view), Add a note (`/applications/:id?tab=notes`), Open ↗. Revisits re-check the lookup, so a stage changed in the web app shows.
5. **Read the page** — `nshExtractJob` via `chrome.scripting.executeScript`, detail root only, text only. On list pages it waits (MutationObserver, 5 s) until the panel's title link carries the URL's id, so the previously opened job is never read; no detail root, or the panel never catching up → "Couldn't read this job" with the form. The description is `textContent`-based (text behind "Show more" counts), block elements kept as lines, capped at 20,000 chars.
6. **AI, only if needed** — fields in the site's `aiFill` the page didn't give (title, company) come from `POST /application/capture/extract` with the description alone, ≤ 8,000 chars. "Check fit" calls `/ai/job-fit/analyze` on click only, same text cap. Both answers are cached per job in `chrome.storage.local` `jobAi:<source>:<id>` for a week, so a revisit spends no tokens.
7. **Save** — `saveJob` in background.js: `POST /application` at stage Saved, `dateApplied: null`, `source` + `sourceJobId`, the canonical URL. A 409 (saved meanwhile) is answered by looking it up again. Unsaved also shows "Looks like you saved this already" when the lookup with company + role finds a lookalike.

**Job-site config.** Selectors live in `job-sites.js` and, when set, in the API's `app_config` row `extension.job-sites` (`GET /extension/job-sites`), which background.js fetches hourly into `chrome.storage.local.jobSitesRemote`; the panel reads it when it opens, the pill whenever it changes. A remote config is used if `nshValidateSites` keeps any site from it, else the bundled default. Adding a board is a config entry plus its host in `manifest.json` (`host_permissions` and the content script's `matches`). Board class names change often — check selectors on the live page in DevTools (Glints' styled-components classes are matched by their readable prefix, `[class*="JobOverViewTitle"]`). LinkedIn has two layouts. The newer `/jobs/search-results/` one has generated class names (`l4jk8d`…) that change per build, so it's matched by attributes only: the detail screen `[data-sdui-screen*="SemanticJobDet"]`, the title as the link to this job, `a[href*="/jobs/view/{id}/"]` (also the title link the reader waits on), and the description under `[id="JobDetails_AboutTheJob_{id}"]` (`data-testid="expandable-text-box"`). `{id}` in a selector is replaced with the job's id by `nshExtractJob` — never match any `/jobs/view/` link, since a `/jobs/view/` page also links similar jobs — taken from a signed-in page's DevTools dump on 2026-10-25. Its company and location weren't in that dump (company is a guess, `a[href*="/company/"]`). The older class-named selectors, from the earlier content script, follow as fallbacks.

**Privacy.** Host permissions and the content script cover only linkedin.com and glints.com. A page is read only while the panel is open and the URL is a job page (or a LinkedIn `/jobs/` page, for the backup id), and only through `nshExtractJob`; the pill reads one when clicked. No HTML, job list or whole page ever leaves the tab.
