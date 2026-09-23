import test from "node:test";
import assert from "node:assert/strict";
import type { TRPCContext } from "../trpc";
import { tasksRouter } from "./tasks";

test("failed completion closes a task without moving it to Done, and reopening clears the result", async () => {
    const updates: Array<{ where: unknown; data: Record<string, unknown> }> = [];
    let columnQueries = 0;
    const prisma = {
        task: {
            findUnique: async () => ({ projectId: "project-1", boardColumnId: "work" }),
            update: async (input: { where: unknown; data: Record<string, unknown> }) => {
                updates.push(input);
                return input.data;
            },
        },
        boardColumn: {
            findMany: async () => {
                columnQueries++;
                return [{ id: "done", name: "Готово" }];
            },
        },
    } as unknown as TRPCContext["prisma"];
    const caller = tasksRouter.createCaller({
        prisma,
        userId: "user-1",
        userTimezone: "Europe/Moscow",
        session: null,
    });

    await caller.complete({ id: "task-1", result: "FAILURE", completionNote: "Не получилось" });
    assert.equal(columnQueries, 0);
    assert.deepEqual(updates[0].where, { id: "task-1", userId: "user-1" });
    assert.equal(updates[0].data.completionResult, "FAILURE");
    assert.equal(updates[0].data.completionNote, "Не получилось");
    assert.ok(updates[0].data.completedAt instanceof Date);
    assert.equal(updates[0].data.boardColumnId, undefined);

    await caller.uncomplete({ id: "task-1" });
    assert.deepEqual(updates[1].data, {
        completedAt: null,
        completionResult: "SUCCESS",
        completionNote: null,
    });

    await caller.complete({ id: "task-1", result: "SUCCESS" });
    assert.equal(columnQueries, 1);
    assert.equal(updates[2].data.completionResult, "SUCCESS");
    assert.equal(updates[2].data.boardColumnId, "done");
    assert.equal(updates[2].data.completionNote, null);
});
