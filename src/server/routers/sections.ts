import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

export const sectionsRouter = router({
    create: protectedProcedure
        .input(
            z.object({
                projectId: z.string(),
                name: z.string().min(1).max(100),
            })
        )
        .mutation(async ({ ctx, input }) => {
            // Verify project ownership
            const project = await ctx.prisma.project.findFirst({
                where: { id: input.projectId, userId: ctx.userId },
            });
            if (!project) throw new TRPCError({ code: "NOT_FOUND" });

            // Calculate position
            const maxPos = await ctx.prisma.projectSection.aggregate({
                where: { projectId: input.projectId },
                _max: { position: true },
            });

            return ctx.prisma.projectSection.create({
                data: {
                    name: input.name,
                    projectId: input.projectId,
                    position: (maxPos._max.position ?? 0) + 1,
                },
            });
        }),

    update: protectedProcedure
        .input(
            z.object({
                id: z.string(),
                name: z.string().min(1).max(100),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const section = await ctx.prisma.projectSection.findFirst({
                where: { id: input.id, project: { userId: ctx.userId } },
            });
            if (!section) throw new TRPCError({ code: "NOT_FOUND" });

            return ctx.prisma.projectSection.update({
                where: { id: input.id },
                data: { name: input.name },
            });
        }),

    delete: protectedProcedure
        .input(
            z.object({
                id: z.string(),
                mode: z.enum(["MOVE_TO_NONE", "TRASH"]),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const section = await ctx.prisma.projectSection.findFirst({
                where: { id: input.id, project: { userId: ctx.userId } },
            });
            if (!section) throw new TRPCError({ code: "NOT_FOUND" });

            return ctx.prisma.$transaction(async (tx) => {
                if (input.mode === "TRASH") {
                    // Soft delete tasks
                    await tx.task.updateMany({
                        where: { projectSectionId: input.id },
                        data: { deletedAt: new Date() },
                    });
                } else { // MOVE_TO_NONE
                    // Move tasks out of section
                    await tx.task.updateMany({
                        where: { projectSectionId: input.id },
                        data: { projectSectionId: null },
                    });
                }

                return tx.projectSection.delete({
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
                ctx.prisma.projectSection.update({
                    where: { id: item.id, project: { userId: ctx.userId } },
                    data: { position: item.position },
                })
            );
            await ctx.prisma.$transaction(ops);
        }),
});
