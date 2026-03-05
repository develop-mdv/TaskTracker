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
                        className="w-full bg-transparent resize-none outline-none text-sm leading-relaxed font-medium"
                        style={{ color: textColor, minHeight: "60px" }}
                        rows={3}
                    />
                ) : (
                    <p
                        className={`text-sm leading-relaxed font-medium whitespace-pre-wrap break-words ${!isTrash && !isDragOverlay ? "cursor-text" : ""}`}
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
        </div>
    );
});
