<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Repository workflow

The user requests committing and pushing completed changes to
`https://github.com/taharukaiya/Resume-Maker.git` after each change task.
Run appropriate checks, review the staged diff, then commit and push without
asking again. Preserve existing remote history and never force-push by default.
Keep secrets, actual environment files, local databases, generated infrastructure
outputs, dependencies, and build artifacts out of Git. Maintain `.env.example`
with configuration names and safe defaults instead.
