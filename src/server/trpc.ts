import { initTRPC, TRPCError } from "@trpc/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeTimeZone, DEFAULT_TIMEZONE } from "@/lib/timezone";
import superjson from "superjson";
import { ZodError } from "zod";

export const createTRPCContext = async () => {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id: string } | undefined)?.id ?? null;
    const user = userId
        ? await prisma.user.findUnique({
            where: { id: userId },
            select: { timezone: true },
        })
        : null;

    return {
        prisma,
        session,
        userId,
        userTimezone: normalizeTimeZone(user?.timezone ?? DEFAULT_TIMEZONE),
    };
};

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<TRPCContext>().create({
    transformer: superjson,
    errorFormatter({ shape, error }) {
        return {
            ...shape,
            data: {
                ...shape.data,
                zodError:
                    error.cause instanceof ZodError ? error.cause.flatten() : null,
            },
        };
    },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const isAuthed = t.middleware(({ ctx, next }) => {
    if (!ctx.userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return next({
        ctx: {
            ...ctx,
            userId: ctx.userId,
            userTimezone: ctx.userTimezone,
        },
    });
});

export const protectedProcedure = t.procedure.use(isAuthed);
