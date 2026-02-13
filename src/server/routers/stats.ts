import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const statsRouter = router({
    overview: protectedProcedure
        .input(
            z.object({
                projectId: z.string().optional(),
            }).optional()
        )
        .query(async ({ ctx, input }) => {
            const where: Record<string, unknown> = { userId: ctx.userId };
            if (input?.projectId) where.projectId = input.projectId;

            const now = new Date();
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

            const [
                totalOpen,
                totalCompleted,
                createdThisWeek,
                completedThisWeek,
                createdThisMonth,
                completedThisMonth,
                totalDeleted,
                byPriority,
            ] = await Promise.all([
                // Open tasks
                ctx.prisma.task.count({
                    where: { ...where, completedAt: null, deletedAt: null } as any,
                }),
                // Total completed
                ctx.prisma.task.count({
                    where: { ...where, completedAt: { not: null }, deletedAt: null } as any,
                }),
                // Created this week
                ctx.prisma.task.count({
                    where: { ...where, createdAt: { gte: weekAgo }, deletedAt: null } as any,
                }),
                // Completed this week
                ctx.prisma.task.count({
                    where: { ...where, completedAt: { gte: weekAgo }, deletedAt: null } as any,
                }),
                // Created this month
                ctx.prisma.task.count({
                    where: { ...where, createdAt: { gte: monthAgo }, deletedAt: null } as any,
                }),
                // Completed this month
                ctx.prisma.task.count({
                    where: { ...where, completedAt: { gte: monthAgo }, deletedAt: null } as any,
                }),
                // In trash
                ctx.prisma.task.count({
                    where: { ...where, deletedAt: { not: null } } as any,
                }),
                // By priority
                ctx.prisma.task.groupBy({
                    by: ["priority"],
                    where: { ...where, completedAt: null, deletedAt: null } as any,
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
                        } as any,
                    }),
                    ctx.prisma.task.count({
                        where: {
                            ...where,
                            completedAt: { gte: dayStart, lte: dayEnd },
                            deletedAt: null,
                        } as any,
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
