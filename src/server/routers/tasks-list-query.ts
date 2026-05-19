import type { Prisma } from "@prisma/client";

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
}: {
    userId: string;
    input: TaskListInput;
    now?: Date;
}): {
    where: Prisma.TaskWhereInput;
    orderBy: Prisma.TaskOrderByWithRelationInput | Prisma.TaskOrderByWithRelationInput[];
} {
    const where: Prisma.TaskWhereInput = {
        userId,
    };

    if (input.deleted) {
        where.deletedAt = { not: null };
    } else {
        where.deletedAt = null;
    }

    if (input.includeCompleted) {
        // Fetch all non-deleted tasks.
    } else if (input.archived) {
        where.completedAt = { not: null };
    } else if (!input.deleted) {
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        where.OR = [
            { completedAt: null },
            { completedAt: { gte: todayStart } },
        ];
    }

    if (input.today) {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);
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
        orderBy: input.archived
            ? [{ completedAt: "desc" }, { position: "asc" }]
            : { position: "asc" },
    };
}
