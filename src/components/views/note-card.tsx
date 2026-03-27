"use client";

import { useState, useRef, useEffect, forwardRef } from "react";
import { trpc } from "@/lib/trpc";

interface NoteCardProps {
    note: {
        id: string;
        content: string;
        color: string;
        pinned: boolean;
        createdAt: Date;
        attachments?: Array<{
            id: string;
            filename: string;
            mimeType: string | null;
            size: number | null;
        }>;
    };
    rotation: number;
    isTrash?: boolean;
    isDragging?: boolean;
    isDragOverlay?: boolean;
    style?: React.CSSProperties;
    listeners?: Record<string, Function>;
    attributes?: Record<string, any>;
}

const PIN_COLORS: Record<string, string> = {
    "#FEF08A": "#EAB308", // жёлтый → жёлтая кнопка
    "#FECDD3": "#F43F5E", // розовый → красная кнопка
    "#BAE6FD": "#0EA5E9", // голубой → синяя кнопка
    "#BBF7D0": "#22C55E", // зелёный → зелёная кнопка
    "#FED7AA": "#F97316", // оранжевый → оранжевая кнопка
    "#E9D5FF": "#A855F7", // лиловый → фиолетовая кнопка
};

const TEXT_COLORS: Record<string, string> = {
    "#FEF08A": "#713F12",
    "#FECDD3": "#881337",
    "#BAE6FD": "#0C4A6E",
    "#BBF7D0": "#14532D",
    "#FED7AA": "#7C2D12",
    "#E9D5FF": "#581C87",
};

