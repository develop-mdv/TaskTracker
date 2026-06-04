import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { router, protectedProcedure } from "../trpc";
import { buildNoteListQuery } from "./notes-list-query";

const noteFilterSchema = z.object({
    projectId: z.string().nullable().optional(),
    section: z.enum(["inbox"]).optional(),
    includeProjectNotes: z.boolean().optional(),
});

function buildTrashedNoteWhere({
    userId,
    input,
}: {
    userId: string;
    input: z.infer<typeof noteFilterSchema>;
}) {
    const where: Prisma.NoteWhereInput = {
        userId,
        deletedAt: { not: null },
    };

    if (input.section === "inbox") {
        if (input.includeProjectNotes) {
            where.OR = [
                { projectId: null },
                {
                    project: {
                        archived: false,
                        completedAt: null,
                        deletedAt: null,
                    },
                },
            ];
        } else {
            where.projectId = null;
        }
    } else if (input.projectId) {
        where.projectId = input.projectId;
    }

    return where;
}

export const notesRouter = router({
    list: protectedProcedure
        .input(noteFilterSchema)
        .query(async ({ ctx, input }) => {
            const { where, orderBy } = buildNoteListQuery({
                userId: ctx.userId,
                input,
            });

            return ctx.prisma.note.findMany({
                where,
                include: {
                    attachments: true,
                    project: { select: { id: true, name: true, color: true } },
                },
                orderBy,
            });
        }),

    listTrashed: protectedProcedure
        .input(noteFilterSchema)
        .query(async ({ ctx, input }) => {
            return ctx.prisma.note.findMany({
                where: buildTrashedNoteWhere({ userId: ctx.userId, input }),
                include: {
                    attachments: true,
                    project: { select: { id: true, name: true, color: true } },
                },
                orderBy: input.section === "inbox" && input.includeProjectNotes
                    ? [{ projectId: "asc" }, { deletedAt: "desc" }]
                    : { deletedAt: "desc" },
            });
        }),

    create: protectedProcedure
        .input(
            z.object({
                projectId: z.string().nullable().optional(),
                section: z.enum(["inbox"]).nullable().optional(),
                content: z.string().min(1),
                color: z.string().optional(),
                pinned: z.boolean().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const projectId = input.section === "inbox" ? null : input.projectId ?? null;

            // Get max position for ordering
            const maxPos = await ctx.prisma.note.aggregate({
                where: {
                    projectId,
                    userId: ctx.userId,
                    deletedAt: null,
                },
                _max: { position: true },
            });

            return ctx.prisma.note.create({
                data: {
                    content: input.content,
                    color: input.color ?? "#FEF08A",
                    pinned: input.pinned ?? false,
                    position: (maxPos._max.position ?? 0) + 1,
                    projectId,
                    userId: ctx.userId,
                },
                include: {
                    attachments: true,
                    project: { select: { id: true, name: true, color: true } },
                },
            });
        }),

    update: protectedProcedure
        .input(
            z.object({
                id: z.string(),
                content: z.string().min(1).optional(),
                color: z.string().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const { id, ...data } = input;
            return ctx.prisma.note.update({
                where: { id, userId: ctx.userId },
                data,
            });
        }),

    pin: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            return ctx.prisma.note.update({
                where: { id: input.id, userId: ctx.userId },
                data: { pinned: true },
            });
        }),

    unpin: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            return ctx.prisma.note.update({
                where: { id: input.id, userId: ctx.userId },
                data: { pinned: false },
            });
        }),

    softDelete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            return ctx.prisma.note.update({
                where: { id: input.id, userId: ctx.userId },
                data: { deletedAt: new Date(), pinned: false },
            });
        }),

    restore: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            return ctx.prisma.note.update({
                where: { id: input.id, userId: ctx.userId },
                data: { deletedAt: null },
            });
        }),

    hardDelete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            return ctx.prisma.note.delete({
                where: { id: input.id, userId: ctx.userId },
            });
        }),

    reorder: protectedProcedure
        .input(
            z.object({
                items: z.array(
                    z.object({
                        id: z.string(),
                        position: z.number(),
                        pinned: z.boolean().optional(),
                    })
                ),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const ops = input.items.map((item) => {
                const data: Prisma.NoteUpdateInput = { position: item.position };
                if (item.pinned !== undefined) {
                    data.pinned = item.pinned;
                }
                return ctx.prisma.note.update({
                    where: { id: item.id, userId: ctx.userId },
                    data,
                });
            });
            await ctx.prisma.$transaction(ops);
        }),
});
