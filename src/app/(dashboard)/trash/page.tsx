"use client";

import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { TaskDetailDrawer } from "@/components/task/task-detail-drawer";

export default function TrashPage() {
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const utils = trpc.useUtils();

    const { data: tasks = [], isLoading } = trpc.tasks.list.useQuery({ deleted: true });

    const restoreMut = trpc.tasks.restore.useMutation({
        onSuccess: () => utils.tasks.list.invalidate(),
    });
    const hardDeleteMut = trpc.tasks.hardDelete.useMutation({
        onSuccess: () => utils.tasks.list.invalidate(),
    });

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
                <h1 className="text-xl font-bold text-white">Корзина</h1>
                <p className="text-xs text-slate-500">
                    Автоочистка: задачи старше 7 дней удаляются навсегда
                </p>
            </div>

            <div className="flex-1 overflow-auto p-6">
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
                    </div>
                ) : tasks.length === 0 ? (
                    <div className="text-center py-12 text-slate-600">
                        <svg className="w-16 h-16 mx-auto mb-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <p>Корзина пуста</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {(tasks as any[]).map((task) => (
                            <div
                                key={task.id}
                                className="bg-slate-800/50 border border-slate-700/30 rounded-lg p-3 flex items-center justify-between group"
                            >
                                <div>
                                    <span className="text-sm text-slate-400">{task.title}</span>
                                    {task.deletedAt && (
                                        <span className="text-xs text-slate-600 ml-3">
                                            Удалено: {new Date(task.deletedAt).toLocaleDateString("ru-RU")}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                                    <button
                                        onClick={() => restoreMut.mutate({ id: task.id })}
                                        className="text-xs px-3 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition"
                                    >
                                        Восстановить
                                    </button>
                                    <button
                                        onClick={() => hardDeleteMut.mutate({ id: task.id })}
                                        className="text-xs px-3 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
                                    >
                                        Удалить навсегда
                                    </button>
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
