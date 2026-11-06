# Code structure and formatting rules

These rules apply to every change in `next-app/`, including AI-generated changes. Follow them before writing code and verify them before handing work back.

## Required checks

1. Format changed source with `npm run format`.
2. Run `npm run format:check`, `npm run lint`, and `npm run typecheck`.
3. Run `npm run build` when a change affects application behavior, routing, configuration, or production compilation.
4. Run tests relevant to the change when the user or project instructions request tests. Report checks that were not run; never imply they passed.
5. Keep credentials in ignored environment files. Never place secrets, real user data, or provider payloads in source, tests, logs, docs, or screenshots.

## Structure

```text
src/
  app/                 Routes, layouts, route boundaries, loading and not-found UI
    <route>/actions.ts Server Actions for that route
    <route>/page.tsx   Route orchestration and page composition
  components/          Reusable UI shared across routes
    ui/                Primitive design-system components
  hooks/               Client-side state/effect behavior reused by multiple components
  lib/                 Domain logic, validation, provider clients and server utilities
    supabase/          Supabase client construction
```

- Keep route-specific components beside their route when they have one caller. Promote them to `components/` only when they have at least two real callers or are a deliberate shared primitive.
- A route page should coordinate data loading and compose components. Move substantial presentational markup into a named component when it obscures the page flow; do not split files just to hit a line count.
- Keep domain logic out of JSX and route rendering. Put pure transformations/validation in `lib/`; put browser state/effect behavior in `hooks/` only when it is reused or meaningfully isolates complex client behavior.
- Put shared visual primitives in `components/ui/`. Prefer the existing shadcn/Base UI components and tokens before adding another primitive or dependency.
- Keep Server Components as the default. Add `"use client"` only at the smallest interactive boundary.
- Keep database access and provider credentials server-only. Server Actions validate all submitted data and derive ownership from the authenticated session.

## Reuse and abstraction rules

- If a component is rendered by more than one route/component, extract one shared component and use it at every call site. Do not copy/paste markup and let the copies drift.
- If the same non-trivial logic appears in two places, extract one named function in the closest shared domain module and update every caller.
- A repeated sequence of React state/effect/event behavior belongs in a hook when at least two components need it. Pure calculations belong in a normal function, not a hook.
- Do not create one-use wrappers, generic frameworks, factories, or abstractions with only hypothetical future callers. Keep a one-off component local to its route.
- Shared components expose typed, purposeful props. Avoid boolean prop piles; use a small variant union or separate components when behavior meaningfully differs.
- Reuse existing types, schemas, utilities, and components before defining another version. Keep shared domain types near the domain module that owns them.

## Formatting and naming

- Prettier is the source-format authority. Use two spaces, semicolons, double quotes, trailing commas, and a 100-character print width as configured in `.prettierrc.json`.
- One import per line when formatting requires it; group external imports before aliased/local imports. Do not alphabetize or reorder imports manually against Prettier/ESLint behavior.
- Use `PascalCase` for React components and types, `camelCase` for functions/variables/hooks, and `SCREAMING_SNAKE_CASE` only for true module-level constants.
- Name files for their primary export using kebab-case. Use `use-*.ts` for hooks. Use route convention filenames exactly as required by Next.js.
- Prefer early returns, explicit branches, and descriptive names over nested ternaries, compressed expressions, or clever abbreviations.
- Keep one logical statement per line. Never minify JSX, CSS, SQL, or TypeScript to reduce file length.
- Keep CSS grouped by component/feature, with shared tokens near the top. Avoid appending duplicate overrides; edit the original rule or create a clearly named component class.

## Implementation boundaries

- Read `../REBUILD_PLAN.md` and `../PHASES.md` before feature work. Work only within the phase the user authorized.
- Do not mix unrelated cleanup into a feature change. A cleanup should have a clear target and keep behavior unchanged unless the user asks for behavior changes.
- Preserve accessible names, labels, keyboard operation, focus states, status/error semantics, loading/empty states, and responsive behavior when extracting UI.
- Validate external and form input at trust boundaries. Keep errors sanitized; never render raw provider errors or exception messages to users.
- Do not add a package if the installed platform or dependencies already solve the need. Explain any new dependency in the phase notes.
- Update `../PHASES.md` with the files/behavior changed, checks actually run, unresolved issues, and next action. Do not claim a live gate passed from local evidence.
