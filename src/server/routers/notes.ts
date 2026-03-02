import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const notesRouter = router({
    list: protectedProcedure
        .input(z.object({ projectId: z.string() }))
        .query(async ({ ctx, input }) => {
            return ctx.prisma.note.findMany({
                where: {
                    projectId: input.projectId,
                    userId: ctx.userId,
                    deletedAt: null,
                },
                orderBy: { position: "asc" },
            });
        }),

    listTrashed: protectedProcedure
        .input(z.object({ projectId: z.string() }))
        .query(async ({ ctx, input }) => {
            return ctx.prisma.note.findMany({
                where: {
                    projectId: input.projectId,
                    userId: ctx.userId,
                    deletedAt: { not: null },
                },
                orderBy: { deletedAt: "desc" },
            });
        }),

    create: protectedProcedure
        .input(
            z.object({
                projectId: z.string(),
                content: z.string().min(1).max(2000),
                color: z.string().optional(),
                pinned: z.boolean().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            // Get max position for ordering
            const maxPos = await ctx.prisma.note.aggregate({
                where: {
                    projectId: input.projectId,
                    userId: ctx.userId,
                    deletedAt: null,
                },
                _max: { position: true },
            });

            return ctx.prisma.note.create({
                data: {
                    content: input.content,
                    color: input.color ?? "#FEF08A",
                    pinned: input.pinned ?? false,
                    position: (maxPos._max.position ?? 0) + 1,
                    projectId: input.projectId,
                    userId: ctx.userId,
                },
            });
        }),

    update: protectedProcedure
        .input(
            z.object({
                id: z.string(),
                content: z.string().min(1).max(2000).optional(),
                color: z.string().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const { id, ...data } = input;
            return ctx.prisma.note.update({
                where: { id, userId: ctx.userId },
                data,
            });
        }),

    pin: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            return ctx.prisma.note.update({
                where: { id: input.id, userId: ctx.userId },
                data: { pinned: true },
            });
        }),

    unpin: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            return ctx.prisma.note.update({
                where: { id: input.id, userId: ctx.userId },
                data: { pinned: false },
            });
        }),

    softDelete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            return ctx.prisma.note.update({
                where: { id: input.id, userId: ctx.userId },
                data: { deletedAt: new Date(), pinned: false },
            });
        }),

    restore: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            return ctx.prisma.note.update({
                where: { id: input.id, userId: ctx.userId },
                data: { deletedAt: null },
            });
        }),

    hardDelete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            return ctx.prisma.note.delete({
                where: { id: input.id, userId: ctx.userId },
            });
        }),
});