export const NoteCard = forwardRef<HTMLDivElement, NoteCardProps>(function NoteCard(
    { note, rotation, isTrash, isDragging, isDragOverlay, style: externalStyle, listeners, attributes },
    ref
) {
    const [editing, setEditing] = useState(false);
    const [editContent, setEditContent] = useState(note.content);
    const [showMenu, setShowMenu] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    const utils = trpc.useUtils();

    const updateNote = trpc.notes.update.useMutation({
        onSuccess: () => utils.notes.list.invalidate(),
    });
    const pinNote = trpc.notes.pin.useMutation({
        onSuccess: () => utils.notes.list.invalidate(),
    });
    const unpinNote = trpc.notes.unpin.useMutation({
        onSuccess: () => utils.notes.list.invalidate(),
    });
    const softDelete = trpc.notes.softDelete.useMutation({
        onSuccess: () => {
            utils.notes.list.invalidate();
            utils.notes.listTrashed.invalidate();
        },
    });
    const restoreNote = trpc.notes.restore.useMutation({
        onSuccess: () => {
            utils.notes.list.invalidate();
            utils.notes.listTrashed.invalidate();
        },
    });
    const hardDelete = trpc.notes.hardDelete.useMutation({
        onSuccess: () => utils.notes.listTrashed.invalidate(),
    });

    const getUploadUrl = trpc.attachments.getUploadUrl.useMutation();
    const deleteAttachment = trpc.attachments.delete.useMutation({
        onSuccess: () => utils.notes.list.invalidate(),
    });

    const handleFileUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setUploading(true);
        try {
            for (const file of Array.from(files)) {
                if (file.size > 20 * 1024 * 1024) continue; // Skip huge files
                const { uploadUrl } = await getUploadUrl.mutateAsync({
                    noteId: note.id,
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
            utils.notes.list.invalidate();
        } catch (error) {
            console.error("Note attachment upload failed:", error);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
            setShowMenu(false);
        }
    };

    useEffect(() => {
        if (editing && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.selectionStart = textareaRef.current.value.length;
        }
    }, [editing]);

    // Close menu on click outside
    useEffect(() => {
        if (!showMenu) return;
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowMenu(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [showMenu]);

    const handleSave = () => {
        if (editContent.trim() && editContent !== note.content) {
            updateNote.mutate({ id: note.id, content: editContent.trim() });
        }
        setEditing(false);
    };

    const handleColorChange = (color: string) => {
        updateNote.mutate({ id: note.id, color });
        setShowMenu(false);
    };

    const pinColor = PIN_COLORS[note.color] || "#6366F1";
    const textColor = TEXT_COLORS[note.color] || "#1E293B";

    const COLORS = ["#FEF08A", "#FECDD3", "#BAE6FD", "#BBF7D0", "#FED7AA", "#E9D5FF"];

    const combinedStyle: React.CSSProperties = {
        ...externalStyle,
        backgroundColor: note.color,
        transform: `${externalStyle?.transform || ""} rotate(${isDragging ? 0 : rotation}deg)`.trim(),
        transition: externalStyle?.transition || "transform 0.3s ease, box-shadow 0.3s ease",
        opacity: isDragging ? 0.4 : 1,
        ...(isDragOverlay ? { boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)", transform: "rotate(3deg) scale(1.05)", cursor: "grabbing" } : {}),
    };

    return (
        <div
            ref={ref}
            className={`sticky-note group relative ${isDragging ? "z-0" : ""}`}
            style={combinedStyle}
            {...(attributes || {})}
            {...(listeners || {})}
            onMouseEnter={(e) => {
                if (isDragging || isDragOverlay) return;
                (e.currentTarget as HTMLElement).style.transform = "rotate(0deg) scale(1.05)";
                (e.currentTarget as HTMLElement).style.zIndex = "10";
            }}
            onMouseLeave={(e) => {
                if (isDragging || isDragOverlay) return;
                (e.currentTarget as HTMLElement).style.transform = `rotate(${rotation}deg)`;
                (e.currentTarget as HTMLElement).style.zIndex = "auto";
            }}
        >
            {/* Push pin */}
            {note.pinned && !isTrash && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10">
                    <div
                        className="w-5 h-5 rounded-full shadow-lg border-2 border-white/80"
                        style={{ backgroundColor: pinColor }}
                    />
                    <div
                        className="w-0.5 h-2 mx-auto -mt-0.5 rounded-b"
                        style={{ backgroundColor: pinColor }}
                    />
                </div>
            )}

            {/* Actions menu button */}
            {!isTrash && !isDragOverlay && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(!showMenu);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded-full hover:bg-black/10"
                    style={{ color: textColor }}
                >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                </button>
            )}

            {/* Context menu */}
            {showMenu && (
                <div
                    ref={menuRef}
                    className="absolute top-8 right-2 z-50 bg-slate-900 rounded-xl shadow-2xl border border-slate-700 py-2 min-w-[180px]"
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    {/* Color picker */}
                    <div className="px-3 py-2">
                        <p className="text-xs text-slate-400 mb-2">Цвет</p>
                        <div className="flex gap-1.5">
                            {COLORS.map((c) => (
                                <button
                                    key={c}
                                    onClick={() => handleColorChange(c)}
                                    className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${note.color === c ? "border-white shadow-lg scale-110" : "border-transparent"
                                        }`}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                        </div>
                    </div>
                    <div className="border-t border-slate-700 my-1" />
                    {/* Pin/Unpin */}
                    <button
                        onClick={() => {
                            if (note.pinned) {
                                unpinNote.mutate({ id: note.id });
                            } else {
                                pinNote.mutate({ id: note.id });
                            }
                            setShowMenu(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800 flex items-center gap-2 transition"
                    >
                        {note.pinned ? (
                            <>
                                <span>📥</span> В стопку
                            </>
                        ) : (
                            <>
                                <span>📌</span> На доску
                            </>
                        )}
                    </button>
                    {/* Attach file */}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800 flex items-center gap-2 transition disabled:opacity-50"
                    >
                        <span>📎</span> {uploading ? "Загрузка..." : "Прикрепить файл"}
                    </button>
                    {/* Hidden file input */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => handleFileUpload(e.target.files)}
                    />
                    {/* Delete */}
                    <button
                        onClick={() => {
                            softDelete.mutate({ id: note.id });
                            setShowMenu(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-slate-800 flex items-center gap-2 transition"
                    >
                        <span>🗑️</span> В корзину
                    </button>
                </div>
            )}

            {/* Trash actions */}
            {isTrash && (
                <div className="absolute top-2 right-2 flex gap-1">
                    <button
                        onClick={() => restoreNote.mutate({ id: note.id })}
                        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-black/10 transition"
                        title="Восстановить"
                    >
                        <span className="text-sm">↩️</span>
                    </button>
                    <button
                        onClick={() => hardDelete.mutate({ id: note.id })}
                        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-black/10 transition"
                        title="Удалить навсегда"
                    >
                        <span className="text-sm">✕</span>
                    </button>
                </div>
            )}

            {/* Content */}
            <div className="pt-4" style={{ color: textColor }}>
                {editing && !isTrash && !isDragOverlay ? (
                    <textarea
                        ref={textareaRef}
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        onBlur={handleSave}
                        onPointerDown={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                            if (e.key === "Escape") {
                                setEditContent(note.content);
                                setEditing(false);
                            }
                        }}
                        className="w-full bg-transparent resize-none outline-none text-sm leading-relaxed font-medium max-h-[250px] overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-black/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-black/20"
                        style={{ color: textColor, minHeight: "60px" }}
                        rows={3}
                    />
                ) : (
                    <p
                        className={`text-sm leading-relaxed font-medium whitespace-pre-wrap break-words max-h-[250px] overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-black/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-black/20 ${!isTrash && !isDragOverlay ? "cursor-text" : ""}`}
                        onClick={() => {
                            if (!isTrash && !isDragOverlay) {
                                setEditContent(note.content);
                                setEditing(true);
                            }
                        }}
                        onPointerDown={(e) => {
                            if (editing) e.stopPropagation();
                        }}
                        style={{ minHeight: "40px" }}
                    >
                        {note.content}
                    </p>
                )}
            </div>

            {/* Attachments */}
            {note.attachments && note.attachments.length > 0 && !isDragOverlay && (
                <div className="mt-4 space-y-2 border-t border-black/10 pt-3" style={{ color: textColor }}>
                    {note.attachments.map((att) => {
                        const isImage = att.mimeType?.startsWith("image/");
                        return (
                            <div key={att.id} className="relative group flex flex-col gap-1 items-start">
                                {isImage ? (
                                    <div className="relative rounded-md overflow-hidden border border-black/10 w-full bg-black/5">
                                        <img
                                            src={`/api/attachments/${att.id}`}
                                            alt={att.filename}
                                            className="w-full max-h-32 object-contain"
                                        />
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 bg-black/5 px-2 py-1.5 rounded-md max-w-full">
                                        <span className="text-lg">📎</span>
                                        <div className="flex flex-col overflow-hidden">
                                            <a
                                                href={`/api/attachments/${att.id}?download=true`}
                                                download={att.filename}
                                                className="text-[11px] font-semibold underline truncate max-w-full"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {att.filename}
                                            </a>
                                        </div>
                                    </div>
                                )}
                                {!isTrash && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            deleteAttachment.mutate({ id: att.id });
                                        }}
                                        className="opacity-0 group-hover:opacity-100 absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] shadow-sm transition-all"
                                        title="Удалить файл"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
});
