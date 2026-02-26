"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { formatTaskToText, copyToClipboard, downloadAsFile } from "@/lib/export-utils";

const PRIORITIES = [
    { value: 0, label: "Без приоритета" },
    { value: 1, label: "Низкий" },
    { value: 2, label: "Средний" },
    { value: 3, label: "Высокий" },
    { value: 4, label: "Срочный" },
];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const ACCEPTED_FILE_TYPES = [
    "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
    "application/pdf", "text/plain", "text/csv", "text/html",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "video/mp4", "video/webm",
    "audio/mpeg", "audio/ogg", "audio/wav",
    "application/zip", "application/x-rar-compressed", "application/x-7z-compressed",
].join(",");

function getFileCategory(mimeType?: string | null): "image" | "video" | "audio" | "pdf" | "document" | "archive" | "other" {
    if (!mimeType) return "other";
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType.startsWith("audio/")) return "audio";
    if (mimeType === "application/pdf") return "pdf";
    if (mimeType.startsWith("text/") || mimeType.includes("word") || mimeType.includes("sheet") || mimeType.includes("excel")) return "document";
    if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("7z")) return "archive";
    return "other";
}

function FileTypeIcon({ mimeType, className = "w-5 h-5" }: { mimeType?: string | null; className?: string }) {
    const cat = getFileCategory(mimeType);
    switch (cat) {
        case "image":
            return (
                <svg className={`${className} text-emerald-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            );
        case "video":
            return (
                <svg className={`${className} text-purple-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
            );
        case "audio":
            return (
                <svg className={`${className} text-amber-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
            );
        case "pdf":
            return (
                <svg className={`${className} text-red-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
            );
        case "document":
            return (
                <svg className={`${className} text-blue-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            );
        case "archive":
            return (
                <svg className={`${className} text-orange-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
            );
        default:
            return (
                <svg className={`${className} text-slate-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
            );
    }
}

function formatFileSize(bytes: number | null | undefined): string {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Lightbox / Preview Modal
function AttachmentPreviewModal({
    attachment,
    downloadUrl,
    onClose,
}: {
    attachment: { id: string; filename: string; mimeType: string | null; size: number | null };
    downloadUrl: string;
    onClose: () => void;
}) {
    const cat = getFileCategory(attachment.mimeType);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md"
            onClick={onClose}
        >
            <div
                className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute -top-2 -right-2 z-10 p-2 rounded-full bg-slate-800/80 text-white hover:bg-slate-700 transition"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Content */}
                {cat === "image" && (
                    <img
                        src={downloadUrl}
                        alt={attachment.filename}
                        className="max-w-[85vw] max-h-[80vh] rounded-xl object-contain shadow-2xl"
                    />
                )}
                {cat === "video" && (
                    <video
                        src={downloadUrl}
                        controls
                        autoPlay
                        className="max-w-[85vw] max-h-[80vh] rounded-xl shadow-2xl"
                    />
                )}
                {cat === "audio" && (
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 min-w-[400px] text-center space-y-4">
                        <FileTypeIcon mimeType={attachment.mimeType} className="w-12 h-12 mx-auto" />
                        <p className="text-white font-medium">{attachment.filename}</p>
                        <audio src={downloadUrl} controls autoPlay className="w-full" />
                    </div>
                )}
                {cat === "pdf" && (
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 min-w-[400px] text-center space-y-4">
                        <FileTypeIcon mimeType="application/pdf" className="w-12 h-12 mx-auto" />
                        <p className="text-white font-medium">{attachment.filename}</p>
                        <a
                            href={downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition"
                        >
                            Открыть PDF в новой вкладке ↗
                        </a>
                    </div>
                )}
                {(cat === "document" || cat === "archive" || cat === "other") && (
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 min-w-[400px] text-center space-y-4">
                        <FileTypeIcon mimeType={attachment.mimeType} className="w-12 h-12 mx-auto" />
                        <p className="text-white font-medium">{attachment.filename}</p>
                        {attachment.size && (
                            <p className="text-sm text-slate-400">{formatFileSize(attachment.size)}</p>
                        )}
                        <a
                            href={downloadUrl}
                            download={attachment.filename}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition"
                        >
                            Скачать файл ↓
                        </a>
                    </div>
                )}

                {/* Filename caption */}
                <p className="mt-3 text-sm text-slate-400 truncate max-w-[80vw]">{attachment.filename}</p>
            </div>
        </div>
    );
}

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
    const [uploadError, setUploadError] = useState<string | null>(null);

    const [editTitle, setEditTitle] = useState<string | null>(null);
    const [editDescription, setEditDescription] = useState<string | null>(null);

    // Preview state
    const [previewAttachment, setPreviewAttachment] = useState<{
        id: string; filename: string; mimeType: string | null; size: number | null;
    } | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // Thumbnail URLs cache
    const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});

    // Load thumbnail URLs for image attachments
    useEffect(() => {
        if (!task?.attachments) return;
        const imageAttachments = task.attachments.filter(
            (att) => getFileCategory(att.mimeType) === "image" && !thumbnailUrls[att.id]
        );
        if (imageAttachments.length === 0) return;

        let cancelled = false;
        (async () => {
            const newUrls: Record<string, string> = {};
            for (const att of imageAttachments) {
                try {
                    const { downloadUrl } = await getDownloadUrl.mutateAsync({ id: att.id });
                    if (!cancelled) newUrls[att.id] = downloadUrl;
                } catch { /* ignore */ }
            }
            if (!cancelled) {
                setThumbnailUrls((prev) => ({ ...prev, ...newUrls }));
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [task?.attachments?.map(a => a.id).join(",")]);

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
        setUploadError(null);

        try {
            for (const file of Array.from(files)) {
                // Client-side size check
                if (file.size > MAX_FILE_SIZE) {
                    setUploadError(`«${file.name}» превышает лимит 20 MB`);
                    continue;
                }
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
        } catch (error: any) {
            console.error("Upload failed:", error);
            setUploadError(error?.message || "Ошибка при загрузке");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
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

    const handlePreview = async (att: { id: string; filename: string; mimeType: string | null; size: number | null }) => {
        try {
            // Use cached thumbnail URL if available
            const url = thumbnailUrls[att.id] || (await getDownloadUrl.mutateAsync({ id: att.id })).downloadUrl;
            setPreviewAttachment(att);
            setPreviewUrl(url);
        } catch (error) {
            console.error("Preview failed:", error);
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
                        {task.recurrenceRuleId && (
                            <span className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md" title="Повторяющаяся задача">
                                🔄 Повторяющаяся
                            </span>
                        )}
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
                                Дедлайн
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
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                                Дата начала
                            </label>
                            <input
                                type="date"
                                value={task.startDate ? new Date(task.startDate).toISOString().split("T")[0] : ""}
                                onChange={(e) =>
                                    updateTask.mutate({ id: task.id, startDate: e.target.value || null })
                                }
                                className="w-full mt-1 px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                                Дата окончания
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
                                accept={ACCEPTED_FILE_TYPES}
                                className="hidden"
                                onChange={(e) => handleFileUpload(e.target.files)}
                            />
                        </div>

                        {uploadError && (
                            <div className="mb-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
                                {uploadError}
                            </div>
                        )}

                        {task.attachments && task.attachments.length > 0 ? (
                            <div className="space-y-2">
                                {/* Image thumbnails grid */}
                                {task.attachments.some(att => getFileCategory(att.mimeType) === "image") && (
                                    <div className="grid grid-cols-3 gap-2 mb-3">
                                        {task.attachments
                                            .filter(att => getFileCategory(att.mimeType) === "image")
                                            .map(att => (
                                                <button
                                                    key={att.id}
                                                    onClick={() => handlePreview(att)}
                                                    className="relative aspect-square rounded-lg overflow-hidden bg-slate-800 border border-slate-700/50 hover:border-indigo-500/50 transition group"
                                                >
                                                    {thumbnailUrls[att.id] ? (
                                                        <img
                                                            src={thumbnailUrls[att.id]}
                                                            alt={att.filename}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center animate-pulse">
                                                            <FileTypeIcon mimeType={att.mimeType} className="w-8 h-8" />
                                                        </div>
                                                    )}
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                                        </svg>
                                                    </div>
                                                </button>
                                            ))}
                                    </div>
                                )}

                                {/* Non-image attachments list */}
                                {task.attachments
                                    .filter(att => getFileCategory(att.mimeType) !== "image")
                                    .map((att) => (
                                        <div
                                            key={att.id}
                                            className="flex items-center gap-3 px-3 py-2.5 bg-slate-800/50 rounded-lg group hover:bg-slate-800 transition cursor-pointer"
                                            onClick={() => handlePreview(att)}
                                        >
                                            <FileTypeIcon mimeType={att.mimeType} />
                                            <span className="text-sm text-slate-300 flex-1 truncate">{att.filename}</span>
                                            {att.size && (
                                                <span className="text-xs text-slate-600">
                                                    {formatFileSize(att.size)}
                                                </span>
                                            )}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDownload(att.id, att.filename);
                                                }}
                                                className="opacity-0 group-hover:opacity-100 text-xs text-indigo-400 hover:text-indigo-300 transition"
                                            >
                                                Скачать
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteAttachment.mutate({ id: att.id });
                                                }}
                                                className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-300 transition"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}

                                {/* Image attachments also need delete buttons — show as small list under grid */}
                                {task.attachments
                                    .filter(att => getFileCategory(att.mimeType) === "image")
                                    .map((att) => (
                                        <div
                                            key={`meta-${att.id}`}
                                            className="flex items-center gap-3 px-3 py-1.5 group"
                                        >
                                            <FileTypeIcon mimeType={att.mimeType} className="w-3.5 h-3.5" />
                                            <span className="text-xs text-slate-500 flex-1 truncate">{att.filename}</span>
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

            {/* Lightbox Preview */}
            {previewAttachment && previewUrl && (
                <AttachmentPreviewModal
                    attachment={previewAttachment}
                    downloadUrl={previewUrl}
                    onClose={() => {
                        setPreviewAttachment(null);
                        setPreviewUrl(null);
                    }}
                />
            )}
        </div>
    );
}
