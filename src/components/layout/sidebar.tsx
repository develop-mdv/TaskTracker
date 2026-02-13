"use client";

import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { CreateProjectModal } from "./create-project-modal";
import { useSidebar } from "./sidebar-context";

const SECTIONS = [
    {
        id: "inbox",
        label: "Входящие",
        href: "/inbox",
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-2.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
        ),
    },
    {
        id: "today",
        label: "Сегодня",
        href: "/today",
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
        ),
    },
    {
        id: "calendar",
        label: "Календарь",
        href: "/calendar",
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
        ),
    },
    {
        id: "stats",
        label: "Статистика",
        href: "/stats",
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
        ),
    },
    {
        id: "archive",
        label: "Архив",
        href: "/archive",
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
        ),
    },
    {
        id: "trash",
        label: "Корзина",
        href: "/trash",
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
        ),
    },
];

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [showCreateProject, setShowCreateProject] = useState(false);
    const { collapsed, toggle } = useSidebar();

    const { data: projects } = trpc.projects.list.useQuery();

    return (
        <>
            <aside
                className={`fixed left-0 top-0 h-full bg-slate-900 border-r border-slate-700/50 flex flex-col transition-all duration-300 z-40 ${collapsed ? "w-16" : "w-64"
                    }`}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
                    {!collapsed && (
                        <h1 className="text-lg font-bold text-white flex items-center gap-2">
                            <span className="text-indigo-400">⬡</span> TaskTracker
                        </h1>
                    )}
                    <button
                        onClick={toggle}
                        className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            {collapsed ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                            )}
                        </svg>
                    </button>
                </div>

                {/* Sections */}
                <nav className="flex-1 overflow-y-auto py-3">
                    <div className="px-3 space-y-0.5">
                        {SECTIONS.map((section) => {
                            const isActive = pathname === section.href || pathname?.startsWith(section.href + "/");
                            return (
                                <button
                                    key={section.id}
                                    onClick={() => router.push(section.href)}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                                        ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/20"
                                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                                        } ${collapsed ? "justify-center" : ""}`}
                                    title={collapsed ? section.label : undefined}
                                >
                                    {section.icon}
                                    {!collapsed && <span>{section.label}</span>}
                                </button>
                            );
                        })}
                    </div>

                    {/* Projects */}
                    <div className="mt-6 px-3">
                        {!collapsed && (
                            <div className="flex items-center justify-between mb-2 px-3">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    Проекты
                                </span>
                                <button
                                    onClick={() => setShowCreateProject(true)}
                                    className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-indigo-400 transition"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                </button>
                            </div>
                        )}

                        <div className="space-y-0.5">
                            {projects?.map((project) => {
                                const isActive = pathname === `/project/${project.id}`;
                                return (
                                    <button
                                        key={project.id}
                                        onClick={() => router.push(`/project/${project.id}`)}
                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive
                                            ? "bg-slate-800 text-white"
                                            : "text-slate-400 hover:text-white hover:bg-slate-800"
                                            } ${collapsed ? "justify-center" : ""}`}
                                        title={collapsed ? project.name : undefined}
                                    >
                                        <div
                                            className="w-3 h-3 rounded-sm flex-shrink-0"
                                            style={{ backgroundColor: project.color }}
                                        />
                                        {!collapsed && (
                                            <>
                                                <span className="truncate flex-1 text-left">{project.name}</span>
                                                <span className="text-xs text-slate-600">
                                                    {(project as any)._count?.tasks ?? 0}
                                                </span>
                                            </>
                                        )}
                                    </button>
                                );
                            })}

                            {collapsed && (
                                <button
                                    onClick={() => setShowCreateProject(true)}
                                    className="w-full flex items-center justify-center p-2 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-slate-800 transition"
                                    title="Создать проект"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>
                </nav>

                {/* Footer */}
                <div className="p-3 border-t border-slate-700/50">
                    <button
                        onClick={() => signOut({ callbackUrl: "/login" })}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-slate-800 transition ${collapsed ? "justify-center" : ""
                            }`}
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        {!collapsed && <span>Выйти</span>}
                    </button>
                </div>
            </aside>

            {showCreateProject && (
                <CreateProjectModal onClose={() => setShowCreateProject(false)} />
            )}
        </>
    );
}
