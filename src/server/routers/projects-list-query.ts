import type { Prisma } from "@prisma/client";

type ProjectListQuery = {
    where: Prisma.ProjectWhereInput;
    orderBy: Prisma.ProjectOrderByWithRelationInput;
    include: Prisma.ProjectInclude;
};

export function buildCompletedProjectListQuery({ userId }: { userId: string }): ProjectListQuery {
    return {
        where: {
            userId,
            completedAt: { not: null },
            deletedAt: null,
        },
        orderBy: { completedAt: "desc" },
        include: {
            _count: {
                select: {
                    tasks: {
                        where: { deletedAt: null },
                    },
                },
            },
        },
    };
}

export function buildDeletedProjectListQuery({ userId }: { userId: string }): ProjectListQuery {
    return {
        where: {
            userId,
            deletedAt: { not: null },
        },
        orderBy: { deletedAt: "desc" },
        include: {
            _count: {
                select: {
                    tasks: true,
                },
            },
        },
    };
}
