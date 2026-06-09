"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc";
import { getBrowserTimeZone } from "@/lib/timezone";

export function TimezoneSync() {
    const { status } = useSession();
    const lastSyncedTimezone = useRef<string | null>(null);
    const utils = trpc.useUtils();

    const syncTimezone = trpc.users.syncTimezone.useMutation({
        onSuccess: () => {
            utils.tasks.list.invalidate();
            utils.recurrence.list.invalidate();
            utils.recurrence.planned.invalidate();
        },
    });

    useEffect(() => {
        if (status !== "authenticated") return;

        const timezone = getBrowserTimeZone();
        if (lastSyncedTimezone.current === timezone) return;

        lastSyncedTimezone.current = timezone;
        syncTimezone.mutate({ timezone });
    }, [status, syncTimezone]);

    return null;
}
