import test from "node:test";
import assert from "node:assert/strict";
import { buildTaskListQuery } from "./tasks-list-query";

test("completed project task list filters by project and sorts newest completed first", () => {
    const query = buildTaskListQuery({
        userId: "user-1",
        input: {
            projectId: "project-1",
            archived: true,
        },
    });

    assert.deepEqual(query.where, {
        userId: "user-1",
        deletedAt: null,
        completedAt: { not: null },
        projectId: "project-1",
    });
    assert.deepEqual(query.orderBy, [{ completedAt: "desc" }, { position: "asc" }]);
});

test("global archive task list hides tasks from completed projects", () => {
    const query = buildTaskListQuery({
        userId: "user-1",
        input: {
            archived: true,
        },
    });

    assert.deepEqual(query.where, {
        userId: "user-1",
        deletedAt: null,
        completedAt: { not: null },
        OR: [
            { projectId: null },
            {
                project: {
                    completedAt: null,
                    deletedAt: null,
                },
            },
        ],
    });
    assert.deepEqual(query.orderBy, [{ completedAt: "desc" }, { position: "asc" }]);
});

test("global deleted task list hides tasks deleted with a project", () => {
    const query = buildTaskListQuery({
        userId: "user-1",
        input: {
            deleted: true,
        },
    });

    assert.deepEqual(query.where, {
        userId: "user-1",
        deletedAt: { not: null },
        deletedFromProjectId: null,
    });
    assert.deepEqual(query.orderBy, [{ deletedAt: "desc" }, { position: "asc" }]);
});

test("active project task list keeps active-or-today-completed behavior", () => {
    const query = buildTaskListQuery({
        userId: "user-1",
        now: new Date("2026-05-19T09:00:00.000Z"),
        timezone: "Europe/Moscow",
        input: {
            projectId: "project-1",
        },
    });

    assert.equal(query.where.userId, "user-1");
    assert.equal(query.where.deletedAt, null);
    assert.equal(query.where.projectId, "project-1");
    assert.deepEqual(query.where.OR, [
        { completedAt: null },
        { completedAt: { gte: new Date("2026-05-18T21:00:00.000Z") } },
    ]);
    assert.deepEqual(query.orderBy, { position: "asc" });
});

test("today task list uses the user's local day boundaries", () => {
    const query = buildTaskListQuery({
        userId: "user-1",
        now: new Date("2026-05-19T09:00:00.000Z"),
        timezone: "America/New_York",
        input: {
            today: true,
        },
    });

    assert.deepEqual(query.where.OR, [
        {
            dueDate: {
                gte: new Date("2026-05-19T04:00:00.000Z"),
                lte: new Date("2026-05-20T03:59:59.999Z"),
            },
        },
        {
            AND: [
                { startDate: { lte: new Date("2026-05-20T03:59:59.999Z") } },
                { endDate: { gte: new Date("2026-05-19T04:00:00.000Z") } },
            ],
        },
    ]);
});
