import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { normalizeTimeZone } from "@/lib/timezone";

export const usersRouter = router({
    settings: protectedProcedure.query(async ({ ctx }) => {
        return ctx.prisma.user.findUniqueOrThrow({
            where: { id: ctx.userId },
            select: {
                id: true,
                email: true,
                name: true,
                timezone: true,
            },
        });
    }),

    syncTimezone: protectedProcedure
        .input(
            z.object({
                timezone: z.string().min(1).max(100),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const timezone = normalizeTimeZone(input.timezone);

            if (timezone !== ctx.userTimezone) {
                await ctx.prisma.user.update({
                    where: { id: ctx.userId },
                    data: { timezone },
                });
            }

            return { timezone };
        }),
});
