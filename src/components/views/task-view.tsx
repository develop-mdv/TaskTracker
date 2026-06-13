"use client";

import { useState, type ComponentProps } from "react";
import { trpc } from "@/lib/trpc";
import { ListView } from "./list-view";
import { KanbanBoard } from "./kanban-board";
import { CreateTaskModal } from "../task/create-task-modal";
import { ManageSectionsModal } from "../projects/manage-sections-modal";

type ProjectWithSections = {
    sections?: ComponentProps<typeof ListView>["projectSections"];
};

interface TaskViewProps {
    section?: string;
    projectId?: string;
    title: string;
    today?: boolean;
    archived?: boolean;
    deleted?: boolean;
    showViewToggle?: boolean;
    hideHeader?: boolean;
}

export function TaskView({
    section,
    projectId,
    title,
    today,
    archived,
    deleted,
    showViewToggle = true,
    hideHeader = false,
}: TaskViewProps) {
    const [showCreate, setShowCreate] = useState(false);
    const [localViewMode, setLocalViewMode] = useState<string | null>(null);

    const { data: viewPref } = trpc.viewPreferences.get.useQuery({
        section: section || undefined,
        projectId: projectId || undefined,
    });

    const utils = trpc.useUtils();

    const setViewPref = trpc.viewPreferences.set.useMutation({
        onSuccess: () => {
            utils.viewPreferences.get.invalidate();
        },
    });

    const serverViewMode = (viewPref as { viewMode: string } | undefined)?.viewMode ?? "list";
    const viewMode = localViewMode ?? serverViewMode;

    const { data: tasks = [], isLoading: tasksLoading } = trpc.tasks.list.useQuery({
        section: section as "inbox" | undefined,
        projectId: projectId || undefined,
        today,
        archived,
        deleted,
    });

    // Always fetch columns so kanban switch is instant
    const { data: columns = [] } = trpc.columns.list.useQuery({
        projectId: projectId || undefined,
        section: section || undefined,
    });

    // Fetch project with sections if we are in a project view
    const { data: project } = trpc.projects.getById.useQuery(
        { id: projectId! },
        { enabled: !!projectId }
    );
    const sections = (project as ProjectWithSections | undefined)?.sections ?? [];
    const listTasks = tasks as ComponentProps<typeof ListView>["tasks"];
    const kanbanTasks = tasks as ComponentProps<typeof KanbanBoard>["tasks"];

    // Manage Sections Modal State
    const [showManageSections, setShowManageSections] = useState(false);

    const handleToggle = (mode: "list" | "kanban") => {
        setLocalViewMode(mode);
        setViewPref.mutate({
            section: section || undefined,
            projectId: projectId || undefined,
            viewMode: mode,
        });
    };

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            {!hideHeader && (
            <div className="flex flex-col items-stretch justify-between gap-3 border-b border-slate-700/50 px-4 py-3 sm:flex-row sm:items-center sm:px-6 sm:py-4">
                <div className="flex min-w-0 items-center gap-3">
                    <h1 className="min-w-0 truncate text-lg font-bold text-white sm:text-xl">{title}</h1>
                    {projectId && !archived && !deleted && (
                        <button
                            onClick={() => setShowManageSections(true)}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-800 hover:text-indigo-400"
                            title="Управление секциями"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                    {showViewToggle && !archived && !deleted && (
                        <div className="grid flex-1 grid-cols-2 rounded-lg bg-slate-800 p-0.5 sm:flex sm:flex-none">
                            <button
                                onClick={() => handleToggle("list")}
                                className={`rounded-md px-3 py-2 text-xs font-medium transition sm:py-1.5 ${viewMode === "list"
                                    ? "bg-indigo-600 text-white"
                                    : "text-slate-400 hover:text-white"
                                    }`}
                            >
                                Список
                            </button>
                            <button
                                onClick={() => handleToggle("kanban")}
                                className={`rounded-md px-3 py-2 text-xs font-medium transition sm:py-1.5 ${viewMode === "kanban"
                                    ? "bg-indigo-600 text-white"
                                    : "text-slate-400 hover:text-white"
                                    }`}
                            >
                                Канбан
                            </button>
                        </div>
                    )}

                    {!archived && !deleted && (
                        <button
                            onClick={() => setShowCreate(true)}
                            className="flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 sm:min-h-0 sm:py-1.5"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Задача
                        </button>
                    )}
                </div>
            </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-auto p-4 sm:p-6">
                {tasksLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
                    </div>
                ) : viewMode === "kanban" && !archived && !deleted ? (
                    <KanbanBoard
                        columns={columns}
                        tasks={kanbanTasks}
                        projectId={projectId}
                        section={section}
                        projectSections={sections}
                    />
                ) : (
                    <ListView
                        tasks={listTasks}
                        projectSections={sections}
                    />
                )}
            </div>

            {showCreate && (
                <CreateTaskModal
                    onClose={() => setShowCreate(false)}
                    defaultSection={section || null}
                    defaultProjectId={projectId || null}
                />
            )}

            {showManageSections && projectId && (
                <ManageSectionsModal
                    projectId={projectId}
                    onClose={() => setShowManageSections(false)}
                />
            )}
        </div>
    );
}
