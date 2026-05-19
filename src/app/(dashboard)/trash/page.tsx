"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { TaskDetailDrawer } from "@/components/task/task-detail-drawer";
import { ProjectRetentionList } from "@/components/views/project-retention-list";

type TrashTab = "tasks" | "projects";

interface TrashedTask {
    id: string;
    title: string;
    deletedAt?: string | Date | null;
}

function TabButton({
    active,
    label,
    count,
    onClick,
}: {
    active: boolean;
    label: string;
    count: number;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${active
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                : "text-slate-400 hover:bg-slate-700/60 hover:text-white"
                }`}
        >
            <span>{label}</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-white/15 text-white" : "bg-slate-700 text-slate-400"}`}>
                {count}
            </span>
        </button>
    );
}

export default function TrashPage() {
    const [activeTab, setActiveTab] = useState<TrashTab>("tasks");
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const utils = trpc.useUtils();

    const { data: tasks = [], isLoading } = trpc.tasks.list.useQuery({ deleted: true });
    const { data: projects = [] } = trpc.projects.listDeleted.useQuery();

    const restoreMut = trpc.tasks.restore.useMutation({
        onSuccess: () => utils.tasks.list.invalidate(),
    });
    const hardDeleteMut = trpc.tasks.hardDelete.useMutation({
        onSuccess: () => utils.tasks.list.invalidate(),
    });

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between gap-4 border-b border-slate-700/50 px-6 py-4">
                <div>
                    <h1 className="text-xl font-bold text-white">Корзина</h1>
                    <p className="mt-1 text-xs text-slate-500">Автоочистка удаляет элементы старше 7 дней</p>
                </div>

                <div className="flex rounded-xl bg-slate-800/80 p-1">
                    <TabButton
                        active={activeTab === "tasks"}
                        label="Задачи"
                        count={tasks.length}
                        onClick={() => setActiveTab("tasks")}
                    />
                    <TabButton
                        active={activeTab === "projects"}
                        label="Проекты"
                        count={projects.length}
                        onClick={() => setActiveTab("projects")}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
                {activeTab === "projects" ? (
                    <ProjectRetentionList mode="trash" />
                ) : isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                    </div>
                ) : tasks.length === 0 ? (
                    <div className="py-12 text-center text-slate-600">
                        <svg className="mx-auto mb-4 h-16 w-16 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <p>В корзине нет задач</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {(tasks as TrashedTask[]).map((task) => (
                            <div
                                key={task.id}
                                className="group rounded-lg border border-slate-700/30 bg-slate-800/50 p-3 transition hover:border-slate-600/60"
                            >
                                <div className="flex items-center justify-between gap-4">
                                    <button
                                        onClick={() => setSelectedTaskId(task.id)}
                                        className="min-w-0 flex-1 text-left"
                                    >
                                        <span className="block truncate text-sm text-slate-300">{task.title}</span>
                                        {task.deletedAt && (
                                            <span className="mt-1 block text-xs text-slate-600">
                                                Удалено: {new Date(task.deletedAt).toLocaleDateString("ru-RU")}
                                            </span>
                                        )}
                                    </button>
                                    <div className="flex flex-shrink-0 items-center gap-2 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                                        <button
                                            onClick={() => restoreMut.mutate({ id: task.id })}
                                            disabled={restoreMut.isPending}
                                            className="rounded-lg bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-300 transition hover:bg-indigo-500/20 disabled:opacity-50"
                                        >
                                            Восстановить
                                        </button>
                                        <button
                                            onClick={() => hardDeleteMut.mutate({ id: task.id })}
                                            disabled={hardDeleteMut.isPending}
                                            className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                                        >
                                            Удалить навсегда
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {selectedTaskId && (
                <TaskDetailDrawer
                    taskId={selectedTaskId}
                    onClose={() => setSelectedTaskId(null)}
                />
            )}
        </div>
    );
}
