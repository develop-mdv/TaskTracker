import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const columnsRouter = router({
    list: protectedProcedure
        .input(
            z.object({
                projectId: z.string().optional(),
                section: z.string().optional(),
            })
        )
        .query(async ({ ctx, input }) => {
            return ctx.prisma.boardColumn.findMany({
                where: {
                    projectId: input.projectId ?? null,
                    section: input.section ?? null,
                },
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

    create: protectedProcedure
        .input(
            z.object({
                name: z.string().min(1).max(100),
                color: z.string().optional(),
                projectId: z.string().optional(),
                section: z.string().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const maxPos = await ctx.prisma.boardColumn.aggregate({
                where: {
                    projectId: input.projectId ?? null,
                    section: input.section ?? null,
                },
                _max: { position: true },
            });

            return ctx.prisma.boardColumn.create({
                data: {
                    name: input.name,
                    color: input.color,
                    position: (maxPos._max.position ?? 0) + 1,
                    projectId: input.projectId ?? null,
                    section: input.section ?? null,
                },
            });
        }),

    update: protectedProcedure
        .input(
            z.object({
                id: z.string(),
                name: z.string().min(1).max(100).optional(),
                color: z.string().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const { id, ...data } = input;
            return ctx.prisma.boardColumn.update({
                where: { id },
                data,
            });
        }),

    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            // Move tasks from this column to unassigned
            await ctx.prisma.task.updateMany({
                where: { boardColumnId: input.id },
                data: { boardColumnId: null },
            });
            return ctx.prisma.boardColumn.delete({
                where: { id: input.id },
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
                ctx.prisma.boardColumn.update({
                    where: { id: item.id },
                    data: { position: item.position },
                })
            );
            await ctx.prisma.$transaction(ops);
        }),
});
