# Project Completed Tasks Design

## Goal

Add a project-level "Completed" tab that shows completed tasks for the current project and makes the completion note visible.

## Current Context

Projects currently have two tabs on `src/app/(dashboard)/project/[id]/page.tsx`: tasks and notes. Tasks already store completion metadata in `Task.completedAt` and `Task.completionNote`, and the completion dialog writes `completionNote` when a task is marked complete from a card.

The global archive page already uses `TaskView` with `archived`, but project pages do not expose a dedicated completed-task view. Task cards and the detail drawer do not prominently show the saved completion note.

## Proposed UX

The project page gets a third tab: "Выполненные". Selecting it shows only completed, non-deleted tasks for that project. The view uses the existing task list surface rather than kanban, because completed work is best scanned chronologically and should not be dragged between active workflow columns.

Completed tasks should show the completion date and, when present, the saved completion note under an "Итог" label. The task detail drawer should also show the saved completion note and allow editing it through the existing task update mutation.

## Data Flow

`TaskView` will be reused with `projectId` and `archived` enabled. The `tasks.list` endpoint already supports both fields, but it currently sorts all results by `position`. Completed project tasks should be sorted by `completedAt` descending when `archived` is true.

The task list query must include `completionNote` so cards can render it. The drawer already fetches the full task and can update `completionNote` through `tasks.update`.

## Components

- `src/app/(dashboard)/project/[id]/page.tsx`: add the "Выполненные" tab and render `TaskView` in archived mode.
- `src/components/views/task-view.tsx`: keep create/view mode controls hidden for archived mode, and pass completed tasks to list view.
- `src/components/task/task-card.tsx`: render completion note and completed date for completed tasks.
- `src/components/task/task-detail-drawer.tsx`: render and edit `completionNote`.
- `src/server/routers/tasks.ts`: return `completionNote` in task lists and sort completed lists by `completedAt` descending.

## Testing

Add focused coverage for the completed-project filtering behavior at the data/query boundary if an existing test harness is available. If no test harness exists, use TypeScript and lint/build verification, plus browser verification of the new tab in the running app.

## Out of Scope

No new database tables or Prisma migrations are needed. This does not add a global completed-tasks page, change the existing archive page, or introduce a multi-entry completion history.
