const DAY_MS = 24 * 60 * 60 * 1000;
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const DEFAULT_TIMEZONE = "Europe/Moscow";

export type RecurrenceScheduleRule = {
    id: string;
    frequency: string;
    interval: number;
    daysOfWeek: number[];
    dayOfMonth: number | null;
    title: string;
    description: string | null;
    priority: number;
    tags: string[];
    section: string | null;
    projectId: string | null;
    timezone: string;
    createAheadDays: number;
    timeOfDay: string | null;
    createdAt: Date;
    lastGeneratedAt: Date | null;
    lastGeneratedFor: Date | null;
    userId: string;
};

export type RecurrenceOccurrence = {
    dueAt: Date;
    releaseAt: Date;
};

export type ExistingGeneratedTask = {
    recurrenceRuleId: string | null;
    dueDate: Date | null;
};

export type PlannedRecurrenceEvent = {
    id: string;
    recurrenceRuleId: string;
    title: string;
    dueAt: Date;
    releaseAt: Date;
    projectId: string | null;
    section: string | null;
    priority: number;
};

type LocalDate = {
    year: number;
    month: number;
    day: number;
};

type LocalTime = {
    hour: number;
    minute: number;
};

export function getNextOccurrenceToGenerate(
    rule: RecurrenceScheduleRule,
    now: Date
): RecurrenceOccurrence | null {
    const [occurrence] = getOccurrencesInRange(rule, rule.createdAt, addUtcDays(now, 366 * 5));
    if (!occurrence) return null;
    return occurrence.releaseAt <= now ? occurrence : null;
}

export function getOccurrencesInRange(
    rule: RecurrenceScheduleRule,
    from: Date,
    to: Date
): RecurrenceOccurrence[] {
    const timezone = normalizeTimeZone(rule.timezone);
    const interval = Math.max(1, rule.interval);
    const anchorDate = getLocalDate(rule.createdAt, timezone);
    const createdDate = getLocalDate(rule.createdAt, timezone);
    const lastGeneratedBoundary = rule.lastGeneratedFor ?? rule.lastGeneratedAt;
    const startDate = lastGeneratedBoundary
        ? addLocalDays(getLocalDate(lastGeneratedBoundary, timezone), 1)
        : createdDate;
    const occurrences: RecurrenceOccurrence[] = [];

    for (let offset = 0; offset <= 366 * 5; offset++) {
        const candidateDate = addLocalDays(startDate, offset);
        if (!matchesRuleDate(rule, candidateDate, anchorDate, interval)) {
            continue;
        }

        const dueAt = localDateTimeToUtc(
            candidateDate,
            parseTimeOfDay(rule.timeOfDay) ?? { hour: 0, minute: 0 },
            timezone
        );

        if (lastGeneratedBoundary && dueAt <= lastGeneratedBoundary) {
            continue;
        }

        if (!lastGeneratedBoundary && parseTimeOfDay(rule.timeOfDay) && dueAt < rule.createdAt) {
            continue;
        }

        const releaseAt = getReleaseAt(rule, candidateDate, dueAt, timezone);
        if (dueAt > to) {
            break;
        }
        if (dueAt >= from) {
            occurrences.push({ dueAt, releaseAt });
        }
    }

    return occurrences;
}

export function buildPlannedRecurrenceEvents({
    rules,
    existingTasks,
    from,
    to,
}: {
    rules: RecurrenceScheduleRule[];
    existingTasks: ExistingGeneratedTask[];
    from: Date;
    to: Date;
}): PlannedRecurrenceEvent[] {
    const generatedKeys = new Set(
        existingTasks
            .filter((task) => task.recurrenceRuleId && task.dueDate)
            .map((task) => `${task.recurrenceRuleId}:${task.dueDate?.toISOString()}`)
    );

    return rules.flatMap((rule) =>
        getOccurrencesInRange(rule, from, to)
            .filter((occurrence) => !generatedKeys.has(`${rule.id}:${occurrence.dueAt.toISOString()}`))
            .map((occurrence) => ({
                id: `planned:${rule.id}:${occurrence.dueAt.toISOString()}`,
                recurrenceRuleId: rule.id,
                title: rule.title,
                dueAt: occurrence.dueAt,
                releaseAt: occurrence.releaseAt,
                projectId: rule.projectId,
                section: rule.section,
                priority: rule.priority,
            }))
    );
}

export function buildGeneratedTaskData(rule: RecurrenceScheduleRule, dueAt: Date) {
    return {
        title: rule.title,
        description: rule.description,
        priority: rule.priority,
        tags: rule.tags,
        section: rule.projectId ? null : (rule.section ?? "inbox"),
        projectId: rule.projectId,
        dueDate: dueAt,
        position: 0,
        userId: rule.userId,
        recurrenceRuleId: rule.id,
    };
}

