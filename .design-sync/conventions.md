# Building with soma-todo-app components

This bundle comes from a small Next.js project-scheduler app ("Things To Do"), not a general component library. It ships two React components on `window.SomaTodo` — `DependencyGraph` and `TodoImage` — plus the app's compiled Tailwind stylesheet. No provider or theme wrapper is required; both components are self-contained.

## Styling idiom — Tailwind, but only the compiled subset

`styles.css` is a **compiled** Tailwind 3 sheet containing only the utilities this app actually uses. A Tailwind class not in the sheet silently does nothing. Before styling layout glue, check the class exists in `styles.css` / `_ds_bundle.css`; when in doubt use inline styles for your own glue. The app's verified vocabulary (all present in the sheet):

- Surfaces: `bg-white bg-opacity-90 rounded-lg shadow-lg p-4`, pills via `rounded-full`
- Page backdrop: `bg-gradient-to-b from-orange-500 to-red-500`, container `max-w-3xl`
- Text: `text-gray-800` (titles), `text-sm text-gray-500` (meta), `text-red-600 font-semibold` (overdue)
- Accents: critical-path badge `bg-amber-100 text-amber-800 border-amber-300`; primary action `bg-indigo-600 text-white hover:bg-indigo-700`
- Skeletons: `animate-pulse` + `bg-gray-300`

The visual language: warm orange→red gradient page, white rounded cards, indigo primary actions, amber = critical path, red = overdue/destructive.

## DependencyGraph

`<DependencyGraph tasks={tasks} criticalPath={ids} />` — an interactive React Flow DAG with dagre auto-layout, fixed 420px height, sized by its parent's width (**always give the parent an explicit width**; inside flex give it `flex: 1` or a set px width, or it collapses).

- `tasks: ScheduleTask[]` — each task: `{ id, title, durationDays, dependsOn: number[], earliestStartDate: ISO string, isCritical: boolean, dueDate, imageUrl, imageAlt, createdAt, earliestStartDay, earliestFinishDate }`. Edges are derived from `dependsOn` (prerequisite → dependent).
- `criticalPath: number[]` — ordered task ids; consecutive pairs render as amber animated edges, `isCritical: true` nodes get the amber border/cream fill.

```jsx
const { DependencyGraph } = window.SomaTodo;
<div style={{ width: 720 }}>
  <DependencyGraph tasks={tasks} criticalPath={[1, 2, 4]} />
</div>
```

## TodoImage

`<TodoImage url={string|null} alt={string|null} />` — fixed 64×64 rounded thumbnail with a built-in pulsing skeleton until the image loads. Renders **nothing** when `url` is null, so lay out the row to tolerate its absence. Typical use: leading element of a todo/list card row (it carries its own right margin).

## Where the truth lives

Read `styles.css` (and its `@import`ed `_ds_bundle.css`, which also carries the React Flow base styles) before inventing classes, and each component's `.d.ts` for the exact props.
