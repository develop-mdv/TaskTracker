import test from "node:test";
import assert from "node:assert/strict";
import { buildCompletedProjectListQuery, buildDeletedProjectListQuery } from "./projects-list-query";

test("completed project list uses archive state and excludes deleted projects", () => {
    const query = buildCompletedProjectListQuery({ userId: "user-1" });

    assert.deepEqual(query.where, {
        userId: "user-1",
        completedAt: { not: null },
        deletedAt: null,
    });
    assert.deepEqual(query.orderBy, { completedAt: "desc" });
    assert.deepEqual(query.include, {
        _count: {
            select: {
                tasks: {
                    where: { deletedAt: null },
                },
            },
        },
    });
});

test("deleted project list uses trash state", () => {
    const query = buildDeletedProjectListQuery({ userId: "user-1" });

    assert.deepEqual(query.where, {
        userId: "user-1",
        deletedAt: { not: null },
    });
    assert.deepEqual(query.orderBy, { deletedAt: "desc" });
    assert.deepEqual(query.include, {
        _count: {
            select: {
                tasks: true,
            },
        },
    });
});
