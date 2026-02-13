"use client";

import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";

const PRIORITIES = [
    { value: 0, label: "Без приоритета" },
    { value: 1, label: "Низкий" },
    { value: 2, label: "Средний" },
    { value: 3, label: "Высокий" },
    { value: 4, label: "Срочный" },
];

interface TaskDetailDrawerProps {
    taskId: string;
    onClose: () => void;
}

export function TaskDetailDrawer({ taskId, onClose }: TaskDetailDrawerProps) {
    const utils = trpc.useUtils();
    const { data: task, isLoading } = trpc.tasks.getById.useQuery({ id: taskId });
    const { data: projects } = trpc.projects.list.useQuery();

    const updateTask = trpc.tasks.update.useMutation({
        onSuccess: () => {
            utils.tasks.getById.invalidate({ id: taskId });
            utils.tasks.list.invalidate();
        },
    });

    const softDelete = trpc.tasks.softDelete.useMutation({
        onSuccess: () => {
            utils.tasks.list.invalidate();
            onClose();
        },
    });

    const complete = trpc.tasks.complete.useMutation({
        onSuccess: () => {
            utils.tasks.getById.invalidate({ id: taskId });
            utils.tasks.list.invalidate();
        },
    });

    const uncomplete = trpc.tasks.uncomplete.useMutation({
        onSuccess: () => {
            utils.tasks.getById.invalidate({ id: taskId });
            utils.tasks.list.invalidate();
        },
    });

    const getUploadUrl = trpc.attachments.getUploadUrl.useMutation();
    const getDownloadUrl = trpc.attachments.getDownloadUrl.useMutation();
    const deleteAttachment = trpc.attachments.delete.useMutation({
        onSuccess: () => {
            utils.tasks.getById.invalidate({ id: taskId });
        },
    });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    const [editTitle, setEditTitle] = useState<string | null>(null);
    const [editDescription, setEditDescription] = useState<string | null>(null);

    if (isLoading) {
        return (
            <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm" onClick={onClose}>
                <div className="w-full max-w-xl bg-slate-900 h-full animate-pulse" />
            </div>
        );
    }

    if (!task) return null;

    const handleFileUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setUploading(true);

        try {
            for (const file of Array.from(files)) {
                const { uploadUrl } = await getUploadUrl.mutateAsync({
                    taskId: task.id,
                    filename: file.name,
                    mimeType: file.type,
                    size: file.size,
                });

                await fetch(uploadUrl, {
                    method: "PUT",
                    body: file,
                    headers: { "Content-Type": file.type },
                });
            }
            utils.tasks.getById.invalidate({ id: taskId });
        } catch (error) {
            console.error("Upload failed:", error);
        } finally {
            setUploading(false);
        }
    };

    const handleDownload = async (attachmentId: string, filename: string) => {
        try {
            const { downloadUrl } = await getDownloadUrl.mutateAsync({ id: attachmentId });
            const a = document.createElement("a");
            a.href = downloadUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (error) {
            console.error("Download failed:", error);
        }
    };

    const isCompleted = !!task.completedAt;

    return (
        <div
            className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="w-full max-w-xl bg-slate-900 border-l border-slate-700/50 h-full overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700/50 px-6 py-4 flex items-center justify-between z-10">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                if (isCompleted) {
                                    uncomplete.mutate({ id: task.id });
                                } else {
                                    complete.mutate({ id: task.id });
                                }
                            }}
                            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${isCompleted
                                    ? "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                                    : "bg-slate-800 text-slate-400 hover:bg-indigo-500/20 hover:text-indigo-400"
                                }`}
                        >
                            {isCompleted ? "✓ Выполнено" : "Выполнить"}
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => softDelete.mutate({ id: task.id })}
                            className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition"
                            title="Удалить"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Title */}
                    <div>
                        {editTitle !== null ? (
                            <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                onBlur={() => {
                                    if (editTitle.trim() && editTitle !== task.title) {
                                        updateTask.mutate({ id: task.id, title: editTitle.trim() });
                                    }
                                    setEditTitle(null);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                    if (e.key === "Escape") setEditTitle(null);
                                }}
                                autoFocus
                                className="w-full text-xl font-semibold bg-transparent text-white outline-none border-b-2 border-indigo-500 pb-1"
                            />
                        ) : (
                            <h2
                                className="text-xl font-semibold text-white cursor-text hover:text-indigo-300 transition"
                                onClick={() => setEditTitle(task.title)}
                            >
                                {task.title}
                            </h2>
                        )}
                    </div>

                    {/* Description */}
                    <div>
                        <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                            Описание
                        </label>
                        {editDescription !== null ? (
                            <textarea
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                onBlur={() => {
                                    if (editDescription !== (task.description ?? "")) {
                                        updateTask.mutate({ id: task.id, description: editDescription || null });
                                    }
                                    setEditDescription(null);
                                }}
                                rows={5}
                                autoFocus
                                className="w-full mt-2 px-4 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
                            />
                        ) : (
                            <div
                                className="mt-2 text-sm text-slate-300 cursor-text hover:bg-slate-800/30 rounded-lg p-3 transition min-h-[60px] whitespace-pre-wrap"
                                onClick={() => setEditDescription(task.description ?? "")}
                            >
                                {task.description || (
                                    <span className="text-slate-600">Нажмите, чтобы добавить описание...</span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Fields grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                                Приоритет
                            </label>
                            <select
                                value={task.priority}
                                onChange={(e) =>
                                    updateTask.mutate({ id: task.id, priority: Number(e.target.value) })
                                }
                                className="w-full mt-1 px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            >
                                {PRIORITIES.map((p) => (
                                    <option key={p.value} value={p.value}>{p.label}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                                Проект
                            </label>
                            <select
                                value={task.projectId ?? ""}
                                onChange={(e) =>
                                    updateTask.mutate({
                                        id: task.id,
                                        projectId: e.target.value || null,
                                        section: e.target.value ? null : "inbox",
                                    })
                                }
                                className="w-full mt-1 px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            >
                                <option value="">Входящие</option>
                                {projects?.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                                Дата
                            </label>
                            <input
                                type="date"
                                value={task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : ""}
                                onChange={(e) =>
                                    updateTask.mutate({ id: task.id, dueDate: e.target.value || null })
                                }
                                className="w-full mt-1 px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                                Конечная дата
                            </label>
                            <input
                                type="date"
                                value={task.endDate ? new Date(task.endDate).toISOString().split("T")[0] : ""}
                                onChange={(e) =>
                                    updateTask.mutate({ id: task.id, endDate: e.target.value || null })
                                }
                                className="w-full mt-1 px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            />
                        </div>
                    </div>

                    {/* Attachments */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                                Вложения
                            </label>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="text-xs px-3 py-1 rounded-lg bg-slate-800 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition"
                            >
                                {uploading ? "Загрузка..." : "+ Добавить"}
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                className="hidden"
                                onChange={(e) => handleFileUpload(e.target.files)}
                            />
                        </div>

                        {task.attachments && task.attachments.length > 0 ? (
                            <div className="space-y-2">
                                {task.attachments.map((att) => (
                                    <div
                                        key={att.id}
                                        className="flex items-center gap-3 px-3 py-2 bg-slate-800/50 rounded-lg group"
                                    >
                                        <svg className="w-4 h-4 text-slate-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                        </svg>
                                        <span className="text-sm text-slate-300 flex-1 truncate">{att.filename}</span>
                                        {att.size && (
                                            <span className="text-xs text-slate-600">
                                                {(att.size / 1024).toFixed(0)}KB
                                            </span>
                                        )}
                                        <button
                                            onClick={() => handleDownload(att.id, att.filename)}
                                            className="opacity-0 group-hover:opacity-100 text-xs text-indigo-400 hover:text-indigo-300 transition"
                                        >
                                            Скачать
                                        </button>
                                        <button
                                            onClick={() => deleteAttachment.mutate({ id: att.id })}
                                            className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-300 transition"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-600">Нет вложений</p>
                        )}
                    </div>

                    {/* Meta */}
                    <div className="pt-4 border-t border-slate-800 text-xs text-slate-600 space-y-1">
                        <p>Создано: {new Date(task.createdAt).toLocaleString("ru-RU")}</p>
                        <p>Обновлено: {new Date(task.updatedAt).toLocaleString("ru-RU")}</p>
                        {task.completedAt && (
                            <p>Выполнено: {new Date(task.completedAt).toLocaleString("ru-RU")}</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
