import {
    buildGeneratedTaskData,
    getNextOccurrenceToGenerate,
    type RecurrenceScheduleRule,
} from "./recurrence-schedule";

type GeneratedTaskData = ReturnType<typeof buildGeneratedTaskData>;

export type RecurrenceGeneratorPrisma = {
    recurrenceRule: {
        findMany(input: { where: { active: true; userId?: string } }): Promise<RecurrenceScheduleRule[]>;
        update(input: {
            where: { id: string };
            data: { lastGeneratedAt: Date; lastGeneratedFor: Date };
        }): Promise<unknown>;
    };
    task: {
        findFirst(input: {
            where: {
                recurrenceRuleId: string;
                dueDate: Date;
                userId?: string;
            };
        }): Promise<{ createdAt: Date } | null>;
        create(input: { data: GeneratedTaskData }): Promise<unknown>;
    };
};

export async function generateDueRecurringTasks({
    prisma,
    now = new Date(),
    userId,
}: {
    prisma: RecurrenceGeneratorPrisma;
    now?: Date;
    userId?: string;
}): Promise<{ created: number }> {
    const rules = await prisma.recurrenceRule.findMany({
        where: {
            active: true,
            ...(userId ? { userId } : {}),
        },
    });
    let created = 0;

    for (const rule of rules) {
        const occurrence = getNextOccurrenceToGenerate(rule, now);
        if (!occurrence) continue;

        const existing = await prisma.task.findFirst({
            where: {
                recurrenceRuleId: rule.id,
                dueDate: occurrence.dueAt,
                ...(userId ? { userId } : {}),
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

        await prisma.task.create({
            data: buildGeneratedTaskData(rule, occurrence.dueAt),
        });
        await prisma.recurrenceRule.update({
            where: { id: rule.id },
            data: {
                lastGeneratedAt: now,
                lastGeneratedFor: occurrence.dueAt,
            },
        });
        created++;
    }

    return { created };
}
