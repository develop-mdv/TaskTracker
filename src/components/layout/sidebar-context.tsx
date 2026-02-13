"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

interface SidebarContextValue {
    collapsed: boolean;
    toggle: () => void;
}

const SidebarContext = createContext<SidebarContextValue>({
    collapsed: false,
    toggle: () => { },
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
    const [collapsed, setCollapsed] = useState(false);
    const toggle = useCallback(() => setCollapsed((v) => !v), []);

    return (
        <SidebarContext.Provider value={{ collapsed, toggle }}>
            {children}
        </SidebarContext.Provider>
    );
}

export function useSidebar() {
    return useContext(SidebarContext);
}
