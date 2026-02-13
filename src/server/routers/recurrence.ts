import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const recurrenceRouter = router({
    list: protectedProcedure.query(async ({ ctx }) => {
        return ctx.prisma.recurrenceRule.findMany({
            where: { userId: ctx.userId, active: true },
            orderBy: { createdAt: "desc" },
        });
    }),

    create: protectedProcedure
        .input(
            z.object({
                frequency: z.enum(["daily", "weekly", "monthly", "custom"]),
                interval: z.number().int().min(1).default(1),
                daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
                dayOfMonth: z.number().int().min(1).max(31).optional(),
                title: z.string().min(1),
                description: z.string().optional(),
                priority: z.number().int().min(0).max(4).optional(),
                tags: z.array(z.string()).optional(),
                section: z.enum(["inbox"]).nullable().optional(),
                projectId: z.string().nullable().optional(),
                timezone: z.string().default("Europe/Amsterdam"),
            })
        )
        .mutation(async ({ ctx, input }) => {
            return ctx.prisma.recurrenceRule.create({
                data: {
                    frequency: input.frequency,
                    interval: input.interval,
                    daysOfWeek: input.daysOfWeek ?? [],
                    dayOfMonth: input.dayOfMonth,
                    title: input.title,
                    description: input.description,
                    priority: input.priority ?? 0,
                    tags: input.tags ?? [],
                    section: input.section,
                    projectId: input.projectId,
                    timezone: input.timezone,
                    userId: ctx.userId,
                },
            });
        }),

    update: protectedProcedure
        .input(
            z.object({
                id: z.string(),
                frequency: z.enum(["daily", "weekly", "monthly", "custom"]).optional(),
                interval: z.number().int().min(1).optional(),
                daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
                dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
                title: z.string().min(1).optional(),
                description: z.string().nullable().optional(),
                priority: z.number().int().min(0).max(4).optional(),
                tags: z.array(z.string()).optional(),
                active: z.boolean().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const { id, ...data } = input;
            return ctx.prisma.recurrenceRule.update({
                where: { id },
                data,
            });
        }),

    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            return ctx.prisma.recurrenceRule.delete({
                where: { id: input.id },
            });
        }),
});
