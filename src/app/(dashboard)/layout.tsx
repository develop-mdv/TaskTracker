"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { SidebarProvider, useSidebar } from "@/components/layout/sidebar-context";

function DashboardContent({ children }: { children: React.ReactNode }) {
    const { collapsed } = useSidebar();

    return (
        <div className="min-h-dvh bg-slate-950">
            <Sidebar />
            <main className={`dashboard-main h-dvh min-w-0 overflow-hidden pt-14 pb-20 transition-[margin] duration-300 md:pb-0 md:pt-0 ${collapsed ? "md:ml-16" : "md:ml-64"}`}>
                {children}
            </main>
        </div>
    );
}

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <SidebarProvider>
            <DashboardContent>{children}</DashboardContent>
        </SidebarProvider>
    );
}
