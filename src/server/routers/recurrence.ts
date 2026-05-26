import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { generateDueRecurringTasks } from "@/app/api/cron/recurrence/recurrence-generator";
import { buildPlannedRecurrenceEvents } from "@/app/api/cron/recurrence/recurrence-schedule";

const timeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).nullable();

export const recurrenceRouter = router({
    list: protectedProcedure.query(async ({ ctx }) => {
        return ctx.prisma.recurrenceRule.findMany({
            where: { userId: ctx.userId, active: true },
            orderBy: { createdAt: "desc" },
        });
    }),

    planned: protectedProcedure
        .input(
            z.object({
                from: z.string().datetime(),
                to: z.string().datetime(),
            })
        )
        .query(async ({ ctx, input }) => {
            const from = new Date(input.from);
            const to = new Date(input.to);

            const rules = await ctx.prisma.recurrenceRule.findMany({
                where: { userId: ctx.userId, active: true },
                orderBy: { createdAt: "desc" },
            });
            const ruleIds = rules.map((rule) => rule.id);
            const existingTasks = ruleIds.length > 0
                ? await ctx.prisma.task.findMany({
                    where: {
                        userId: ctx.userId,
                        recurrenceRuleId: { in: ruleIds },
                        dueDate: { gte: from, lte: to },
                    },
                    select: {
                        recurrenceRuleId: true,
                        dueDate: true,
                    },
                })
                : [];

            const planned = buildPlannedRecurrenceEvents({
                rules,
                existingTasks,
                from,
                to,
            });
            const projectIds = Array.from(
                new Set(planned.map((event) => event.projectId).filter((id): id is string => Boolean(id)))
            );
            const projects = projectIds.length > 0
                ? await ctx.prisma.project.findMany({
                    where: {
                        userId: ctx.userId,
                        id: { in: projectIds },
                    },
                    select: {
                        id: true,
                        name: true,
                        color: true,
                    },
                })
                : [];
            const projectsById = new Map(projects.map((project) => [project.id, project]));

            return planned.map((event) => ({
                ...event,
                project: event.projectId ? projectsById.get(event.projectId) ?? null : null,
            }));
        }),

    generateDue: protectedProcedure.mutation(async ({ ctx }) => {
        const result = await generateDueRecurringTasks({
            prisma: ctx.prisma,
            userId: ctx.userId,
        });
        return result;
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
                createAheadDays: z.number().int().min(0).max(365).optional(),
                timeOfDay: timeOfDaySchema.optional(),
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
                    section: input.projectId ? null : (input.section ?? "inbox"),
                    projectId: input.projectId ?? null,
                    timezone: input.timezone,
                    createAheadDays: input.createAheadDays ?? 0,
                    timeOfDay: input.timeOfDay ?? null,
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
                section: z.enum(["inbox"]).nullable().optional(),
                projectId: z.string().nullable().optional(),
                timezone: z.string().optional(),
                createAheadDays: z.number().int().min(0).max(365).optional(),
                timeOfDay: timeOfDaySchema.optional(),
                active: z.boolean().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const { id, ...data } = input;
            const updateData: Record<string, unknown> = { ...data };

            if (data.projectId !== undefined) {
                updateData.projectId = data.projectId;
                updateData.section = data.projectId ? null : (data.section ?? "inbox");
            } else if (data.section !== undefined) {
                updateData.section = data.section;
                if (data.section) updateData.projectId = null;
            }

            return ctx.prisma.recurrenceRule.update({
                where: { id },
                data: updateData,
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
