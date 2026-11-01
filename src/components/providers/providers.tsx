"use client";

import { SessionProvider } from "next-auth/react";
import { TRPCProvider } from "./trpc-provider";
import { TimezoneSync } from "./timezone-sync";
import { MobileViewport } from "./mobile-viewport";
import { PwaProvider } from "@/components/pwa/pwa-provider";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <TRPCProvider>
                <MobileViewport />
                <TimezoneSync />
                <PwaProvider>{children}</PwaProvider>
            </TRPCProvider>
        </SessionProvider>
    );
}
