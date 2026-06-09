"use client";

import { SessionProvider } from "next-auth/react";
import { TRPCProvider } from "./trpc-provider";
import { TimezoneSync } from "./timezone-sync";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <TRPCProvider>
                <TimezoneSync />
                {children}
            </TRPCProvider>
        </SessionProvider>
    );
}
