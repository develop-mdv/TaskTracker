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

    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            return ctx.prisma.project.delete({
                where: { id: input.id, userId: ctx.userId },
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
