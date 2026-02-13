"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { SidebarProvider, useSidebar } from "@/components/layout/sidebar-context";

function DashboardContent({ children }: { children: React.ReactNode }) {
    const { collapsed } = useSidebar();

    return (
        <div className="min-h-screen bg-slate-950">
            <Sidebar />
            <main className={`h-screen transition-all duration-300 ${collapsed ? "ml-16" : "ml-64"}`}>
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
