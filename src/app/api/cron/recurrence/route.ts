import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
    // Verify cron secret
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const now = new Date();
        const rules = await prisma.recurrenceRule.findMany({
            where: { active: true },
        });

        let created = 0;

        for (const rule of rules) {
            const shouldGenerate = shouldGenerateToday(rule, now);
            if (!shouldGenerate) continue;

            // Check if already generated today
            const todayStart = new Date(now);
            todayStart.setHours(0, 0, 0, 0);

            const existing = await prisma.task.findFirst({
                where: {
                    recurrenceRuleId: rule.id,
                    createdAt: { gte: todayStart },
                },
            });

            if (existing) continue;

            // Generate task
            await prisma.task.create({
                data: {
                    title: rule.title,
                    description: rule.description,
                    priority: rule.priority,
                    tags: rule.tags,
                    section: rule.projectId ? null : (rule.section ?? "inbox"),
                    projectId: rule.projectId,
                    dueDate: now,
                    position: 0,
                    userId: rule.userId,
                    recurrenceRuleId: rule.id,
                },
            });

            // Update lastGeneratedAt
            await prisma.recurrenceRule.update({
                where: { id: rule.id },
                data: { lastGeneratedAt: now },
            });

            created++;
        }

        return NextResponse.json({ success: true, created });
    } catch (error) {
        console.error("Recurrence generation error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}

function shouldGenerateToday(
    rule: {
        frequency: string;
        interval: number;
        daysOfWeek: number[];
        dayOfMonth: number | null;
        lastGeneratedAt: Date | null;
    },
    now: Date
): boolean {
    const dayOfWeek = now.getDay(); // 0=Sun..6=Sat
    const dayOfMonth = now.getDate();

    switch (rule.frequency) {
        case "daily":
            if (!rule.lastGeneratedAt) return true;
            const daysSinceLast = Math.floor(
                (now.getTime() - rule.lastGeneratedAt.getTime()) / (1000 * 60 * 60 * 24)
            );
            return daysSinceLast >= rule.interval;

        case "weekly":
            if (rule.daysOfWeek.length > 0 && !rule.daysOfWeek.includes(dayOfWeek)) {
                return false;
            }
            if (!rule.lastGeneratedAt) return true;
            const weeksSinceLast = Math.floor(
                (now.getTime() - rule.lastGeneratedAt.getTime()) /
                (1000 * 60 * 60 * 24 * 7)
            );
            return weeksSinceLast >= rule.interval;

        case "monthly":
            if (rule.dayOfMonth && dayOfMonth !== rule.dayOfMonth) return false;
            if (!rule.lastGeneratedAt) return true;
            const monthsSinceLast =
                (now.getFullYear() - rule.lastGeneratedAt.getFullYear()) * 12 +
                (now.getMonth() - rule.lastGeneratedAt.getMonth());
            return monthsSinceLast >= rule.interval;

        case "custom":
            if (!rule.lastGeneratedAt) return true;
            const customDaysSinceLast = Math.floor(
                (now.getTime() - rule.lastGeneratedAt.getTime()) / (1000 * 60 * 60 * 24)
            );
            return customDaysSinceLast >= rule.interval;

        default:
            return false;
    }
}

// Also support GET for simple health check
export async function GET(req: Request) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ status: "ok", endpoint: "recurrence" });
}
