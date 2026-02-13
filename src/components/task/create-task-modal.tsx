"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";

const PRIORITIES = [
    { value: 0, label: "Без приоритета", color: "text-slate-500" },
    { value: 1, label: "Низкий", color: "text-blue-400" },
    { value: 2, label: "Средний", color: "text-yellow-400" },
    { value: 3, label: "Высокий", color: "text-orange-400" },
    { value: 4, label: "Срочный", color: "text-red-400" },
];

interface CreateTaskModalProps {
    onClose: () => void;
    defaultSection?: string | null;
    defaultProjectId?: string | null;
    defaultBoardColumnId?: string | null;
    defaultDueDate?: string | null;
}

export function CreateTaskModal({
    onClose,
    defaultSection = "inbox",
    defaultProjectId = null,
    defaultBoardColumnId = null,
    defaultDueDate = null,
}: CreateTaskModalProps) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState(0);
    const [dueDate, setDueDate] = useState(defaultDueDate || "");
    const utils = trpc.useUtils();

    const createTask = trpc.tasks.create.useMutation({
        onSuccess: () => {
            utils.tasks.list.invalidate();
            onClose();
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;

        createTask.mutate({
            title: title.trim(),
            description: description || undefined,
            priority,
            section: defaultProjectId ? undefined : (defaultSection as "inbox" | undefined),
            projectId: defaultProjectId || undefined,
            boardColumnId: defaultBoardColumnId || undefined,
            dueDate: dueDate || undefined,
        });
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="bg-slate-800 border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-lg p-6"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-lg font-semibold text-white mb-4">Новая задача</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            autoFocus
                            className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition text-base"
                            placeholder="Что нужно сделать?"
                        />
                    </div>

                    <div>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition resize-none text-sm"
                            placeholder="Описание (опционально)"
                        />
                    </div>

                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-xs font-medium text-slate-400 mb-1">
                                Приоритет
                            </label>
                            <select
                                value={priority}
                                onChange={(e) => setPriority(Number(e.target.value))}
                                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            >
                                {PRIORITIES.map((p) => (
                                    <option key={p.value} value={p.value}>
                                        {p.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex-1">
                            <label className="block text-xs font-medium text-slate-400 mb-1">
                                Дата
                            </label>
                            <input
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 justify-end pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition"
                        >
                            Отмена
                        </button>
                        <button
                            type="submit"
                            disabled={!title.trim() || createTask.isPending}
                            className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-medium transition"
                        >
                            Создать
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
