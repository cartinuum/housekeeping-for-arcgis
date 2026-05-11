# Contributing

## Development setup

```bash
npm install
npm run dev     # dev server at http://localhost:5173
npm test        # run tests (vitest)
npm run lint    # ESLint
npm run build   # type-check + production build
```

You will need an ArcGIS Online account and the OAuth client ID registered for `http://localhost:5173`. The default client ID in `src/config.ts` works for local development.

## Code style

- **Australian English** in all code, comments, and UI copy — organisation, colour, optimise, visualise
- **Calcite Design System** for all UI — `<calcite-icon>` always, never emoji or custom SVG unless Calcite has no equivalent
- **No `any`** in TypeScript — use proper types or minimal local interfaces
- Calcite events via `ref + addEventListener`, never JSX `onCalcite*` props (Calcite 5 rule)
- Follow existing patterns in the codebase — see `CLAUDE.md` for architecture and technical discoveries

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new feature
fix: correct a bug
docs: documentation only
refactor: rename or restructure without behaviour change
test: add or update tests
chore: build, tooling, or dependency changes
```

## Pull requests

- Open a PR against `main`
- Include a clear description of what changes and why
- Build and tests must pass: `npm run build && npm test`
- Lint must be clean: `npm run lint`

## Architecture

See `CLAUDE.md` for full architecture documentation, technical discoveries, and phase boundaries. Read it before proposing significant changes.
