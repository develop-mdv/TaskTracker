import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { router, protectedProcedure } from "../trpc";

export const statsRouter = router({
    overview: protectedProcedure
        .input(
            z.object({
                projectId: z.string().optional(),
            }).optional()
        )
        .query(async ({ ctx, input }) => {
            const where: Prisma.TaskWhereInput = { userId: ctx.userId };
            if (input?.projectId) where.projectId = input.projectId;

            const now = new Date();
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

            const [
                totalOpen,
                totalCompleted,
                totalFailed,
                createdThisWeek,
                completedThisWeek,
                createdThisMonth,
                completedThisMonth,
                totalDeleted,
                byPriority,
            ] = await Promise.all([
                // Open tasks
                ctx.prisma.task.count({
                    where: { ...where, completedAt: null, deletedAt: null },
                }),
                // Total completed
                ctx.prisma.task.count({
                    where: { ...where, completedAt: { not: null }, completionResult: "SUCCESS", deletedAt: null },
                }),
                ctx.prisma.task.count({
                    where: { ...where, completedAt: { not: null }, completionResult: "FAILURE", deletedAt: null },
                }),
                // Created this week
                ctx.prisma.task.count({
                    where: { ...where, createdAt: { gte: weekAgo }, deletedAt: null },
                }),
                // Completed this week
                ctx.prisma.task.count({
                    where: { ...where, completedAt: { gte: weekAgo }, completionResult: "SUCCESS", deletedAt: null },
                }),
                // Created this month
                ctx.prisma.task.count({
                    where: { ...where, createdAt: { gte: monthAgo }, deletedAt: null },
                }),
                // Completed this month
                ctx.prisma.task.count({
                    where: { ...where, completedAt: { gte: monthAgo }, completionResult: "SUCCESS", deletedAt: null },
                }),
                // In trash
                ctx.prisma.task.count({
                    where: { ...where, deletedAt: { not: null } },
                }),
                // By priority
                ctx.prisma.task.groupBy({
                    by: ["priority"],
                    where: { ...where, completedAt: null, deletedAt: null },
                    _count: true,
                }),
            ]);

            // Daily completion data for chart (last 14 days)
            const dailyData: { date: string; created: number; completed: number }[] = [];
            for (let i = 13; i >= 0; i--) {
                const dayStart = new Date(now);
                dayStart.setDate(dayStart.getDate() - i);
                dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(dayStart);
                dayEnd.setHours(23, 59, 59, 999);

                const [created, completed] = await Promise.all([
                    ctx.prisma.task.count({
                        where: {
                            ...where,
                            createdAt: { gte: dayStart, lte: dayEnd },
                            deletedAt: null,
                        },
                    }),
                    ctx.prisma.task.count({
                        where: {
                            ...where,
                            completedAt: { gte: dayStart, lte: dayEnd },
                            completionResult: "SUCCESS",
                            deletedAt: null,
                        },
                    }),
                ]);

                dailyData.push({
                    date: dayStart.toISOString().split("T")[0],
                    created,
                    completed,
                });
            }

            return {
                totalOpen,
                totalCompleted,
                totalFailed,
                createdThisWeek,
                completedThisWeek,
                createdThisMonth,
                completedThisMonth,
                totalDeleted,
                byPriority: byPriority.map((p) => ({
                    priority: p.priority,
                    count: p._count,
                })),
                dailyData,
            };
        }),
});
