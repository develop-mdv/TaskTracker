import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { minioClient, BUCKET } from "@/lib/minio";

// Disables the default Next.js bodyParser to allow handling FormData manually if needed
// Actually Next.js App Router natively supports request.formData() so we omit config

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const taskId = formData.get("taskId") as string | null;
        const noteId = formData.get("noteId") as string | null;

        if (!file) return new NextResponse("No file provided", { status: 400 });
        if (!taskId && !noteId) return new NextResponse("No taskId or noteId provided", { status: 400 });
        
        // 20MB limit
        if (file.size > 20 * 1024 * 1024) return new NextResponse("File too large", { status: 413 });

        let s3Key = "";
        
        if (taskId) {
            const task = await prisma.task.findFirst({
                where: { id: taskId, userId: session.user.id }
            });
            if (!task) return new NextResponse("Task not found", { status: 404 });
            const ext = file.name.split(".").pop() || "";
            s3Key = `${session.user.id}/${taskId}/${crypto.randomUUID()}.${ext}`;
        } else if (noteId) {
            const note = await prisma.note.findFirst({
                where: { id: noteId, userId: session.user.id }
            });
            if (!note) return new NextResponse("Note not found", { status: 404 });
            const ext = file.name.split(".").pop() || "";
            s3Key = `${session.user.id}/notes/${noteId}/${crypto.randomUUID()}.${ext}`;
        }

        // Read file into memory (works well for up to 50MB)
        const buffer = Buffer.from(await file.arrayBuffer());

        // Upload to Minio from server directly bypassing any CORS and SSL limitations
        await minioClient.putObject(BUCKET, s3Key, buffer, file.size, {
            "Content-Type": file.type || "application/octet-stream"
        });

        // Save to Database
        const attachment = await prisma.attachment.create({
            data: {
                filename: file.name,
                mimeType: file.type || "application/octet-stream",
                size: file.size,
                s3Key,
                taskId: taskId || undefined,
                noteId: noteId || undefined,
            }
        });

        return NextResponse.json({ attachment });
    } catch (error) {
        console.error("Upload error:", error);
        return new NextResponse("Internal server error", { status: 500 });
    }
}
