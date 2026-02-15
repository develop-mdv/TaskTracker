import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const projectsRouter = router({
    list: protectedProcedure.query(async ({ ctx }) => {
        return ctx.prisma.project.findMany({
            where: { userId: ctx.userId, archived: false },
            orderBy: { position: "asc" },
            include: {
                _count: {
                    select: {
                        tasks: {
                            where: { completedAt: null, deletedAt: null },
                        },
                    },
                },
            },
        });
    }),

    getById: protectedProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ ctx, input }) => {
            const project = await ctx.prisma.project.findFirst({
                where: { id: input.id, userId: ctx.userId },
                include: {
                    boardColumns: { orderBy: { position: "asc" } },
                    sections: { orderBy: { position: "asc" } },
                },
            });
            if (!project) throw new Error("Project not found");
            return project;
        }),

    create: protectedProcedure
        .input(
            z.object({
                name: z.string().min(1).max(200),
                description: z.string().optional(),
                color: z.string().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const maxPos = await ctx.prisma.project.aggregate({
                where: { userId: ctx.userId },
                _max: { position: true },
            });

            const project = await ctx.prisma.project.create({
                data: {
                    name: input.name,
                    description: input.description,
                    color: input.color || "#6366f1",
                    position: (maxPos._max.position ?? 0) + 1,
                    userId: ctx.userId,
                },
            });

            // Create default columns
            const defaultColumns = [
                { name: "Идея", position: 0, color: "#a78bfa" },
                { name: "Надо сделать", position: 1, color: "#60a5fa" },
                { name: "В работе", position: 2, color: "#fbbf24" },
                { name: "Тестируется", position: 3, color: "#fb923c" },
                { name: "Готово", position: 4, color: "#34d399" },
            ];

            for (const col of defaultColumns) {
                await ctx.prisma.boardColumn.create({
                    data: { ...col, projectId: project.id },
                });
            }

            return project;
        }),

    update: protectedProcedure
        .input(
            z.object({
                id: z.string(),
                name: z.string().min(1).max(200).optional(),
                description: z.string().optional(),
                color: z.string().optional(),
                archived: z.boolean().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const { id, ...data } = input;
            return ctx.prisma.project.update({
                where: { id, userId: ctx.userId },
                data,
            });
        }),

    // Soft delete: Move project and its active tasks to trash
    softDelete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const project = await ctx.prisma.project.findUnique({
                where: { id: input.id, userId: ctx.userId },
            });
            if (!project) throw new Error("Not found");

            return ctx.prisma.$transaction(async (tx) => {
                // Mark tasks as deleted because of project deletion
                // Only touch tasks that are NOT already deleted
                await tx.task.updateMany({
                    where: { projectId: input.id, deletedAt: null },
                    data: {
                        deletedAt: new Date(),
                        deletedFromProjectId: input.id,
                    },
                });

                return tx.project.update({
                    where: { id: input.id },
                    data: { deletedAt: new Date() },
                });
            });
        }),

    // Restore: Bring back project and ONLY tasks that were deleted with it
    restore: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const project = await ctx.prisma.project.findUnique({
                where: { id: input.id, userId: ctx.userId },
            });
            if (!project) throw new Error("Not found");

            return ctx.prisma.$transaction(async (tx) => {
                // Restore tasks that were deleted specifically by project deletion
                await tx.task.updateMany({
                    where: {
                        projectId: input.id,
                        deletedFromProjectId: input.id
                    },
                    data: {
                        deletedAt: null,
                        deletedFromProjectId: null, // clear the flag
                    },
                });

                return tx.project.update({
                    where: { id: input.id },
                    data: { deletedAt: null },
                });
            });
        }),

    // Hard delete: Permanent removal
    hardDelete: protectedProcedure
        .input(z.object({
            id: z.string(),
            mode: z.enum(["TRASH_TASKS", "DELETE_ALL"]).default("TRASH_TASKS"),
        }))
        .mutation(async ({ ctx, input }) => {
            const project = await ctx.prisma.project.findUnique({
                where: { id: input.id, userId: ctx.userId },
            });
            if (!project) throw new Error("Not found");

            return ctx.prisma.$transaction(async (tx) => {
                if (input.mode === "DELETE_ALL") {
                    // Cascade delete will handle tasks if configured in schema, 
                    // but manual delete is safer to trigger attachment cleanup logic if needed
                    // (Though currently hardDelete task logic is separate)
                    // For now relying on cascade from database might be tricky if we want to clean S3
                    // Let's assume database cascade handles records, or we do manual

                    // Actually, schema uses onDelete: SetNull for Task.project? No.
                    // Task.project: @relation(..., onDelete: SetNull) in schema? Let's check.
                    // Schema:   project   Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)
                    // Wait, if onDelete is SetNull, then deleting project unlinks tasks.
                    // That's bad for "DELETE_ALL". We must manually delete tasks first.

                    await tx.task.deleteMany({
                        where: { projectId: input.id },
                    });
                } else {
                    // TRASH_TASKS (Default)
                    // Soft delete all tasks associated (even if already deleted? yes, ensure they are deleted)
                    // And unlink them from project (since project is gone) OR keep projectId?
                    // Schema says SetNull on delete. 
                    // So if we delete project, projectId becomes null.
                    // We want to preserve context? If projectId is null, we lose where it came from.
                    // But if hard delete project, we can't keep broken reference.
                    // So we must accept they go to "Trash" without project assignment.

                    await tx.task.updateMany({
                        where: { projectId: input.id },
                        data: {
                            deletedAt: new Date(),
                            projectId: null, // detached
                            projectSectionId: null, // detached
                            // deletedFromProjectId? No project to restore to.
                        }
                    });
                }

                return tx.project.delete({
                    where: { id: input.id },
                });
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
                ctx.prisma.project.update({
                    where: { id: item.id, userId: ctx.userId },
                    data: { position: item.position },
                })
            );
            await ctx.prisma.$transaction(ops);
        }),
});
