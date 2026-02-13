"use client";

import { memo } from "react";
import { trpc } from "@/lib/trpc";

interface Task {
    id: string;
    title: string;
    description?: string | null;
    priority: number;
    tags: string[];
    dueDate?: string | Date | null;
    startDate?: string | Date | null;
    endDate?: string | Date | null;
    completedAt?: string | Date | null;
    deletedAt?: string | Date | null;
    section?: string | null;
    projectId?: string | null;
    boardColumnId?: string | null;
    project?: { id: string; name: string; color: string } | null;
    boardColumn?: { id: string; name: string; color?: string | null } | null;
    attachments?: { id: string; filename: string; mimeType?: string | null; size?: number | null }[];
    _count?: { attachments: number };
}

const PRIORITIES = [
    { value: 0, label: "—", color: "text-slate-600", bg: "" },
    { value: 1, label: "!", color: "text-blue-400", bg: "bg-blue-500/10" },
    { value: 2, label: "!!", color: "text-yellow-400", bg: "bg-yellow-500/10" },
    { value: 3, label: "!!!", color: "text-orange-400", bg: "bg-orange-500/10" },
    { value: 4, label: "🔥", color: "text-red-400", bg: "bg-red-500/10" },
];

export const TaskCard = memo(function TaskCard({
    task,
    onClick,
    isDragging,
}: {
    task: Task;
    onClick?: () => void;
    isDragging?: boolean;
}) {
    const utils = trpc.useUtils();

    const completeMut = trpc.tasks.complete.useMutation({
        onSuccess: () => utils.tasks.list.invalidate(),
    });
    const uncompleteMut = trpc.tasks.uncomplete.useMutation({
        onSuccess: () => utils.tasks.list.invalidate(),
    });

    const isCompleted = !!task.completedAt;
    const isDeleted = !!task.deletedAt;
    const p = PRIORITIES[task.priority] || PRIORITIES[0];

    const formatDate = (d: string | Date | null | undefined) => {
        if (!d) return null;
        const date = new Date(d);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateOnly = new Date(date);
        dateOnly.setHours(0, 0, 0, 0);

        if (dateOnly.getTime() === today.getTime()) return "Сегодня";
        if (dateOnly.getTime() === tomorrow.getTime()) return "Завтра";

        return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
    };

    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !isCompleted;

    return (
        <div
            className={`group bg-slate-800/50 border border-slate-700/30 rounded-lg p-3 hover:border-slate-600/50 transition-all cursor-pointer ${isDragging ? "opacity-50 shadow-2xl rotate-2 scale-105" : ""
                } ${isCompleted ? "opacity-60" : ""}`}
            onClick={onClick}
        >
            <div className="flex items-start gap-3">
                {/* Checkbox */}
                {!isDeleted && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (isCompleted) {
                                uncompleteMut.mutate({ id: task.id });
                            } else {
                                completeMut.mutate({ id: task.id });
                            }
                        }}
                        className={`mt-0.5 w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition ${isCompleted
                            ? "border-green-500 bg-green-500/20 text-green-400"
                            : "border-slate-600 hover:border-indigo-500"
                            }`}
                    >
                        {isCompleted && (
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        )}
                    </button>
                )}

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${isCompleted ? "line-through text-slate-500" : "text-white"}`}>
                            {task.title}
                        </span>
                        {task.priority > 0 && (
                            <span className={`text-xs px-1.5 py-0.5 rounded ${p.bg} ${p.color}`}>
                                {p.label}
                            </span>
                        )}
                    </div>

                    {task.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                            {task.description}
                        </p>
                    )}

                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {task.dueDate && (
                            <span
                                className={`text-xs px-2 py-0.5 rounded-full ${isOverdue
                                    ? "bg-red-500/10 text-red-400"
                                    : "bg-slate-700/50 text-slate-400"
                                    }`}
                            >
                                {formatDate(task.dueDate)}
                            </span>
                        )}

                        {task.project && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700/50 flex items-center gap-1">
                                <span
                                    className="w-2 h-2 rounded-sm"
                                    style={{ backgroundColor: task.project.color }}
                                />
                                <span className="text-slate-400">{task.project.name}</span>
                            </span>
                        )}

                        {task.boardColumn && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400">
                                {task.boardColumn.name}
                            </span>
                        )}

                        {(task._count?.attachments ?? 0) > 0 && (
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                </svg>
                                {task._count?.attachments}
                            </span>
                        )}

                        {task.tags?.length > 0 && task.tags.map((tag) => (
                            <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400">
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
});
