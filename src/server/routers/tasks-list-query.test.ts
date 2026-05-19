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
        now: new Date(2026, 4, 19, 12, 0, 0),
        input: {
            projectId: "project-1",
        },
    });

    assert.equal(query.where.userId, "user-1");
    assert.equal(query.where.deletedAt, null);
    assert.equal(query.where.projectId, "project-1");
    assert.deepEqual(query.where.OR, [
        { completedAt: null },
        { completedAt: { gte: new Date(2026, 4, 19, 0, 0, 0, 0) } },
    ]);
    assert.deepEqual(query.orderBy, { position: "asc" });
});
