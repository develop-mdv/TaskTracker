import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get("authorization");
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return new Response("Unauthorized", { status: 401 });
        }

        // 1. Get all projects (to know their "Done" column)
        // We assume the "Done" column is the last one (highest position)
        // Or we could have a specific flag. For now, let's use the rightmost column.
        const projects = await prisma.project.findMany({
            include: {
                boardColumns: {
                    orderBy: { position: "desc" },
                    take: 1, // Get the last column
                },
            },
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let movedCount = 0;

        for (const project of projects) {
            const doneColumn = project.boardColumns[0];
            if (!doneColumn) continue;

            // Find tasks in this project that are completed BEFORE today
            // and are NOT yet in the done column (optional check, but good for performance)
            const result = await prisma.task.updateMany({
                where: {
                    projectId: project.id,
                    completedAt: { lt: today }, // Completed before today 00:00
                    boardColumnId: { not: doneColumn.id }, // Not already in Done column
                },
                data: {
                    boardColumnId: doneColumn.id,
                },
            });
            movedCount += result.count;
        }

        return NextResponse.json({ success: true, moved: movedCount });
    } catch (error) {
        console.error("Archive error:", error);
        return new Response("Internal Server Error", { status: 500 });
    }
}
