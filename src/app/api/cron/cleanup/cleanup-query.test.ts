import test from "node:test";
import assert from "node:assert/strict";
import { buildTrashCleanupWhere } from "./cleanup-query";

test("trash cleanup targets only deleted items older than seven days", () => {
    const query = buildTrashCleanupWhere(new Date("2026-05-19T12:00:00.000Z"));

    const expectedWhere = {
        deletedAt: {
            not: null,
            lt: new Date("2026-05-12T12:00:00.000Z"),
        },
    };

    assert.deepEqual(query.taskWhere, expectedWhere);
    assert.deepEqual(query.projectWhere, expectedWhere);
});
