"use client";

import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { trpc } from "@/lib/trpc";
import { useState, type FormEvent } from "react";
import { CreateProjectModal } from "./create-project-modal";
import { ProjectSettingsModal } from "./project-settings-modal";
import { useSidebar } from "./sidebar-context";
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
        id: "recurrence",
        label: "Регулярные",
        href: "/recurrence",
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
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

const SEARCH_SECTION = {
    id: "search",
    label: "Поиск",
    href: "/search",
    icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-5.2-5.2m1.7-4.3a6 6 0 11-12 0 6 6 0 0112 0z" />
        </svg>
    ),
};

const MOBILE_NAV = [SECTIONS[0], SECTIONS[1], SEARCH_SECTION, SECTIONS[2]];

// Sortable project item
function SortableProjectItem({
    project,
    isActive,
    collapsed,
    onNavigate,
    onSettings,
}: {
    project: { id: string; name: string; color: string; _count?: { tasks: number } };
    isActive: boolean;
    collapsed: boolean;
    onNavigate: () => void;
    onSettings: () => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: project.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group flex items-center w-full rounded-lg transition-colors ${isActive
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
        >
            {/* Drag handle */}
            {!collapsed && (
                <button
                    {...attributes}
                    {...listeners}
                    className="p-1 ml-1 cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 opacity-0 group-hover:opacity-100 transition touch-none"
                    tabIndex={-1}
                >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 6a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm0 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm0 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm8-16a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm0 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm0 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" />
                    </svg>
                </button>
            )}

            <button
                onClick={onNavigate}
                className={`flex-1 flex items-center gap-3 px-3 py-2 text-sm ${collapsed ? "justify-center" : ""}`}
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
                            {project._count?.tasks ?? 0}
                        </span>
                    </>
                )}
            </button>

            {!collapsed && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onSettings();
                    }}
                    className="p-2 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-indigo-400 transition"
                    title="Настройки"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </button>
            )}
        </div>
    );
}

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [showCreateProject, setShowCreateProject] = useState(false);
    const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
    const [showCompleted, setShowCompleted] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const { collapsed, toggle } = useSidebar();

    const { data: projects } = trpc.projects.list.useQuery();
    const { data: completedProjects } = trpc.projects.listCompleted.useQuery();
    const reorderProjects = trpc.projects.reorder.useMutation();
    const utils = trpc.useUtils();

    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over || active.id === over.id || !projects) return;

        const oldIndex = projects.findIndex((p) => p.id === active.id);
        const newIndex = projects.findIndex((p) => p.id === over.id);

        if (oldIndex === -1 || newIndex === -1) return;

        // Optimistically reorder
        const reordered = [...projects];
        const [moved] = reordered.splice(oldIndex, 1);
        reordered.splice(newIndex, 0, moved);

        // Calculate new positions
        const items = reordered.map((p, i) => ({ id: p.id, position: i }));

        // Optimistic update
        utils.projects.list.setData(undefined, reordered.map((p, i) => ({ ...p, position: i })));

        reorderProjects.mutate(
            { items },
            {
                onError: () => {
                    // Revert on error
                    utils.projects.list.invalidate();
                },
            }
        );
    };

    const activeProject = activeId ? projects?.find((p) => p.id === activeId) : null;

    const navigate = (href: string) => {
        router.push(href);
        setMobileOpen(false);
    };

    const handleSearchSubmit = (event: FormEvent) => {
        event.preventDefault();
        const query = searchQuery.trim();
        navigate(query ? `/search?q=${encodeURIComponent(query)}` : "/search");
    };

    return (
        <>
            <aside
                className={`fixed left-0 top-0 z-40 hidden h-full flex-col border-r border-slate-700/50 bg-slate-900 transition-all duration-300 md:flex ${collapsed ? "w-16" : "w-64"
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

                <div className="border-b border-slate-700/50 p-3">
                    {collapsed ? (
                        <button
                            onClick={() => router.push("/search")}
                            className="flex w-full items-center justify-center rounded-lg p-2 text-slate-500 transition hover:bg-slate-800 hover:text-indigo-400"
                            title="Поиск"
                        >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-5.2-5.2m1.7-4.3a6 6 0 11-12 0 6 6 0 0112 0z" />
                            </svg>
                        </button>
                    ) : (
                        <form onSubmit={handleSearchSubmit} className="relative">
                            <svg
                                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-5.2-5.2m1.7-4.3a6 6 0 11-12 0 6 6 0 0112 0z" />
                            </svg>
                            <input
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder="Поиск"
                                className="w-full rounded-lg border border-slate-800 bg-slate-950/70 py-2 pl-9 pr-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/15"
                            />
                        </form>
                    )}
                </div>

                {/* Sections */}
                <nav className="flex-1 overflow-y-auto py-3">
                    <div className="px-3 space-y-0.5">
                        {SECTIONS.map((section) => {
                            const isActive = pathname === section.href || pathname?.startsWith(section.href + "/");
                            return (
                                <button
                                    key={section.id}
                                    onClick={() => navigate(section.href)}
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

                        {projects && projects.length > 0 ? (
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragStart={handleDragStart}
                                onDragEnd={handleDragEnd}
                            >
                                <SortableContext
                                    items={projects.map((p) => p.id)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    <div className="space-y-0.5">
                                        {projects.map((project) => (
                                            <SortableProjectItem
                                                key={project.id}
                                                project={project}
                                                isActive={pathname === `/project/${project.id}`}
                                                collapsed={collapsed}
                                                onNavigate={() => navigate(`/project/${project.id}`)}
                                                onSettings={() => setEditingProjectId(project.id)}
                                            />
                                        ))}
                                    </div>
                                </SortableContext>

                                {/* Drag overlay */}
                                <DragOverlay>
                                    {activeProject ? (
                                        <div className="flex items-center gap-3 px-3 py-2 bg-slate-800 border border-indigo-500/30 rounded-lg shadow-2xl text-sm text-white">
                                            <div
                                                className="w-3 h-3 rounded-sm flex-shrink-0"
                                                style={{ backgroundColor: activeProject.color }}
                                            />
                                            <span className="truncate">{activeProject.name}</span>
                                        </div>
                                    ) : null}
                                </DragOverlay>
                            </DndContext>
                        ) : (
                            <div className="space-y-0.5" />
                        )}

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

                        {/* Completed projects */}
                        {!collapsed && completedProjects && completedProjects.length > 0 && (
                            <div className="mt-4">
                                <button
                                    onClick={() => setShowCompleted(!showCompleted)}
                                    className="flex items-center gap-2 px-3 mb-1 w-full text-xs font-semibold text-slate-600 uppercase tracking-wider hover:text-slate-400 transition"
                                >
                                    <svg
                                        className={`w-3 h-3 transition-transform ${showCompleted ? "rotate-90" : ""}`}
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                    Завершённые ({completedProjects.length})
                                </button>

                                {showCompleted && (
                                    <div className="space-y-0.5">
                                        {completedProjects.map((project) => {
                                            const isActive = pathname === `/project/${project.id}`;
                                            return (
                                                <div
                                                    key={project.id}
                                                    className={`group flex items-center w-full rounded-lg transition-colors opacity-60 ${isActive
                                                        ? "bg-slate-800 text-white"
                                                        : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                                                        }`}
                                                >
                                                    <button
                                                        onClick={() => navigate(`/project/${project.id}`)}
                                                        className="flex-1 flex items-center gap-3 px-3 py-2 text-sm"
                                                    >
                                                        <div className="relative">
                                                            <div
                                                                className="w-3 h-3 rounded-sm flex-shrink-0"
                                                                style={{ backgroundColor: project.color }}
                                                            />
                                                            <span className="absolute -top-0.5 -right-0.5 text-[8px] text-green-400">✓</span>
                                                        </div>
                                                        <span className="truncate flex-1 text-left line-through">{project.name}</span>
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setEditingProjectId(project.id);
                                                        }}
                                                        className="p-2 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-indigo-400 transition"
                                                        title="Настройки"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
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

            <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-slate-800/80 bg-slate-950/95 px-3 backdrop-blur md:hidden">
                <button
                    onClick={() => navigate("/inbox")}
                    className="flex min-w-0 items-center gap-2 rounded-xl px-2 py-1.5 text-left transition active:bg-slate-900"
                >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-indigo-400/20 bg-indigo-500/15 text-sm font-bold text-indigo-200">
                        T
                    </span>
                    <span className="min-w-0">
                        <span className="block truncate text-sm font-bold leading-4 text-white">TaskTracker</span>
                        <span className="block truncate text-[11px] leading-4 text-slate-500">задачи и заметки</span>
                    </span>
                </button>

                <div className="flex items-center gap-1">
                    <button
                        onClick={() => navigate("/search")}
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-900 hover:text-indigo-300 active:bg-slate-800"
                        aria-label="Открыть поиск"
                    >
                        {SEARCH_SECTION.icon}
                    </button>
                    <button
                        onClick={() => setMobileOpen(true)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 transition hover:bg-slate-900 hover:text-white active:bg-slate-800"
                        aria-label="Открыть меню"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                </div>
            </header>

            <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800/90 bg-slate-950/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur md:hidden">
                <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
                    {MOBILE_NAV.map((section) => {
                        const isActive = pathname === section.href || pathname?.startsWith(section.href + "/");
                        return (
                            <button
                                key={section.id}
                                onClick={() => navigate(section.href)}
                                className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] font-semibold transition ${isActive
                                    ? "bg-indigo-500/15 text-indigo-300"
                                    : "text-slate-500 hover:bg-slate-900 hover:text-slate-200"
                                    }`}
                            >
                                {section.icon}
                                <span className="max-w-full truncate">{section.label}</span>
                            </button>
                        );
                    })}

                    <button
                        onClick={() => setMobileOpen(true)}
                        className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] font-semibold transition ${mobileOpen
                            ? "bg-indigo-500/15 text-indigo-300"
                            : "text-slate-500 hover:bg-slate-900 hover:text-slate-200"
                            }`}
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 7h16M4 12h16M4 17h16" />
                        </svg>
                        <span>Ещё</span>
                    </button>
                </div>
            </nav>

            {mobileOpen && (
                <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)}>
                    <div
                        className="flex h-full w-[min(88vw,22rem)] flex-col border-r border-slate-700/60 bg-slate-900 shadow-2xl shadow-black/50"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-slate-700/50 px-4 py-3">
                            <div>
                                <div className="text-base font-bold text-white">Меню</div>
                                <div className="text-xs text-slate-500">Разделы и проекты</div>
                            </div>
                            <button
                                onClick={() => setMobileOpen(false)}
                                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-800 hover:text-white"
                                aria-label="Закрыть меню"
                            >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="border-b border-slate-700/50 p-3">
                            <form onSubmit={handleSearchSubmit} className="relative">
                                <svg
                                    className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-5.2-5.2m1.7-4.3a6 6 0 11-12 0 6 6 0 0112 0z" />
                                </svg>
                                <input
                                    value={searchQuery}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                    placeholder="Поиск"
                                    className="w-full rounded-xl border border-slate-800 bg-slate-950/70 py-3 pl-9 pr-3 text-base text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/15"
                                />
                            </form>
                        </div>

                        <div className="flex-1 overflow-y-auto px-3 py-4">
                            <div className="space-y-1">
                                {[...SECTIONS, SEARCH_SECTION].map((section) => {
                                    const isActive = pathname === section.href || pathname?.startsWith(section.href + "/");
                                    return (
                                        <button
                                            key={section.id}
                                            onClick={() => navigate(section.href)}
                                            className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${isActive
                                                ? "border border-indigo-500/20 bg-indigo-600/20 text-indigo-300"
                                                : "text-slate-400 hover:bg-slate-800 hover:text-white"
                                                }`}
                                        >
                                            {section.icon}
                                            <span>{section.label}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="mt-6">
                                <div className="mb-2 flex items-center justify-between px-3">
                                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                        Проекты
                                    </span>
                                    <button
                                        onClick={() => {
                                            setMobileOpen(false);
                                            setShowCreateProject(true);
                                        }}
                                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-800 hover:text-indigo-300"
                                        aria-label="Создать проект"
                                    >
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                    </button>
                                </div>

                                <div className="space-y-1">
                                    {projects?.map((project) => {
                                        const isActive = pathname === `/project/${project.id}`;
                                        return (
                                            <div
                                                key={project.id}
                                                className={`flex min-h-11 items-center rounded-xl transition ${isActive
                                                    ? "bg-slate-800 text-white"
                                                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                                                    }`}
                                            >
                                                <button
                                                    onClick={() => navigate(`/project/${project.id}`)}
                                                    className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-sm"
                                                >
                                                    <span
                                                        className="h-3 w-3 flex-shrink-0 rounded-sm"
                                                        style={{ backgroundColor: project.color }}
                                                    />
                                                    <span className="min-w-0 flex-1 truncate text-left">{project.name}</span>
                                                    <span className="text-xs text-slate-600">
                                                        {project._count?.tasks ?? 0}
                                                    </span>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setMobileOpen(false);
                                                        setEditingProjectId(project.id);
                                                    }}
                                                    className="mr-1 flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-700 hover:text-indigo-300"
                                                    aria-label={`Настройки проекта ${project.name}`}
                                                >
                                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    </svg>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>

                                {completedProjects && completedProjects.length > 0 && (
                                    <div className="mt-4">
                                        <button
                                            onClick={() => setShowCompleted(!showCompleted)}
                                            className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-xs font-semibold uppercase tracking-wider text-slate-600 transition hover:bg-slate-800 hover:text-slate-400"
                                        >
                                            <svg
                                                className={`h-3 w-3 transition-transform ${showCompleted ? "rotate-90" : ""}`}
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                            Завершённые ({completedProjects.length})
                                        </button>

                                        {showCompleted && (
                                            <div className="mt-1 space-y-1">
                                                {completedProjects.map((project) => (
                                                    <button
                                                        key={project.id}
                                                        onClick={() => navigate(`/project/${project.id}`)}
                                                        className="flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-sm text-slate-500 opacity-75 transition hover:bg-slate-800 hover:text-slate-300"
                                                    >
                                                        <span className="relative">
                                                            <span
                                                                className="block h-3 w-3 rounded-sm"
                                                                style={{ backgroundColor: project.color }}
                                                            />
                                                            <span className="absolute -right-1 -top-1 text-[8px] text-green-400">✓</span>
                                                        </span>
                                                        <span className="min-w-0 flex-1 truncate text-left line-through">{project.name}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="border-t border-slate-700/50 p-3">
                            <button
                                onClick={() => signOut({ callbackUrl: "/login" })}
                                className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm text-slate-400 transition hover:bg-slate-800 hover:text-red-300"
                            >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                Выйти
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showCreateProject && (
                <CreateProjectModal onClose={() => setShowCreateProject(false)} />
            )}

            {editingProjectId && (
                <ProjectSettingsModal
                    projectId={editingProjectId}
                    onClose={() => setEditingProjectId(null)}
                />
            )}
        </>
    );
}
