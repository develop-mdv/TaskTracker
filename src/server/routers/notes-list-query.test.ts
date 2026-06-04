import test from "node:test";
import assert from "node:assert/strict";
import { buildNoteListQuery } from "./notes-list-query";

test("inbox note list returns notes without a project", () => {
    const query = buildNoteListQuery({
        userId: "user-1",
        input: {
            section: "inbox",
        },
    });

    assert.deepEqual(query.where, {
        userId: "user-1",
        deletedAt: null,
        projectId: null,
    });
    assert.deepEqual(query.orderBy, { position: "asc" });
});

test("inbox note list can include notes from active projects", () => {
    const query = buildNoteListQuery({
        userId: "user-1",
        input: {
            section: "inbox",
            includeProjectNotes: true,
        },
    });

    assert.deepEqual(query.where, {
        userId: "user-1",
        deletedAt: null,
        OR: [
            { projectId: null },
            {
                project: {
                    archived: false,
                    completedAt: null,
                    deletedAt: null,
                },
            },
        ],
    });
    assert.deepEqual(query.orderBy, [{ projectId: "asc" }, { position: "asc" }]);
});

test("project note list remains scoped to a single project", () => {
    const query = buildNoteListQuery({
        userId: "user-1",
        input: {
            projectId: "project-1",
        },
    });

    assert.deepEqual(query.where, {
        userId: "user-1",
        deletedAt: null,
        projectId: "project-1",
    });
    assert.deepEqual(query.orderBy, { position: "asc" });
});
