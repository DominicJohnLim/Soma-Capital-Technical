# design-sync notes — soma-todo-app

- This is a Next.js **app**, not a component library: no dist build, no Storybook. The converter runs in synth-entry mode over `components/` with an explicit `componentSrcMap` (DependencyGraph, TodoImage). The rest of the UI lives inline in `app/page.tsx` and is not exported.
- `cssEntry` is the Tailwind CLI output at `.design-sync/.cache/tailwind.css` (gitignored). **Re-syncs must re-run `buildCmd` first** — the file is machine state and won't exist on a fresh clone.
- `DependencyGraph` imports `reactflow/dist/style.css` inside the module; expect that CSS in `_ds_bundle.css`.
- `DependencyGraph` props come from `lib/types.ts` (`ScheduleTask[]` + `criticalPath: number[]`); previews construct a realistic 4-task diamond project.
- Fonts: none shipped (globals.css uses Arial/system stack; Geist woffs are next/font app-level and not used by the synced components).
- First sync 2026-07-04 could not upload: session lacked design authorization (`/design-login` needs an interactive terminal). Local bundle built + verified; upload pending user auth.
- **Self-link required**: the converter resolves the package via `node_modules/soma-todo-app` — on a fresh clone run `ln -sfn ../ node_modules/soma-todo-app` before building (gitignored via node_modules).
- Components use dual exports (named + default): `export *` in the synthesized entry only picks up **named** exports, so keep the named ones; the app's `dynamic()` import uses the default.
- Grid presentation: both components use `cardMode: "column"` (graph is wide; TodoImage's InTodoCard composition overflowed a grid cell).

## Known render warns
- (none — GRID_OVERFLOW on TodoImage was resolved with the column override)

## Re-sync risks
- `.design-sync/.cache/tailwind.css` is generated; a re-sync that skips `buildCmd` ships a stale utility set (new classes in components won't be in the sheet).
- The conventions header enumerates Tailwind classes verified on 2026-07-04; if the app's class vocabulary changes, re-validate the header's class list against the fresh compiled CSS.
- Preview data in `previews/DependencyGraph.tsx` hand-builds `ScheduleTask` objects; if `lib/types.ts` gains required fields, previews compile (esbuild doesn't typecheck) but may render stale shapes — sanity-check after type changes.
