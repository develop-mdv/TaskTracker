import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildTrashCleanupWhere } from "./cleanup-query";

export async function POST(req: Request) {
    // Verify cron secret
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { taskWhere, projectWhere } = buildTrashCleanupWhere();

        const [tasksResult, projectsResult] = await prisma.$transaction([
            prisma.task.deleteMany({ where: taskWhere }),
            prisma.project.deleteMany({ where: projectWhere }),
        ]);

        return NextResponse.json({
            success: true,
            deleted: tasksResult.count + projectsResult.count,
            deletedTasks: tasksResult.count,
            deletedProjects: projectsResult.count,
        });
    } catch (error) {
        console.error("Trash cleanup error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}

export async function GET(req: Request) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ status: "ok", endpoint: "cleanup" });
}
