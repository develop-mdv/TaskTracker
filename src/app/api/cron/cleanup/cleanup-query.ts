import type { Prisma } from "@prisma/client";

export function buildTrashCleanupWhere(now = new Date()): {
    taskWhere: Prisma.TaskWhereInput;
    projectWhere: Prisma.ProjectWhereInput;
} {
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const deletedOlderThanSevenDays = {
        deletedAt: {
            not: null,
            lt: sevenDaysAgo,
        },
    };

    return {
        taskWhere: deletedOlderThanSevenDays,
        projectWhere: deletedOlderThanSevenDays,
    };
}
