import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

const taskFilterSchema = z.object({
    section: z.enum(["inbox"]).optional(),
    projectId: z.string().optional(),
    // "today" is a smart filter, not a section
    today: z.boolean().optional(),
    archived: z.boolean().optional(),
    deleted: z.boolean().optional(),
    boardColumnId: z.string().optional(),
});

export const tasksRouter = router({
    list: protectedProcedure
        .input(taskFilterSchema)
        .query(async ({ ctx, input }) => {
            const where: Record<string, unknown> = {
                userId: ctx.userId,
            };

            if (input.deleted) {
                where.deletedAt = { not: null };
            } else {
                where.deletedAt = null;
            }

            if (input.archived) {
                where.completedAt = { not: null };
                where.deletedAt = null;
            } else if (!input.deleted) {
                where.completedAt = null;
            }

            if (input.today) {
                const start = new Date();
                start.setHours(0, 0, 0, 0);
                const end = new Date();
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
                // Don't filter by section/project for today view
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

            return ctx.prisma.task.findMany({
                where: where as any,
                orderBy: { position: "asc" },
                include: {
                    project: { select: { id: true, name: true, color: true } },
                    boardColumn: { select: { id: true, name: true, color: true } },
                    _count: { select: { attachments: true } },
                },
            });
        }),

    getById: protectedProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ ctx, input }) => {
            const task = await ctx.prisma.task.findFirst({
                where: { id: input.id, userId: ctx.userId },
                include: {
                    project: true,
                    boardColumn: true,
                    attachments: true,
                    recurrenceRule: true,
                },
            });
            if (!task) throw new TRPCError({ code: "NOT_FOUND" });
            return task;
        }),

    create: protectedProcedure
        .input(
            z.object({
                title: z.string().min(1).max(500),
                description: z.string().optional(),
                priority: z.number().int().min(0).max(4).optional(),
                tags: z.array(z.string()).optional(),
                section: z.enum(["inbox"]).nullable().optional(),
                projectId: z.string().nullable().optional(),
                boardColumnId: z.string().nullable().optional(),
                dueDate: z.string().nullable().optional(),
                startDate: z.string().nullable().optional(),
                endDate: z.string().nullable().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            // Calculate next position
            const maxPos = await ctx.prisma.task.aggregate({
                where: {
                    userId: ctx.userId,
                    section: input.section || undefined,
                    projectId: input.projectId || undefined,
                    boardColumnId: input.boardColumnId || undefined,
                    deletedAt: null,
                    completedAt: null,
                },
                _max: { position: true },
            });

            return ctx.prisma.task.create({
                data: {
                    title: input.title,
                    description: input.description,
                    priority: input.priority ?? 0,
                    tags: input.tags ?? [],
                    section: input.projectId ? null : (input.section ?? "inbox"),
                    projectId: input.projectId ?? null,
                    boardColumnId: input.boardColumnId ?? null,
                    dueDate: input.dueDate ? new Date(input.dueDate) : null,
                    startDate: input.startDate ? new Date(input.startDate) : null,
                    endDate: input.endDate ? new Date(input.endDate) : null,
                    position: (maxPos._max.position ?? 0) + 1,
                    userId: ctx.userId,
                },
                include: {
                    project: { select: { id: true, name: true, color: true } },
                    boardColumn: { select: { id: true, name: true, color: true } },
                },
            });
        }),

    update: protectedProcedure
        .input(
            z.object({
                id: z.string(),
                title: z.string().min(1).max(500).optional(),
                description: z.string().nullable().optional(),
                priority: z.number().int().min(0).max(4).optional(),
                tags: z.array(z.string()).optional(),
                section: z.enum(["inbox"]).nullable().optional(),
                projectId: z.string().nullable().optional(),
                boardColumnId: z.string().nullable().optional(),
                dueDate: z.string().nullable().optional(),
                startDate: z.string().nullable().optional(),
                endDate: z.string().nullable().optional(),
                position: z.number().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const { id, ...data } = input;

            const updateData: Record<string, unknown> = {};

            if (data.title !== undefined) updateData.title = data.title;
            if (data.description !== undefined) updateData.description = data.description;
            if (data.priority !== undefined) updateData.priority = data.priority;
            if (data.tags !== undefined) updateData.tags = data.tags;
            if (data.position !== undefined) updateData.position = data.position;

            if (data.section !== undefined) {
                updateData.section = data.section;
                if (data.section) updateData.projectId = null;
            }
            if (data.projectId !== undefined) {
                updateData.projectId = data.projectId;
                if (data.projectId) updateData.section = null;
            }
            if (data.boardColumnId !== undefined) updateData.boardColumnId = data.boardColumnId;

            if (data.dueDate !== undefined) {
                updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
            }
            if (data.startDate !== undefined) {
                updateData.startDate = data.startDate ? new Date(data.startDate) : null;
            }
            if (data.endDate !== undefined) {
                updateData.endDate = data.endDate ? new Date(data.endDate) : null;
            }

            return ctx.prisma.task.update({
                where: { id, userId: ctx.userId },
                data: updateData,
                include: {
                    project: { select: { id: true, name: true, color: true } },
                    boardColumn: { select: { id: true, name: true, color: true } },
                },
            });
        }),

    // Move task (change section, project, column, or position)
    move: protectedProcedure
        .input(
            z.object({
                id: z.string(),
                section: z.enum(["inbox"]).nullable().optional(),
                projectId: z.string().nullable().optional(),
                boardColumnId: z.string().nullable().optional(),
                position: z.number().optional(),
                dueDate: z.string().nullable().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const { id, ...data } = input;
            const updateData: Record<string, unknown> = {};

            if (data.section !== undefined) {
                updateData.section = data.section;
                if (data.section) updateData.projectId = null;
            }
            if (data.projectId !== undefined) {
                updateData.projectId = data.projectId;
                if (data.projectId) updateData.section = null;
            }
            if (data.boardColumnId !== undefined) updateData.boardColumnId = data.boardColumnId;
            if (data.position !== undefined) updateData.position = data.position;
            if (data.dueDate !== undefined) {
                updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
            }

            return ctx.prisma.task.update({
                where: { id, userId: ctx.userId },
                data: updateData,
                include: {
                    project: { select: { id: true, name: true, color: true } },
                    boardColumn: { select: { id: true, name: true, color: true } },
                },
            });
        }),

    complete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            return ctx.prisma.task.update({
                where: { id: input.id, userId: ctx.userId },
                data: { completedAt: new Date() },
            });
        }),

    uncomplete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            return ctx.prisma.task.update({
                where: { id: input.id, userId: ctx.userId },
                data: { completedAt: null },
            });
        }),

    softDelete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            return ctx.prisma.task.update({
                where: { id: input.id, userId: ctx.userId },
                data: { deletedAt: new Date() },
            });
        }),

    restore: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            return ctx.prisma.task.update({
                where: { id: input.id, userId: ctx.userId },
                data: { deletedAt: null },
            });
        }),

    hardDelete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            // Delete attachments from MinIO first
            const task = await ctx.prisma.task.findFirst({
                where: { id: input.id, userId: ctx.userId },
                include: { attachments: true },
            });
            if (!task) throw new TRPCError({ code: "NOT_FOUND" });

            // Delete from DB (cascade will remove attachments records)
            return ctx.prisma.task.delete({
                where: { id: input.id },
            });
        }),

    // Bulk operations
    bulkComplete: protectedProcedure
        .input(z.object({ ids: z.array(z.string()) }))
        .mutation(async ({ ctx, input }) => {
            return ctx.prisma.task.updateMany({
                where: { id: { in: input.ids }, userId: ctx.userId },
                data: { completedAt: new Date() },
            });
        }),

    bulkDelete: protectedProcedure
        .input(z.object({ ids: z.array(z.string()) }))
        .mutation(async ({ ctx, input }) => {
            return ctx.prisma.task.updateMany({
                where: { id: { in: input.ids }, userId: ctx.userId },
                data: { deletedAt: new Date() },
            });
        }),

    bulkMove: protectedProcedure
        .input(
            z.object({
                ids: z.array(z.string()),
                section: z.enum(["inbox"]).nullable().optional(),
                projectId: z.string().nullable().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const data: Record<string, unknown> = {};
            if (input.section !== undefined) {
                data.section = input.section;
                if (input.section) data.projectId = null;
            }
            if (input.projectId !== undefined) {
                data.projectId = input.projectId;
                if (input.projectId) data.section = null;
            }
            return ctx.prisma.task.updateMany({
                where: { id: { in: input.ids }, userId: ctx.userId },
                data,
            });
        }),

    bulkSetDueDate: protectedProcedure
        .input(
            z.object({
                ids: z.array(z.string()),
                dueDate: z.string().nullable(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            return ctx.prisma.task.updateMany({
                where: { id: { in: input.ids }, userId: ctx.userId },
                data: { dueDate: input.dueDate ? new Date(input.dueDate) : null },
            });
        }),

    reorder: protectedProcedure
        .input(
            z.object({
                items: z.array(z.object({ id: z.string(), position: z.number() })),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const ops = input.items.map((item) =>
                ctx.prisma.task.update({
                    where: { id: item.id, userId: ctx.userId },
                    data: { position: item.position },
                })
            );
            await ctx.prisma.$transaction(ops);
        }),
});
