## Soma Capital Technical Assessment

This is a technical assessment as part of the interview process for Soma Capital.

> [!IMPORTANT]  
> You will need a Pexels API key to complete the technical assessment portion of the application. You can sign up for a free API key at https://www.pexels.com/api/  

To begin, clone this repository to your local machine.

## Development

This is a [NextJS](https://nextjs.org) app, with a SQLite based backend, intended to be run with the LTS version of Node.

To run the development server:

```bash
npm i
npm run dev
```

## Task:

Modify the code to add support for due dates, image previews, and task dependencies.

### Part 1: Due Dates 

When a new task is created, users should be able to set a due date.

When showing the task list is shown, it must display the due date, and if the date is past the current time, the due date should be in red.

### Part 2: Image Generation 

When a todo is created, search for and display a relevant image to visualize the task to be done. 

To do this, make a request to the [Pexels API](https://www.pexels.com/api/) using the task description as a search query. Display the returned image to the user within the appropriate todo item. While the image is being loaded, indicate a loading state.

You will need to sign up for a free Pexels API key to make the fetch request. 

### Part 3: Task Dependencies

Implement a task dependency system that allows tasks to depend on other tasks. The system must:

1. Allow tasks to have multiple dependencies
2. Prevent circular dependencies
3. Show the critical path
4. Calculate the earliest possible start date for each task based on its dependencies
5. Visualize the dependency graph

## Submission:

1. Add a new "Solution" section to this README with a description and screenshot or recording of your solution. 
2. Push your changes to a public GitHub repository.
3. Submit a link to your repository in the application form.

Thanks for your time and effort. We'll be in touch soon!

## Solution

All three parts are implemented, plus unit tests on the scheduling logic and an AI feature that decomposes a todo into scheduled subtasks. The core design decision: all graph/scheduling logic lives in a pure, framework-free module ([`lib/scheduling.ts`](lib/scheduling.ts)) that the API routes consume — so the interesting algorithms are unit-testable without a database or HTTP layer.

![Todo list with due dates, images, dependencies, and critical path badges](docs/list.png)

### Part 1: Due Dates

- The (previously unwired) date input is bound to the create form; `POST /api/todos` accepts an optional `dueDate` and stores it as UTC midnight.
- Due dates render on each card and turn **red when past due**. The comparison is date-only (`lib/dates.ts`) — a task due *today* is not overdue — and compares the stored UTC calendar day against the user's local calendar day so it behaves correctly in any timezone.

### Part 2: Image Generation

- On creation, the server queries the Pexels search API with the todo title and persists `imageUrl`/`imageAlt` on the row (`lib/pexels.ts`). Fetching server-side keeps the API key off the client, and persisting means the list never re-hits Pexels on render (rate-limit friendly).
- The UI shows a pulsing skeleton card while the create request is in flight, and a skeleton tile until each image finishes loading.
- Failure is never fatal: missing key, no results, 4xx/5xx, or network errors all resolve to "no image" and the todo is still created.

### Part 3: Task Dependencies

**Schema** — an explicit join model, so a todo can have many dependencies and many dependents:

```prisma
model TodoDependency {
  id          Int  @id @default(autoincrement())
  todoId      Int  // the dependent task
  dependsOnId Int  // the prerequisite task
  todo        Todo @relation("TodoDependencies", fields: [todoId], references: [id], onDelete: Cascade)
  dependsOn   Todo @relation("DependentTodos", fields: [dependsOnId], references: [id], onDelete: Cascade)
  @@unique([todoId, dependsOnId])
}
```

Each todo also carries a `durationDays` (editable inline) that feeds the schedule.

**1. Multiple dependencies** — add/remove via chips on each card; `POST /api/todos/[id]/dependencies`, `DELETE /api/todos/[id]/dependencies/[depId]`.

**2. Circular dependency prevention** — adding "A depends on B" is rejected iff A is already reachable from B by walking prerequisite links (DFS over the full graph), which catches direct (A→B→A), transitive (A→B→C→A), and self cycles. Rejections return a 400 with both task titles, surfaced as a dismissible banner in the UI. As defense in depth, the topological sort also throws if a cycle somehow reaches it.

**3. Critical path** — computed with the Critical Path Method: a forward pass in topological order (Kahn's algorithm) computes each task's earliest start/finish, then the longest path is backtracked from the task that finishes last. Critical tasks get an amber badge in the list and amber animated edges in the graph.

**4. Earliest start dates** — `earliestStart(task) = max(earliestFinish(prerequisites))`, anchored at today. Shown on every card. This is **computed on read** (`GET /api/schedule`), not persisted: derived state goes stale on every dependency/duration edit, while recomputing is O(V+E) and always correct at this scale.

**5. Visualization** — an interactive React Flow graph with dagre auto-layout. Critical-path nodes are amber; only *consecutive* critical-path edges are highlighted (two critical nodes can be joined by a redundant shortcut edge that isn't on the path).

![Dependency graph with the critical path highlighted](docs/graph.png)

### Beyond scope

- **✨ AI task decomposition** — the sparkle button on any todo calls `POST /api/todos/decompose`, which asks Claude (structured JSON output) for 2–8 subtasks with estimated durations and inter-subtask dependencies. The response is strictly validated (`parseDecomposition` — index bounds, self-edges, size limits) and cycle-checked with the same engine before anything is written; subtasks + edges are created in one transaction and the original todo becomes dependent on all of them. Without `ANTHROPIC_API_KEY` the endpoint degrades to a friendly 503.
- **Unit tests** — `npm test` (Vitest, 29 tests) covers cycle detection (self/direct/transitive/redundant-edge), topological sort, critical path on diamond graphs with unequal branch weights, disconnected components, overdue date logic, the Pexels client (mocked fetch, error paths), and the LLM response validator.

### Setup

```bash
npm i
cp .env.example .env   # add PEXELS_API_KEY (images) and ANTHROPIC_API_KEY (AI decompose) — both optional
npx prisma migrate dev
npm run dev
npm test
```
