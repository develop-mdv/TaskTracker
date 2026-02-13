import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { getUploadUrl, getDownloadUrl, deleteObject } from "@/lib/minio";
import { randomUUID } from "crypto";

export const attachmentsRouter = router({
    getUploadUrl: protectedProcedure
        .input(
            z.object({
                taskId: z.string(),
                filename: z.string(),
                mimeType: z.string().optional(),
                size: z.number().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            // Verify task belongs to user
            const task = await ctx.prisma.task.findFirst({
                where: { id: input.taskId, userId: ctx.userId },
            });
            if (!task) throw new Error("Task not found");

            const ext = input.filename.split(".").pop() || "";
            const s3Key = `${ctx.userId}/${input.taskId}/${randomUUID()}.${ext}`;

            const url = await getUploadUrl(s3Key);

            // Create attachment record
            const attachment = await ctx.prisma.attachment.create({
                data: {
                    filename: input.filename,
                    mimeType: input.mimeType,
                    size: input.size,
                    s3Key,
                    taskId: input.taskId,
                },
            });

            return { uploadUrl: url, attachment };
        }),

    getDownloadUrl: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const attachment = await ctx.prisma.attachment.findFirst({
                where: { id: input.id },
                include: { task: { select: { userId: true } } },
            });
            if (!attachment || attachment.task.userId !== ctx.userId) {
                throw new Error("Attachment not found");
            }

            const url = await getDownloadUrl(attachment.s3Key);
            return { downloadUrl: url };
        }),

    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const attachment = await ctx.prisma.attachment.findFirst({
                where: { id: input.id },
                include: { task: { select: { userId: true } } },
            });
            if (!attachment || attachment.task.userId !== ctx.userId) {
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
