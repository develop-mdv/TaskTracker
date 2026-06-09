import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { router, protectedProcedure } from "../trpc";

const SEARCH_LIMIT = 12;

export const searchRouter = router({
    all: protectedProcedure
        .input(
            z.object({
                query: z.string().trim().min(1).max(200),
            })
        )
        .query(async ({ ctx, input }) => {
            const query = input.query.trim();
            const terms = query.split(/\s+/).filter(Boolean);
            const stringFilter = { contains: query, mode: "insensitive" as const };
            const tagFilters: Prisma.TaskWhereInput[] = terms.map((term) => ({
                tags: { has: term },
            }));

            const [tasks, notes, projects] = await ctx.prisma.$transaction([
                ctx.prisma.task.findMany({
                    where: {
                        userId: ctx.userId,
                        deletedAt: null,
                        OR: [
                            { title: stringFilter },
                            { description: stringFilter },
                            ...tagFilters,
                        ],
                    },
                    include: {
                        project: { select: { id: true, name: true, color: true } },
                        boardColumn: { select: { id: true, name: true, color: true } },
                        _count: { select: { attachments: true } },
                    },
                    orderBy: [
                        { completedAt: "asc" },
                        { updatedAt: "desc" },
                    ],
                    take: SEARCH_LIMIT,
                }),
                ctx.prisma.note.findMany({
                    where: {
                        userId: ctx.userId,
                        deletedAt: null,
                        content: stringFilter,
                    },
                    include: {
                        project: { select: { id: true, name: true, color: true } },
                        attachments: true,
                    },
                    orderBy: [
                        { pinned: "desc" },
                        { updatedAt: "desc" },
                    ],
                    take: SEARCH_LIMIT,
                }),
                ctx.prisma.project.findMany({
                    where: {
                        userId: ctx.userId,
                        deletedAt: null,
                        OR: [
                            { name: stringFilter },
                            { description: stringFilter },
                        ],
                    },
                    include: {
                        _count: {
                            select: {
                                tasks: {
                                    where: { deletedAt: null },
                                },
                            },
                        },
                    },
                    orderBy: [
                        { completedAt: "asc" },
                        { updatedAt: "desc" },
                    ],
                    take: SEARCH_LIMIT,
                }),
            ]);

            return {
                query,
                tasks,
                notes,
                projects,
                total: tasks.length + notes.length + projects.length,
            };
        }),
});
