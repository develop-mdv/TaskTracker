"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useRouter } from "next/navigation";

const COLORS = [
    "#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#ef4444",
    "#f97316", "#eab308", "#22c55e", "#14b8a6", "#06b6d4",
    "#3b82f6", "#64748b",
];

interface ProjectSettingsModalProps {
    projectId: string;
    onClose: () => void;
}

export function ProjectSettingsModal({ projectId, onClose }: ProjectSettingsModalProps) {
    const router = useRouter();
    const utils = trpc.useUtils();

    // Fetch project details
    const { data: project, isLoading } = trpc.projects.getById.useQuery({ id: projectId });

    const [name, setName] = useState("");
    const [color, setColor] = useState("");
    const [activeTab, setActiveTab] = useState<"general" | "danger">("general");

    // Inputs for confirmation logic
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [hardDeleteMode, setHardDeleteMode] = useState<"TRASH_TASKS" | "DELETE_ALL">("TRASH_TASKS");

    useEffect(() => {
        if (project) {
            setName(project.name);
            setColor(project.color);
        }
    }, [project]);

    const updateProject = trpc.projects.update.useMutation({
        onSuccess: () => {
            utils.projects.list.invalidate();
            utils.projects.getById.invalidate({ id: projectId });
            onClose();
        },
    });

    const softDeleteProject = trpc.projects.softDelete.useMutation({
        onSuccess: () => {
            utils.projects.list.invalidate();
            router.push("/trash"); // or inbox
        },
    });

    const hardDeleteProject = trpc.projects.hardDelete.useMutation({
        onSuccess: () => {
            utils.projects.list.invalidate();
            router.push("/inbox");
        },
    });

    const handleSave = () => {
        if (!name.trim()) return;
        updateProject.mutate({
            id: projectId,
            name: name.trim(),
            color,
        });
    };

    const handleDelete = () => {
        if (hardDeleteMode === "DELETE_ALL") {
            // Maybe add extra confirmation step for permanent delete?
            // For now, let's assume the UI selection is enough warning.
            hardDeleteProject.mutate({ id: projectId, mode: "DELETE_ALL" });
        } else {
            hardDeleteProject.mutate({ id: projectId, mode: "TRASH_TASKS" });
        }
    };

    if (isLoading) return null; // Or spinner

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div
                className="bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                    <h2 className="text-lg font-semibold text-white">Настройки проекта</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-800">
                    <button
                        onClick={() => setActiveTab("general")}
                        className={`flex-1 px-4 py-3 text-sm font-medium transition ${activeTab === "general"
                            ? "text-indigo-400 border-b-2 border-indigo-500 bg-indigo-500/5"
                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                            }`}
                    >
                        Основное
                    </button>
                    <button
                        onClick={() => setActiveTab("danger")}
                        className={`flex-1 px-4 py-3 text-sm font-medium transition ${activeTab === "danger"
                            ? "text-red-400 border-b-2 border-red-500 bg-red-500/5"
                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                            }`}
                    >
                        Опасная зона
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto">
                    {activeTab === "general" ? (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                                    Название
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Цвет иконки
                                </label>
                                <div className="flex gap-2 flex-wrap">
                                    {COLORS.map((c) => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setColor(c)}
                                            className={`w-8 h-8 rounded-lg transition-all ${color === c
                                                ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110"
                                                : "hover:scale-105"
                                                }`}
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl space-y-4">
                                <div>
                                    <h3 className="text-sm font-medium text-red-400">Переместить в корзину</h3>
                                    <p className="text-xs text-slate-400 mt-1">
                                        Проект будет помечен как удаленный. Все задачи временно переместятся в корзину. Вы сможете восстановить проект.
                                    </p>
                                </div>
                                <button
                                    onClick={() => softDeleteProject.mutate({ id: projectId })}
                                    className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium rounded-lg border border-red-500/30 transition w-full text-left flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Переместить в корзину
                                </button>
                            </div>

                            <div className="p-4 bg-slate-800 border border-slate-700/50 rounded-xl space-y-4">
                                <div>
                                    <h3 className="text-sm font-medium text-white">Вечное удаление</h3>
                                    <p className="text-xs text-slate-400 mt-1">
                                        Полное удаление проекта из базы.
                                    </p>
                                </div>

                                {!showDeleteConfirm ? (
                                    <button
                                        onClick={() => setShowDeleteConfirm(true)}
                                        className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition w-full text-left"
                                    >
                                        Удалить проект навсегда...
                                    </button>
                                ) : (
                                    <div className="space-y-3 bg-slate-900/50 p-3 rounded-lg border border-slate-600/30">
                                        <label className="flex items-start gap-3 p-2 cursor-pointer hover:bg-slate-800/50 rounded-lg transition">
                                            <input
                                                type="radio"
                                                name="deleteMode"
                                                checked={hardDeleteMode === "TRASH_TASKS"}
                                                onChange={() => setHardDeleteMode("TRASH_TASKS")}
                                                className="mt-1"
                                            />
                                            <div>
                                                <div className="text-sm text-white font-medium">Сохранить задачи в корзине</div>
                                                <div className="text-xs text-slate-400">Задачи останутся в корзине (без проекта).</div>
                                            </div>
                                        </label>

                                        <label className="flex items-start gap-3 p-2 cursor-pointer hover:bg-slate-800/50 rounded-lg transition">
                                            <input
                                                type="radio"
                                                name="deleteMode"
                                                checked={hardDeleteMode === "DELETE_ALL"}
                                                onChange={() => setHardDeleteMode("DELETE_ALL")}
                                                className="mt-1 text-red-500 focus:ring-red-500"
                                            />
                                            <div>
                                                <div className="text-sm text-red-400 font-medium">Удалить всё</div>
                                                <div className="text-xs text-slate-400">Удалить проект и все его задачи навсегда. Это действие необратимо.</div>
                                            </div>
                                        </label>

                                        <div className="flex gap-2 pt-2">
                                            <button
                                                onClick={() => setShowDeleteConfirm(false)}
                                                className="flex-1 px-3 py-2 text-xs text-slate-400 hover:text-white bg-slate-800 rounded-lg"
                                            >
                                                Отмена
                                            </button>
                                            <button
                                                onClick={handleDelete}
                                                className="flex-1 px-3 py-2 text-xs text-white bg-red-600 hover:bg-red-700 rounded-lg font-bold"
                                            >
                                                Подтвердить удаление
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {activeTab === "general" && (
                    <div className="p-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-900/50">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition"
                        >
                            Отмена
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!name.trim() || updateProject.isPending}
                            className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-medium transition"
                        >
                            {updateProject.isPending ? "Сохранение..." : "Сохранить"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
