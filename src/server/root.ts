import { router } from "./trpc";
import { projectsRouter } from "./routers/projects";
import { tasksRouter } from "./routers/tasks";
import { columnsRouter } from "./routers/columns";
import { attachmentsRouter } from "./routers/attachments";
import { recurrenceRouter } from "./routers/recurrence";
import { statsRouter } from "./routers/stats";
import { viewPreferencesRouter } from "./routers/viewPreferences";

export const appRouter = router({
    projects: projectsRouter,
    tasks: tasksRouter,
    columns: columnsRouter,
    attachments: attachmentsRouter,
    recurrence: recurrenceRouter,
    stats: statsRouter,
    viewPreferences: viewPreferencesRouter,
});

export type AppRouter = typeof appRouter;
