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
