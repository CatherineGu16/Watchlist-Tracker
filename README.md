# Marvel Watchlist

A personal tracker for Marvel movies and shows. Check off what you've watched, keep dates (even
half-remembered ones), log rewatches, and follow series season by season. It installs on iPhone,
iPad and Windows like an app, works offline, and syncs between devices through a private GitHub
repo.

- **MCU** and **Other Marvel** tabs (Fox X-Men, Sony Spider-Man, Marvel Television, classic films)
- Filter by type, saga, phase and status; sort by release, story order, saga, title or last watched
- One tap to check off a movie, with Undo and Change date
- Seasons: start, count episodes, finish; rewatches keep their own start and end dates
- Dates can be exact, a month, a year, approximate, or unknown

## Use it

Open `https://<your-username>.github.io/watchlist-tracker/`.

- **iPhone / iPad:** in Safari tap Share, then **Add to Home Screen**.
- **Windows:** in Edge or Chrome, click the install icon in the address bar (or menu → Apps → Install).

Your list is saved on the device as you go. To see it on your other devices, set up sync once on
each one (below), or move it by hand with **Settings → Backup → Export / Import**.

## Sync across devices

Your watch history lives in a **private** repo only you can see. The app's own repo is public
(free GitHub Pages requires it) and contains no personal data.

1. [Create a repo](https://github.com/new) named `watchlist-data`. Choose **Private**. Leave it empty.
2. [Create a fine-grained access key](https://github.com/settings/personal-access-tokens/new):
   - Repository access: **Only select repositories** → `watchlist-data`
   - Permissions → Repository → **Contents: Read and write**
   - Pick an expiration date, then copy the key
3. In the app: **Settings → Sync across devices**, enter your username and paste the key.
   Repeat on each device. On iPhone and iPad, do it **inside the installed app**, since its
   storage is separate from Safari's.

The first device to connect uploads its list. Each later device merges its own list with what's
on GitHub, so nothing is lost. After that, sync runs when the app opens, when you come back to it,
when you reconnect, and a few seconds after each change. Edits made on two devices are combined
watch by watch, and the newest edit to the same watch wins.

- **Lost a device?** Revoke its key at GitHub → Settings → Developer settings → Personal access
  tokens, and create a new one for your other devices.
- **Key expired?** The header shows "Sync problem". Create a new key, then in Settings disconnect
  and connect again. Nothing on the device is lost.
- The app refuses to sync if `watchlist-data` is ever made public.

## Deploy (one time)

1. Create a **public** repo named `watchlist-tracker` on GitHub.
2. In it, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. Push this project:

   ```sh
   git remote add origin https://github.com/<your-username>/watchlist-tracker.git
   git push -u origin main
   ```

The workflow in `.github/workflows/deploy.yml` runs lint, unit tests and browser tests, then
publishes. Every later push to `main` updates the site. Installed apps pick up the new version the
next time they're opened.

## Develop

```sh
npm install
npm run dev        # http://localhost:5173/watchlist-tracker/
npm test           # unit and component tests (Vitest)
npm run e2e        # browser tests, desktop Chrome + iPhone WebKit (Playwright)
npm run lint
npm run build
```

First time running browser tests: `npx playwright install chromium webkit`.

### Where things are

| Path | What |
|---|---|
| `src/data/catalog.json` | Every title and season (public facts, no personal data) |
| `scripts/catalog-meta.ts` | Phases, story order, MCU/Other split, titles added beyond the sheet |
| `src/lib/` | Dates, watched/in-progress rules, edits, merging |
| `src/store/` | On-device storage (IndexedDB), undo |
| `src/sync/` | GitHub sync |
| `src/components/`, `src/ui/` | Screens and list logic |

### Updating the catalog

Edit `scripts/catalog-meta.ts` (for example to add a new release or move a title between MCU and
Other), then rebuild the catalog from the sheet export:

```sh
npm run import:sheet
```

This reads `data/source/*.csv` (your Google Sheet export) and writes `src/data/catalog.json` plus
`data/private/watchlist.json` (your watch history). Both `data/source/` and `data/private/` are
git-ignored. Never commit them, since this repo is public. To load the imported history into the
app, use **Settings → Backup → Import** with `data/private/watchlist.json`.

### Icons

`public/icon.svg` is the source. After changing it, run `npm run icons`.

## Privacy

- No accounts, analytics, ads or third-party scripts. Fonts are bundled.
- The published site may only load its own files and talk to `api.github.com`
  (Content Security Policy).
- The access key is stored only on the device and sent only to GitHub.