function matchesRuleDate(
    rule: RecurrenceScheduleRule,
    candidateDate: LocalDate,
    anchorDate: LocalDate,
    interval: number
): boolean {
    switch (rule.frequency) {
        case "daily":
        case "custom":
            return daysBetween(anchorDate, candidateDate) % interval === 0;
        case "weekly": {
            const allowedDays = rule.daysOfWeek.length > 0
                ? rule.daysOfWeek
                : [getWeekday(anchorDate)];
            if (!allowedDays.includes(getWeekday(candidateDate))) {
                return false;
            }
            return weeksBetween(anchorDate, candidateDate) % interval === 0;
        }
        case "monthly": {
            const targetDay = rule.dayOfMonth ?? anchorDate.day;
            return (
                candidateDate.day === targetDay &&
                monthsBetween(anchorDate, candidateDate) % interval === 0
            );
        }
        default:
            return false;
    }
}

function getReleaseAt(
    rule: RecurrenceScheduleRule,
    dueDate: LocalDate,
    dueAt: Date,
    timezone: string
): Date {
    const timeOfDay = parseTimeOfDay(rule.timeOfDay);
    const createAheadDays = Math.max(0, rule.createAheadDays);
    let releaseAt = dueAt;

    if (createAheadDays > 0) {
        releaseAt = localDateTimeToUtc(
            addLocalDays(dueDate, -createAheadDays),
            { hour: 0, minute: 0 },
            timezone
        );
    }

    if (timeOfDay) {
        const timedReleaseAt = new Date(dueAt.getTime() - FIFTEEN_MINUTES_MS);
        releaseAt = createAheadDays > 0 && releaseAt < timedReleaseAt
            ? releaseAt
            : timedReleaseAt;
    }

    return releaseAt;
}

function parseTimeOfDay(value: string | null): LocalTime | null {
    if (!value) return null;
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
    if (!match) return null;
    return {
        hour: Number(match[1]),
        minute: Number(match[2]),
    };
}

function normalizeTimeZone(timezone: string | null | undefined): string {
    if (!timezone) return DEFAULT_TIMEZONE;
    try {
        new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
        return timezone;
    } catch {
        return DEFAULT_TIMEZONE;
    }
}

function getLocalDate(date: Date, timezone: string): LocalDate {
    const parts = getLocalDateTimeParts(date, timezone);
    return {
        year: parts.year,
        month: parts.month,
        day: parts.day,
    };
}

function getLocalDateTimeParts(date: Date, timezone: string) {
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });

    const values = Object.fromEntries(
        formatter
            .formatToParts(date)
            .filter((part) => part.type !== "literal")
            .map((part) => [part.type, Number(part.value)])
    );

    return {
        year: values.year,
        month: values.month,
        day: values.day,
        hour: values.hour === 24 ? 0 : values.hour,
        minute: values.minute,
        second: values.second,
    };
}

function localDateTimeToUtc(date: LocalDate, time: LocalTime, timezone: string): Date {
    const utcTimestamp = Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute, 0, 0);
    let result = new Date(utcTimestamp - getTimeZoneOffset(new Date(utcTimestamp), timezone));
    const adjustedOffset = getTimeZoneOffset(result, timezone);
    result = new Date(utcTimestamp - adjustedOffset);
    return result;
}

function getTimeZoneOffset(date: Date, timezone: string): number {
    const parts = getLocalDateTimeParts(date, timezone);
    const localAsUtc = Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second,
        0
    );
    return localAsUtc - date.getTime();
}

function addLocalDays(date: LocalDate, amount: number): LocalDate {
    const next = new Date(Date.UTC(date.year, date.month - 1, date.day + amount, 0, 0, 0, 0));
    return {
        year: next.getUTCFullYear(),
        month: next.getUTCMonth() + 1,
        day: next.getUTCDate(),
    };
}

function addUtcDays(date: Date, amount: number): Date {
    return new Date(date.getTime() + amount * DAY_MS);
}

function daysBetween(start: LocalDate, end: LocalDate): number {
    return Math.floor((toUtcDay(end) - toUtcDay(start)) / DAY_MS);
}

function weeksBetween(start: LocalDate, end: LocalDate): number {
    return Math.floor(daysBetween(startOfWeek(start), startOfWeek(end)) / 7);
}

function monthsBetween(start: LocalDate, end: LocalDate): number {
    return (end.year - start.year) * 12 + (end.month - start.month);
}

function startOfWeek(date: LocalDate): LocalDate {
    return addLocalDays(date, -getWeekday(date));
}

function getWeekday(date: LocalDate): number {
    return new Date(toUtcDay(date)).getUTCDay();
}

function toUtcDay(date: LocalDate): number {
    return Date.UTC(date.year, date.month - 1, date.day, 0, 0, 0, 0);
}
