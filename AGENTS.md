<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# This project

How it fits together — the data in Firestore, the editor in `src/figma`, publishing, export — is in `docs/architecture.md`. Two rules hold everywhere:

- Firestore is written only by Save (and the project list's actions), in one transaction per save; uploads are the one immediate write.
- Variables, text styles and components are the site's, shared by every project (`design/*`), not a project's own.

Before committing: `npm run check` (types, lint, tests).
