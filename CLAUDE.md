# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault is a platform for playing games online and competing for the highest score. The repo is currently a fresh `create-next-app` scaffold: only `app/layout.tsx`, `app/page.tsx` and `app/globals.css` exist, all still template content.

Development follows a spec-driven workflow using the `/spec` and `/spec-impl` skills from [Klerith/fernando-skills](https://github.com/Klerith/fernando-skills) (install with `npx skills@latest add Klerith/fernando-skills`). Write or update a spec before implementing a feature.

## Commands

```bash
npm run dev     # dev server at http://localhost:3000 (also regenerates AGENTS.md)
npm run build   # production build (includes type checking)
npm run start   # serve the production build
npm run lint    # ESLint (flat config: next core-web-vitals + typescript)
npx tsc --noEmit  # type-check without building
```

There is no test runner configured yet.

## Skills

Use always /frontend-design to design the user interface


## Stack and conventions

- **Next.js 16.3 (App Router) + React 19.2.** APIs differ from older Next.js; check `node_modules/next/dist/docs/` (`01-app/`, `03-architecture/`) before using a Next.js API. Example: the root layout types its props with the global `LayoutProps<"/">` helper instead of hand-written prop types.
- **Tailwind CSS v4** through `@tailwindcss/postcss`. No `tailwind.config.js`; theme tokens live in `app/globals.css` via `@import "tailwindcss"` and `@theme inline`, mapped from CSS variables (`--background`, `--foreground`, Geist font variables set in `app/layout.tsx`).
- **TypeScript strict mode.** The `@/*` path alias points to the repo root (not `src/`), e.g. `@/app/...`.
