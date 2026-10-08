# burakkoc.net

The portfolio site — the home page, the projects and their case studies, the CV — and its admin at `/admin`, where projects are made in a Figma-like editor and published.

- **Next.js 16** (App Router, ISR), **React 19**, Tailwind CSS 4, GSAP
- **Firebase**: Firestore (projects, the design system, the CV), Storage (media), Auth (Google sign-in)
- Tests with **Vitest**; CI on GitHub Actions (types, lint, tests, build)

How it fits together — the data, the editor, publishing — is in [docs/architecture.md](docs/architecture.md).

## Running it

Node 20 or newer (`.nvmrc` says 24).

```bash
npm ci
npm run dev
```

The site is at http://localhost:3000, the admin at http://localhost:3000/admin.

The admin is for the owner's Google account (`ADMIN_EMAILS` in `src/lib/auth.ts`, the same address as in `firestore.rules` and `storage.rules`): any admin page sends a visitor who isn't signed in — or is signed in with another account — to `/admin/login`, and back to that page once signed in. For local work without signing in, put this in `.env.local` (development only — a production build ignores it; restart the dev server after changing it):

```bash
NEXT_PUBLIC_ADMIN_DEV_BYPASS=1
```

The bypass only opens the admin's pages: Firestore and Storage still refuse writes from a browser that isn't signed in once the rules are deployed.

## Scripts

| | |
|---|---|
| `npm run dev` | the dev server |
| `npm run build` / `npm start` | a production build, and serving it |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest (`src/**/*.test.ts`) |
| `npm run check` | types, lint and tests — what CI runs before the build |

## Firebase

The project is `burakkoc-a15d3` (`.firebaserc`). Its web config in `src/lib/firebase.ts` is public by design; the rules are what protect the data.

- **Rules** — `firestore.rules` and `storage.rules`: the site's published pages, their index and the CV are public to read; everything else (drafts, versions, the design system, listing and uploading files) is the admin's. Deploy them with:

  ```bash
  firebase deploy --only firestore:rules,storage
  ```

- **Sign-in** — Google must be enabled as a provider (Firebase Console → Authentication), with `burakkoc.net` among the authorized domains.
- **CORS** (optional) — exporting a layer as SVG/PNG reads its pictures from the bucket. Without a CORS rule they stay out of the file:

  ```bash
  gsutil cors set cors.json gs://burakkoc-a15d3.firebasestorage.app
  ```

## Making a project

1. **Admin → Projects → New project**: a title and a slug (Latin letters, digits and dashes; a taken slug is refused).
2. Edit it. Nothing is written while you work — undo and redo (⌘Z / ⇧⌘Z, 20 steps) stay in the browser. Leaving with unsaved changes asks first.
3. **Save** (⌘S) keeps a draft and a version of it (the last 20, under Version history).
4. **Publish** saves what isn't saved yet and puts the draft on the site. Changes after that stay in the draft until you republish.

Variables, text styles and components are the site's, shared by every project: changing one changes it everywhere, and a published page takes the change when it is republished.
