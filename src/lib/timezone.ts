export const DEFAULT_TIMEZONE = "Europe/Moscow";

export type LocalDate = {
    year: number;
    month: number;
    day: number;
};

export type LocalTime = {
    hour: number;
    minute: number;
};

export function normalizeTimeZone(timezone: string | null | undefined): string {
    if (!timezone) return DEFAULT_TIMEZONE;
    try {
        new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
        return timezone;
    } catch {
        return DEFAULT_TIMEZONE;
    }
}

export function getBrowserTimeZone(): string {
    if (typeof Intl === "undefined") return DEFAULT_TIMEZONE;
    return normalizeTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
}

export function getLocalDayRange(date: Date, timezone: string): { start: Date; end: Date } {
    const localDate = getLocalDate(date, timezone);
    const start = localDateTimeToUtc(localDate, { hour: 0, minute: 0 }, timezone);
    const nextDayStart = localDateTimeToUtc(addLocalDays(localDate, 1), { hour: 0, minute: 0 }, timezone);

    return {
        start,
        end: new Date(nextDayStart.getTime() - 1),
    };
}

export function dateInputToUtc(value: string, timezone: string): Date {
    const dateOnly = parseDateInput(value);
    if (dateOnly) {
        return localDateTimeToUtc(dateOnly, { hour: 0, minute: 0 }, timezone);
    }

    return new Date(value);
}

export function toDateInputValue(value: Date | string | null | undefined, timezone: string): string {
    if (!value) return "";
    return getLocalDateKey(new Date(value), timezone);
}

export function formatRelativeDate(
    value: Date | string | null | undefined,
    timezone: string,
    locale = "ru-RU"
): string | null {
    if (!value) return null;

    const date = new Date(value);
    const todayKey = getLocalDateKey(new Date(), timezone);
    const tomorrowKey = getLocalDateKey(addLocalDays(getLocalDate(new Date(), timezone), 1), timezone);
    const dateKey = getLocalDateKey(date, timezone);

    if (dateKey === todayKey) return "Сегодня";
    if (dateKey === tomorrowKey) return "Завтра";

    return date.toLocaleDateString(locale, {
        day: "numeric",
        month: "short",
        timeZone: timezone,
    });
}

export function isPastDueDate(
    value: Date | string | null | undefined,
    timezone: string,
    now = new Date()
): boolean {
    if (!value) return false;

    const date = new Date(value);
    const parts = getLocalDateTimeParts(date, timezone);
    const isDateOnly = parts.hour === 0 && parts.minute === 0 && parts.second === 0;

    if (!isDateOnly) {
        return date < now;
    }

    return getLocalDateKey(date, timezone) < getLocalDateKey(now, timezone);
}

export function getLocalDate(date: Date, timezone: string): LocalDate {
    const parts = getLocalDateTimeParts(date, timezone);
    return {
        year: parts.year,
        month: parts.month,
        day: parts.day,
    };
}

export function getLocalDateKey(date: Date | LocalDate, timezone?: string): string {
    const localDate = date instanceof Date ? getLocalDate(date, normalizeTimeZone(timezone)) : date;
    return [
        localDate.year,
        String(localDate.month).padStart(2, "0"),
        String(localDate.day).padStart(2, "0"),
    ].join("-");
}

export function localDateTimeToUtc(date: LocalDate, time: LocalTime, timezone: string): Date {
    const normalizedTimezone = normalizeTimeZone(timezone);
    const utcTimestamp = Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute, 0, 0);
    let result = new Date(utcTimestamp - getTimeZoneOffset(new Date(utcTimestamp), normalizedTimezone));
    const adjustedOffset = getTimeZoneOffset(result, normalizedTimezone);
    result = new Date(utcTimestamp - adjustedOffset);
    return result;
}

export function addLocalDays(date: LocalDate, amount: number): LocalDate {
    const next = new Date(Date.UTC(date.year, date.month - 1, date.day + amount, 0, 0, 0, 0));
    return {
        year: next.getUTCFullYear(),
        month: next.getUTCMonth() + 1,
        day: next.getUTCDate(),
    };
}

export function getLocalDateTimeParts(date: Date, timezone: string) {
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: normalizeTimeZone(timezone),
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

function parseDateInput(value: string): LocalDate | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;

    return {
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3]),
    };
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
