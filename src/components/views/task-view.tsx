"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { ListView } from "./list-view";
import { KanbanBoard } from "./kanban-board";
import { CreateTaskModal } from "../task/create-task-modal";

interface TaskViewProps {
    section?: string;
    projectId?: string;
    title: string;
    today?: boolean;
    archived?: boolean;
    deleted?: boolean;
    showViewToggle?: boolean;
}

export function TaskView({
    section,
    projectId,
    title,
    today,
    archived,
    deleted,
    showViewToggle = true,
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

    // Sync local state when server data arrives
    const serverViewMode = (viewPref as { viewMode: string } | undefined)?.viewMode ?? "list";
    useEffect(() => {
        setLocalViewMode(null);
    }, [serverViewMode]);

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
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
                <h1 className="text-xl font-bold text-white">{title}</h1>

                <div className="flex items-center gap-3">
                    {showViewToggle && !archived && !deleted && (
                        <div className="flex bg-slate-800 rounded-lg p-0.5">
                            <button
                                onClick={() => handleToggle("list")}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${viewMode === "list"
                                    ? "bg-indigo-600 text-white"
                                    : "text-slate-400 hover:text-white"
                                    }`}
                            >
                                Список
                            </button>
                            <button
                                onClick={() => handleToggle("kanban")}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${viewMode === "kanban"
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
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg font-medium transition"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Задача
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
                {tasksLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
                    </div>
                ) : viewMode === "kanban" && !archived && !deleted ? (
                    <KanbanBoard
                        columns={columns}
                        tasks={tasks as any}
                        projectId={projectId}
                        section={section}
                    />
                ) : (
                    <ListView tasks={tasks as any} />
                )}
            </div>

            {showCreate && (
                <CreateTaskModal
                    onClose={() => setShowCreate(false)}
                    defaultSection={section || null}
                    defaultProjectId={projectId || null}
                />
            )}
        </div>
    );
}
