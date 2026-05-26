import test from "node:test";
import assert from "node:assert/strict";
import { generateDueRecurringTasks } from "./recurrence-generator";
import type { RecurrenceScheduleRule } from "./recurrence-schedule";

function makeRule(overrides: Partial<RecurrenceScheduleRule> = {}): RecurrenceScheduleRule {
    return {
        id: "rule-1",
        frequency: "daily",
        interval: 1,
        daysOfWeek: [],
        dayOfMonth: null,
        title: "Stretch",
        description: null,
        priority: 1,
        tags: [],
        section: null,
        projectId: null,
        timezone: "Europe/Moscow",
        createAheadDays: 0,
        timeOfDay: "10:00",
        createdAt: new Date("2026-05-20T06:00:00.000Z"),
        lastGeneratedAt: null,
        lastGeneratedFor: null,
        userId: "user-1",
        ...overrides,
    };
}

test("due recurrence generation creates a task and updates the rule", async () => {
    const createdTasks: unknown[] = [];
    const updatedRules: unknown[] = [];
    const prisma = {
        recurrenceRule: {
            findMany: async () => [makeRule()],
            update: async (input: unknown) => {
                updatedRules.push(input);
                return null;
            },
        },
        task: {
            findFirst: async () => null,
            create: async (input: { data: unknown }) => {
                createdTasks.push(input.data);
                return null;
            },
        },
    } as Parameters<typeof generateDueRecurringTasks>[0]["prisma"];

    const result = await generateDueRecurringTasks({
        prisma,
        userId: "user-1",
        now: new Date("2026-05-20T06:45:00.000Z"),
    });

    assert.equal(result.created, 1);
    assert.deepEqual(createdTasks, [
        {
            title: "Stretch",
            description: null,
            priority: 1,
            tags: [],
            section: "inbox",
            projectId: null,
            dueDate: new Date("2026-05-20T07:00:00.000Z"),
            position: 0,
            userId: "user-1",
            recurrenceRuleId: "rule-1",
        },
    ]);
    assert.deepEqual(updatedRules, [
        {
            where: { id: "rule-1" },
            data: {
                lastGeneratedAt: new Date("2026-05-20T06:45:00.000Z"),
                lastGeneratedFor: new Date("2026-05-20T07:00:00.000Z"),
            },
        },
    ]);
});
