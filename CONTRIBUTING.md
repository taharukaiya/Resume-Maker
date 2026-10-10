# Development conventions

- Keep routes thin and put permission/business rules in the relevant module.
- Validate every external input. Never trust a client-supplied tenant or role without checking its authenticated relationship.
- All SQL parameters containing user data must be parameterized.
- Public HTML must use the renderer's escaping helpers. Never accept arbitrary executable markup.
- Add a new migration for schema changes. Do not modify an applied migration.
- Keep credentials in ignored local environment files or AWS Secrets Manager. Commit neither `.data` nor `.test-data`.
- Preserve separation of draft data, private source files, and approved releases.
- Add meaningful tests for authorization, data integrity, rendering, and publishing changes. Use `npm run typecheck`, `npm test`, `npm run test:e2e`, and `npm run build` before release.
- Format source with Prettier. Keep third-party integrations explicit about unconfigured and failed states.
- Do not label the application production-verified until the live checks in `docs/OPERATIONS.md` have passed.
