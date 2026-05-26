import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateDueRecurringTasks } from "./recurrence-generator";

export async function POST(req: Request) {
    // Verify cron secret
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { created } = await generateDueRecurringTasks({ prisma });
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
