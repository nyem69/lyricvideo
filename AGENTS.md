# Repository Guidelines

## Project Structure & Module Organization

This is a browser-only SvelteKit lyric video generator. The live app is under `src/`; `prototype.html` is historical reference. Route files live in `src/routes/`, shared code in `src/lib/`, and global styles in `src/app.css`.

- `src/lib/model/` defines `Song`, timing, and style types.
- `src/lib/parser/` parses Suno timestamp text and contains parser tests.
- `src/lib/stores/` holds singleton Svelte 5 rune stores.
- `src/lib/renderer/` contains the renderer abstraction and CSS renderer.
- `src/lib/presets/` contains visual presets and the registry.
- `suno-lyric-timestamps/` is the timestamp-extraction Chrome extension.
- `docs/` contains requirements, infra notes, and plans.

## Build, Test, and Development Commands

Use `pnpm`; the lockfile and workspace are pnpm-based.

- `pnpm dev` starts Vite on port `5178`.
- `pnpm build` creates the static SvelteKit build.
- `pnpm preview` serves the production build locally.
- `pnpm check` runs `svelte-kit sync` and `svelte-check`.
- `pnpm test` runs Vitest once.
- `pnpm test:watch` runs Vitest interactively.
- `pnpm vitest run src/lib/parser/suno.test.ts` runs a single test file.

## Coding Style & Naming Conventions

Write TypeScript with strict types and Svelte 5 runes. Prefer singleton store instances such as `playerStore` and `projectStore`; import the exported instance, not the class. Keep parser and model code DOM-free for Vitest's `node` environment.

Current Svelte components use PascalCase, such as `PlayerShell.svelte`. Preset files use descriptive kebab-case, such as `cinematic-minimal.ts`. Keep Tailwind v4 theme configuration in `src/app.css`, not a JS config. Use `@lucide/svelte` for icons.

## Testing Guidelines

Vitest is the test framework. Place tests near the module they cover using `*.test.ts`, as in `src/lib/parser/suno.test.ts`. Add focused tests for parser behavior, timing calculations, model transformations, and DOM-free logic. Run `pnpm check` and `pnpm test` before opening a PR.

## Commit & Pull Request Guidelines

Recent commits use concise Conventional Commit-style subjects, for example `feat: add player and project stores` and `fix(extension): auto-locate token array`. Use `feat:`, `fix:`, or `chore:` with optional scopes.

PRs should include a description, rationale, test results, and screenshots or recordings for UI changes. Link issues or docs when applicable. For extension work, mention tested Suno pages or DOM assumptions.

## Architecture & Configuration Notes

The app is client-rendered only: `src/routes/+layout.ts` disables SSR. Deployment uses `@sveltejs/adapter-static`; the base path is `/lyricvideo` unless `CAPACITOR=true`. Do not add server-only logic unless the architecture changes. Keep lyrics and audio client-side.
