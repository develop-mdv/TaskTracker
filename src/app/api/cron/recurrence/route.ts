import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildGeneratedTaskData, getNextOccurrenceToGenerate } from "./recurrence-schedule";

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
            const occurrence = getNextOccurrenceToGenerate(rule, now);
            if (!occurrence) continue;

            const existing = await prisma.task.findFirst({
                where: {
                    recurrenceRuleId: rule.id,
                    dueDate: occurrence.dueAt,
                },
            });

            if (existing) {
                await prisma.recurrenceRule.update({
                    where: { id: rule.id },
                    data: {
                        lastGeneratedAt: existing.createdAt,
                        lastGeneratedFor: occurrence.dueAt,
                    },
                });
                continue;
            }

            // Generate task
            await prisma.task.create({
                data: buildGeneratedTaskData(rule, occurrence.dueAt),
            });

            // Update lastGeneratedAt
            await prisma.recurrenceRule.update({
                where: { id: rule.id },
                data: {
                    lastGeneratedAt: now,
                    lastGeneratedFor: occurrence.dueAt,
                },
            });

            created++;
        }

        return NextResponse.json({ success: true, created });
    } catch (error) {
        console.error("Recurrence generation error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
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
