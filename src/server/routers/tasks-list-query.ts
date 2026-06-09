import type { Prisma } from "@prisma/client";
import { getLocalDayRange, DEFAULT_TIMEZONE, normalizeTimeZone } from "@/lib/timezone";

export type TaskListInput = {
    section?: "inbox";
    projectId?: string;
    today?: boolean;
    archived?: boolean;
    deleted?: boolean;
    boardColumnId?: string;
    includeCompleted?: boolean;
};

export function buildTaskListQuery({
    userId,
    input,
    now = new Date(),
    timezone,
}: {
    userId: string;
    input: TaskListInput;
    now?: Date;
    timezone?: string;
}): {
    where: Prisma.TaskWhereInput;
    orderBy: Prisma.TaskOrderByWithRelationInput | Prisma.TaskOrderByWithRelationInput[];
} {
    const userTimezone = normalizeTimeZone(timezone ?? DEFAULT_TIMEZONE);
    const where: Prisma.TaskWhereInput = {
        userId,
    };

    if (input.deleted) {
        where.deletedAt = { not: null };
        if (!input.projectId) {
            where.deletedFromProjectId = null;
        }
    } else {
        where.deletedAt = null;
    }

    if (input.includeCompleted) {
        // Fetch all non-deleted tasks.
    } else if (input.archived) {
        where.completedAt = { not: null };
        if (!input.projectId) {
            where.OR = [
                { projectId: null },
                {
                    project: {
                        completedAt: null,
                        deletedAt: null,
                    },
                },
            ];
        }
    } else if (!input.deleted) {
        const today = getLocalDayRange(now, userTimezone);

        where.OR = [
            { completedAt: null },
            { completedAt: { gte: today.start } },
        ];
    }

    if (input.today) {
        const { start, end } = getLocalDayRange(now, userTimezone);
        where.OR = [
            { dueDate: { gte: start, lte: end } },
            {
                AND: [
                    { startDate: { lte: end } },
                    { endDate: { gte: start } },
                ],
            },
        ];
    } else {
        if (input.section) {
            where.section = input.section;
        }
        if (input.projectId) {
            where.projectId = input.projectId;
        }
    }

    if (input.boardColumnId) {
        where.boardColumnId = input.boardColumnId;
    }

    return {
        where,
        orderBy: input.deleted
            ? [{ deletedAt: "desc" }, { position: "asc" }]
            : input.archived
            ? [{ completedAt: "desc" }, { position: "asc" }]
            : { position: "asc" },
    };
}
