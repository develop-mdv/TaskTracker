import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const viewPreferencesRouter = router({
    get: protectedProcedure
        .input(
            z.object({
                section: z.string().optional(),
                projectId: z.string().optional(),
            })
        )
        .query(async ({ ctx, input }) => {
            const pref = await ctx.prisma.viewPreference.findFirst({
                where: {
                    userId: ctx.userId,
                    section: input.section ?? null,
                    projectId: input.projectId ?? null,
                },
            });
            return pref ?? { viewMode: "list" };
        }),

    set: protectedProcedure
        .input(
            z.object({
                section: z.string().optional(),
                projectId: z.string().optional(),
                viewMode: z.enum(["list", "kanban"]),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.prisma.viewPreference.findFirst({
                where: {
                    userId: ctx.userId,
                    section: input.section ?? null,
                    projectId: input.projectId ?? null,
                },
            });

            if (existing) {
                return ctx.prisma.viewPreference.update({
                    where: { id: existing.id },
                    data: { viewMode: input.viewMode },
                });
            }

            return ctx.prisma.viewPreference.create({
                data: {
                    userId: ctx.userId,
                    section: input.section ?? null,
                    projectId: input.projectId ?? null,
                    viewMode: input.viewMode,
                },
            });
        }),
});
