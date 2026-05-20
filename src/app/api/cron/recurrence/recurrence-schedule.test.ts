import test from "node:test";
import assert from "node:assert/strict";
import {
    buildGeneratedTaskData,
    getNextOccurrenceToGenerate,
    type RecurrenceScheduleRule,
} from "./recurrence-schedule";

function makeRule(overrides: Partial<RecurrenceScheduleRule> = {}): RecurrenceScheduleRule {
    return {
        id: "rule-1",
        frequency: "weekly",
        interval: 1,
        daysOfWeek: [3],
        dayOfMonth: null,
        title: "Pay invoices",
        description: "Open banking app",
        priority: 2,
        tags: ["finance"],
        section: null,
        projectId: null,
        timezone: "Europe/Moscow",
        createAheadDays: 0,
        timeOfDay: null,
        createdAt: new Date("2026-05-18T09:00:00.000Z"),
        lastGeneratedAt: null,
        lastGeneratedFor: null,
        userId: "user-1",
        ...overrides,
    };
}

test("timed rules wait until fifteen minutes before the due time", () => {
    const rule = makeRule({ timeOfDay: "10:00" });

    const beforeWindow = getNextOccurrenceToGenerate(
        rule,
        new Date("2026-05-20T06:44:00.000Z")
    );
    const insideWindow = getNextOccurrenceToGenerate(
        rule,
        new Date("2026-05-20T06:45:00.000Z")
    );

    assert.equal(beforeWindow, null);
    assert.deepEqual(insideWindow, {
        dueAt: new Date("2026-05-20T07:00:00.000Z"),
        releaseAt: new Date("2026-05-20T06:45:00.000Z"),
    });
});

test("day-ahead release creates a task before the due date and keeps the due date", () => {
    const rule = makeRule({
        createAheadDays: 2,
        daysOfWeek: [5],
        timeOfDay: null,
    });

    const occurrence = getNextOccurrenceToGenerate(
        rule,
        new Date("2026-05-20T21:00:00.000Z")
    );

    assert.deepEqual(occurrence, {
        dueAt: new Date("2026-05-21T21:00:00.000Z"),
        releaseAt: new Date("2026-05-19T21:00:00.000Z"),
    });
});

test("legacy rules use lastGeneratedAt when lastGeneratedFor is missing", () => {
    const rule = makeRule({
        frequency: "daily",
        daysOfWeek: [],
        createdAt: new Date("2026-05-01T09:00:00.000Z"),
        lastGeneratedAt: new Date("2026-05-19T07:00:00.000Z"),
        lastGeneratedFor: null,
    });

    const occurrence = getNextOccurrenceToGenerate(
        rule,
        new Date("2026-05-20T00:00:00.000Z")
    );

    assert.deepEqual(occurrence, {
        dueAt: new Date("2026-05-19T21:00:00.000Z"),
        releaseAt: new Date("2026-05-19T21:00:00.000Z"),
    });
});

test("generated task data falls back to inbox when the rule has no project", () => {
    const rule = makeRule({ projectId: null, section: null });
    const data = buildGeneratedTaskData(rule, new Date("2026-05-20T07:00:00.000Z"));

    assert.equal(data.section, "inbox");
    assert.equal(data.projectId, null);
    assert.equal(data.recurrenceRuleId, "rule-1");
    assert.equal(data.userId, "user-1");
    assert.deepEqual(data.dueDate, new Date("2026-05-20T07:00:00.000Z"));
});

test("generated task data keeps project placement when a project is selected", () => {
    const rule = makeRule({ projectId: "project-1", section: "inbox" });
    const data = buildGeneratedTaskData(rule, new Date("2026-05-20T07:00:00.000Z"));

    assert.equal(data.section, null);
    assert.equal(data.projectId, "project-1");
});
