# Marvel Watchlist Tracker — Plan

A personal web app for tracking MCU (and other Marvel) movies, series and seasons: check-offs,
watch dates, rewatches, season start/end, and episode progress. It installs on iPhone, iPad and
Windows, works offline, and syncs across devices through a private GitHub repo. Every action saves
immediately.

Source data: the "Marvel Watchlist" Google Sheet (Main List + Series Tracker tabs), last updated
08/11/2026. Local snapshots are in `data/source/`, which is git-ignored because it holds personal
watch history.

## Decisions

| Topic | Decision |
|---|---|
| Account | Free GitHub account only. No other services |
| App hosting | **GitHub Pages** from the **public** repo `watchlist-tracker` (free Pages requires a public repo). It holds code + the title catalog only, **no personal data** |
| Personal data | **Private** repo `watchlist-data`, file `watchlist.json` (free accounts get unlimited private repos) |
| Sync | The browser calls the GitHub REST API directly with a **fine-grained personal access token** limited to `watchlist-data`, with only *Contents: Read and write* permission |
| Install | Progressive Web App (PWA): "Add to Home Screen" on iOS/iPadOS, "Install app" in Edge/Chrome on Windows |
| Offline | Local-first: IndexedDB on each device is the working copy. Changes queue and sync when online |
| Frontend | React + TypeScript + Vite, Tailwind CSS, Radix UI primitives, `vite-plugin-pwa` |
| Deploy | GitHub Actions workflow builds and publishes to Pages on push to `main` (Actions is free for public repos) |
| Release check (TMDB) | **On hold.** The button is hidden until a key is added later |
| Canon split | **MCU Canon**: Marvel Studios films + Disney+ series/specials + Netflix *Daredevil* + *Deadpool & Wolverine*. **Other Marvel**: the other Marvel Television shows (ABC/Netflix/Hulu/Freeform), Fox X-Men, Sony Spider-Man, other pre-MCU films |
| Episode progress | Optional counter on in-progress season watches (e.g. 5/13). No per-episode dates |

### Free-account checks

- GitHub Pages on Free: public repos only. ✅ The app repo is public and contains no personal data.
- Private repos on Free: unlimited. ✅ Used for `watchlist-data`.
- Fine-grained tokens on Free: available, scoped to one repo. ✅
- API rate limit: 5,000 requests/hour with a token. ✅ Typical use is a few dozen per day.
- Contents API: files up to 1 MB via the standard JSON response. ✅ Expected size is ~50–150 KB.
- Pages limits: 1 GB site size, 100 GB/month soft bandwidth. ✅ The app is a few MB.
- Browser access: `api.github.com` allows CORS calls with a token, so no server is needed. ✅

## Privacy and security

- **Strangers** who open the site get an empty app with the public catalog only. They cannot
  read or change your list without your token.
- **The token** is stored only in the device's local storage for this site. It is never committed,
  logged, or sent anywhere except `api.github.com`. It only grants access to `watchlist-data`.
- **Lost device**: revoke the token on GitHub (Settings → Developer settings → Personal access
  tokens) and create a new one.
- **Token expiry**: fine-grained tokens expire on a date you choose. The app shows a banner when the
  token stops working and asks for a new one. Local data is kept.
- **Hardening**: strict Content Security Policy (`connect-src 'self' https://api.github.com`), no
  third-party scripts, analytics or CDNs at runtime. All dependencies are bundled at build time.
- **Repo hygiene**: `data/source/` and `data/private/` are git-ignored. The import script writes
  personal watches to `data/private/watchlist.json`, which is uploaded to the private repo, never to
  the public one.

## Data split

**Public catalog** (`src/data/catalog.json`, shipped with the app). Facts about titles, not about you.

```
Title    id, title, type (movie | series | special), releaseDate | null,
         universe (mcu | other), saga, phase (1–6 | null), chronoIndex (MCU only),
         franchise, tmdbId | null, posterPath | null
Season   id, titleId, number, label, episodeCount | null, premiereDate | null ("TBA")
```

**Private data** (`watchlist-data/watchlist.json`):

```
{
  schemaVersion: 1,
  updatedAt,
  watches: [ { id, titleId, seasonId | null,
               startDate | null, endDate | null,   // partial ISO: "2021" | "2021-09" | "2021-09-18"
               approximate, episodesWatched | null, note,
               createdAt, updatedAt, deleted? } ],   // deleted = tombstone for sync merges
  customTitles: [...],                               // titles you add by hand
  titleOverrides: { [titleId]: { ...fields } }       // e.g. moving a title to MCU/Other
}
```

### Derived rules (computed, never stored)

- **Movie/special watched**: has at least one finished watch, or a "date unknown" watch.
- **Season status**: `completed` (finished watch), `in-progress` (open watch: start set, no end),
  `unwatched`, `unreleased` (premiere in the future or TBA).
- **Series watched**: every *released* season is completed. Otherwise "In progress n/m".
- **First watch** = earliest watch. **Watch count** = number of non-deleted watches.

### Episode progress and unknown dates

- In-progress season watches have an episode stepper `[–] 5 / 13 [+]`. Reaching the last episode
  offers "Finish season?", which sets the end date to today (editable).
- Seasons watched in the past with no known date are completed watches with null dates, shown as
  **"Watched · date unknown"**. They count toward completion but not toward date stats.
- Finished watches are assumed complete, so old data never needs episode numbers.

## Sync design

1. **On open / on focus / on pull-to-refresh**: `GET /repos/{owner}/watchlist-data/contents/watchlist.json`.
   Merge it into the local copy and remember the file's `sha`.
2. **On change**: apply locally right away (IndexedDB), then debounce ~3 s and
   `PUT .../contents/watchlist.json` with the last known `sha`. Quick edits are batched into one
   commit.
