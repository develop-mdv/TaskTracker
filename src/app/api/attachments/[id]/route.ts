import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { minioClient, BUCKET } from "@/lib/minio";

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const url = new URL(request.url);
        const forceDownload = url.searchParams.get("download") === "true";

        const attachment = await prisma.attachment.findFirst({
            where: { id: params.id },
            include: {
                task: { select: { userId: true } },
                note: { select: { userId: true } }
            },
        });

        if (!attachment) {
            return new NextResponse("Attachment not found", { status: 404 });
        }

        const isOwner =
            attachment.task?.userId === session.user.id ||
            attachment.note?.userId === session.user.id;

        if (!isOwner) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        // Fetch from MinIO as stream
        const dataStream = await minioClient.getObject(BUCKET, attachment.s3Key);

        const headers = new Headers();
        if (attachment.mimeType) {
            headers.set("Content-Type", attachment.mimeType);
        }
        if (attachment.size) {
            headers.set("Content-Length", attachment.size.toString());
        }

        if (forceDownload) {
            const encodedName = encodeURIComponent(attachment.filename);
            headers.set(
                "Content-Disposition",
                `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`
            );
        } else {
            headers.set("Content-Disposition", "inline");
        }

        // @ts-ignore - Next.js NextResponse accepts readable streams
        return new NextResponse(dataStream, { headers });
    } catch (error) {
        console.error("Error fetching attachment:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
