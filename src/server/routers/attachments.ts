import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { getUploadUrl, getDownloadUrl, deleteObject } from "@/lib/minio";
import { randomUUID } from "crypto";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

const ALLOWED_MIME_TYPES = [
    // Images
    "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
    // Documents
    "application/pdf", "text/plain", "text/csv", "text/html",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    // Video
    "video/mp4", "video/webm",
    // Audio
    "audio/mpeg", "audio/ogg", "audio/wav",
    // Archives
    "application/zip", "application/x-rar-compressed", "application/x-7z-compressed",
];

export const attachmentsRouter = router({
    getUploadUrl: protectedProcedure
        .input(
            z.object({
                taskId: z.string().optional(),
                noteId: z.string().optional(),
                filename: z.string(),
                mimeType: z.string().optional(),
                size: z.number().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            // Validate file size
            if (input.size && input.size > MAX_FILE_SIZE) {
                throw new Error("Файл слишком большой. Максимум 20 MB.");
            }

            // Validate MIME type
            if (input.mimeType && !ALLOWED_MIME_TYPES.includes(input.mimeType)) {
                throw new Error("Недопустимый тип файла.");
            }

            // Verify task or note belongs to user
            if (!input.taskId && !input.noteId) {
                throw new Error("Must provide taskId or noteId");
            }

            let s3Key = "";
            if (input.taskId) {
                const task = await ctx.prisma.task.findFirst({
                    where: { id: input.taskId, userId: ctx.userId },
                });
                if (!task) throw new Error("Task not found");
                const ext = input.filename.split(".").pop() || "";
                s3Key = `${ctx.userId}/${input.taskId}/${randomUUID()}.${ext}`;
            } else if (input.noteId) {
                const note = await ctx.prisma.note.findFirst({
                    where: { id: input.noteId, userId: ctx.userId },
                });
                if (!note) throw new Error("Note not found");
                const ext = input.filename.split(".").pop() || "";
                s3Key = `${ctx.userId}/notes/${input.noteId}/${randomUUID()}.${ext}`;
            }

            const url = await getUploadUrl(s3Key);

            // Create attachment record
            const attachment = await ctx.prisma.attachment.create({
                data: {
                    filename: input.filename,
                    mimeType: input.mimeType,
                    size: input.size,
                    s3Key,
                    taskId: input.taskId,
                    noteId: input.noteId,
                },
            });

            return { uploadUrl: url, attachment };
        }),

    getDownloadUrl: protectedProcedure
        .input(z.object({ id: z.string(), download: z.boolean().optional() }))
        .mutation(async ({ ctx, input }) => {
            const attachment = await ctx.prisma.attachment.findFirst({
                where: { id: input.id },
                include: { 
                    task: { select: { userId: true } },
                    note: { select: { userId: true } }
                },
            });
            if (!attachment) {
                throw new Error("Attachment not found");
            }
            const isOwner = attachment.task?.userId === ctx.userId || attachment.note?.userId === ctx.userId;
            if (!isOwner) {
                throw new Error("Attachment not found");
            }

            const url = `/api/attachments/${input.id}${input.download ? '?download=true' : ''}`;
            return { downloadUrl: url };
        }),

    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const attachment = await ctx.prisma.attachment.findFirst({
                where: { id: input.id },
                include: { 
                    task: { select: { userId: true } },
                    note: { select: { userId: true } }
                },
            });
            if (!attachment) {
                throw new Error("Attachment not found");
            }
            const isOwner = attachment.task?.userId === ctx.userId || attachment.note?.userId === ctx.userId;
            if (!isOwner) {
                throw new Error("Attachment not found");
            }

            try {
                await deleteObject(attachment.s3Key);
            } catch {
                // Ignore if object doesn't exist in MinIO
            }

            return ctx.prisma.attachment.delete({ where: { id: input.id } });
        }),

    listByTask: protectedProcedure
        .input(z.object({ taskId: z.string() }))
        .query(async ({ ctx, input }) => {
            return ctx.prisma.attachment.findMany({
                where: {
                    taskId: input.taskId,
                    task: { userId: ctx.userId },
                },
                orderBy: { createdAt: "desc" },
            });
        }),
});