3. **Conflict** (409/422 because another device saved first): re-fetch, merge, retry.
   The merge goes record by record using `id` + `updatedAt`, so the newest edit wins and deletes
   win via tombstones. Edits made on two devices are both kept.
4. **Offline**: changes stay queued in IndexedDB and are pushed when the connection returns.
5. **Status chip** in the header: "Synced ✓", "Saving…", "Offline — n changes queued",
   "Token expired".
6. **First-time setup** (once per device): Settings → paste GitHub username + token → the app checks
   access to `watchlist-data`. If `watchlist.json` doesn't exist, the app creates it from the local
   data.
7. **Without a token**, the app still works fully on that one device and offers Export/Import JSON.

## Import rules for the sheet data

- Full dates → day precision. Year only (`2020`) → year precision. `2018?` → year + approximate.
- Ranges `03/04 - 03/15/2024` → start/end. Lists `2019, 2024` → two watches.
- "First Watch" → first watch. "Additional Watches" → one more watch each.
- For series, watches come from the Series Tracker (per season). The Main List's series checkbox is
  ignored because it is derived.
- Personal corrections (rows to treat as checked, or dates to replace) live in the git-ignored
  `data/source/watch-overrides.json`, never in code.
- A season with no first-watch date but a later range uses that range as its first watch.
- Upcoming/TBA items (e.g. *Your Friendly Neighborhood Spider-Man* S2) are imported as unreleased.

## Titles to add to the catalog

Release dates and episode counts will be checked against public sources during M1.

- **MCU Canon**: Marvel One-Shots (5 shorts, Infinity Saga), *I Am Groot* S1–S2 (shorts).
- **Other Marvel**:
  - Sony: *Venom*, *Venom: Let There Be Carnage*, *Venom: The Last Dance*, *Morbius*,
    *Madame Web*, *Kraven the Hunter*, *Spider-Man: Into the Spider-Verse*,
    *Spider-Man: Across the Spider-Verse*.
  - Fox/other films: *Blade* trilogy, *Daredevil* (2003), *Elektra*, *Hulk* (2003),
    *Fantastic Four* (2005, 2007, 2015), *Ghost Rider* (2007, 2011), *The Punisher* (1989, 2004),
    *Punisher: War Zone*.
  - TV: *Legion*, *The Gifted*, *X-Men '97*.

New titles can also be added by hand in the app (stored as `customTitles` in the private repo)
until the TMDB release check is turned on.

## UI

- **Header**: overall progress ring, movies/series counts, watches this year, next release
  countdown, sync status chip.
- **Tabs**: MCU Canon | Other Marvel.
- **Filters**: All / Movies / TV / Specials · saga chips · phase · status
  (Watched / Unwatched / In progress / Upcoming) · search. Filters are remembered per device.
- **Sort**: Release order (default) · In-universe chronological · Title · Last watched · Saga
  (grouped, with a progress bar per saga).
- **Row**: title, year, saga/phase chip, watch date (tap to edit), ×N rewatch badge, checkbox.
  Series rows show "2/3 seasons" and a mini progress bar. Posters wait for TMDB; until then each
  row gets a color-coded saga tile.
- **Check off**: logs a watch dated today with an Undo toast. The date opens a picker with
  "Exact date / Month / Year / Unknown" options.
- **Detail panel** (side panel on desktop, bottom sheet on phone):
  - Movie: watch history (edit/delete), "+ Log rewatch".
  - Series: one card per season with status, premiere date, episode count, Start watching / Finish,
    episode stepper, and its own watch history with "+ Log rewatch".
- **Settings**: GitHub sync setup, Export/Import JSON, theme, "Add title".
- **Responsive**: phone ≤640px cards + bottom sheets + filter sheet. iPad two columns. Desktop list
  with side panel. Tap targets ≥44px, no horizontal scroll at 360px, iOS safe areas respected.
- **Theme**: dark by default, light available, follows system setting.

## Milestones

| # | Milestone | Done when |
|---|---|---|
| M1 | Scaffold (Vite/React/TS/Tailwind), import script → `catalog.json` (public) + `data/private/watchlist.json`, added titles, phases, chrono order | Catalog builds. Parser and status tests pass. No personal data in tracked files |
| M2 | Local store (IndexedDB) + derived status + Export/Import | Every action survives a reload |
| M3 | Main list: tabs, filters, sorts, check-off, date editing, rewatches, undo | All list flows work |
| M4 | Series detail: seasons, start/finish, episode stepper, unknown dates | Series status derives correctly |
| M5 | Responsive polish, PWA (manifest, icons, offline), stats header, theming | Installs and works offline on iPhone, iPad, Windows |
| M6 | GitHub sync: settings, fetch/merge/save, conflict retry, offline queue, status chip | Edit on phone → visible on PC after refresh. Two-device conflict test passes |
| M7 | GitHub Actions deploy to Pages, Playwright E2E (desktop + phone viewports), README | Live on `https://<username>.github.io/watchlist-tracker/` |
| Later | TMDB release check + posters (when you have a key) | — |

## Your setup steps (at M6/M7, with step-by-step help)

1. Create the **public** repo `watchlist-tracker` and turn on Pages (Settings → Pages → Source:
   GitHub Actions).
2. Create the **private** repo `watchlist-data` (empty).
3. Create a fine-grained token: Settings → Developer settings → Fine-grained tokens →
   Repository access: *Only select repositories* → `watchlist-data` → Permissions:
   *Contents: Read and write* → pick an expiration date.
4. On each device: open the site, install it, then paste your username + token into Settings.
   On iPhone/iPad, do this **inside the installed app**, because its storage is separate from Safari.
