import type { Prisma } from "@prisma/client";

export type NoteListInput = {
    projectId?: string | null;
    section?: "inbox";
    includeProjectNotes?: boolean;
};

export function buildNoteListQuery({
    userId,
    input,
}: {
    userId: string;
    input: NoteListInput;
}): {
    where: Prisma.NoteWhereInput;
    orderBy: Prisma.NoteOrderByWithRelationInput | Prisma.NoteOrderByWithRelationInput[];
} {
    const where: Prisma.NoteWhereInput = {
        userId,
        deletedAt: null,
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

    return {
        where,
        orderBy: input.section === "inbox" && input.includeProjectNotes
            ? [{ projectId: "asc" }, { position: "asc" }]
            : { position: "asc" },
    };
}
