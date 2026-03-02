"use client";

import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";

const COLORS = [
    { value: "#FEF08A", label: "Жёлтый" },
    { value: "#FECDD3", label: "Розовый" },
    { value: "#BAE6FD", label: "Голубой" },
    { value: "#BBF7D0", label: "Зелёный" },
    { value: "#FED7AA", label: "Оранжевый" },
    { value: "#E9D5FF", label: "Лиловый" },
];

interface CreateNoteModalProps {
    projectId: string;
    onClose: () => void;
}

export function CreateNoteModal({ projectId, onClose }: CreateNoteModalProps) {
    const [content, setContent] = useState("");
    const [color, setColor] = useState("#FEF08A");
    const [pinned, setPinned] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);

    const utils = trpc.useUtils();

    const createNote = trpc.notes.create.useMutation({
        onSuccess: () => {
            utils.notes.list.invalidate();
            onClose();
        },
    });

    useEffect(() => {
        textareaRef.current?.focus();
    }, []);

    // Close on click outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [onClose]);

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [onClose]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim()) return;
        createNote.mutate({
            projectId,
            content: content.trim(),
            color,
            pinned,
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Modal */}
            <div
                ref={modalRef}
                className="relative z-10 w-full max-w-md"
            >
                {/* Preview sticky note */}
                <div
                    className="rounded-lg p-6 shadow-2xl mx-4"
                    style={{
                        backgroundColor: color,
                        transform: "rotate(-1deg)",
                    }}
                >
                    <form onSubmit={handleSubmit}>
                        {/* Title */}
                        <h3 className="text-lg font-bold mb-4" style={{ color: "#1E293B" }}>
                            ✏️ Новая заметка
                        </h3>

                        {/* Content */}
                        <textarea
                            ref={textareaRef}
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Напишите что-нибудь..."
                            className="w-full bg-black/5 rounded-lg p-3 text-sm font-medium resize-none outline-none placeholder-black/30 focus:bg-black/10 transition"
                            style={{ color: "#1E293B", minHeight: "100px" }}
                            rows={4}
                        />

                        {/* Color picker */}
                        <div className="mt-4 flex items-center gap-3">
                            <span className="text-xs font-semibold" style={{ color: "#1E293B" }}>Цвет:</span>
                            <div className="flex gap-2">
                                {COLORS.map((c) => (
                                    <button
                                        key={c.value}
                                        type="button"
                                        onClick={() => setColor(c.value)}
                                        className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${color === c.value
                                            ? "border-slate-800 scale-110 shadow-lg"
                                            : "border-white/50"
                                            }`}
                                        style={{ backgroundColor: c.value }}
                                        title={c.label}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Pin checkbox */}
                        <label className="mt-3 flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={pinned}
                                onChange={(e) => setPinned(e.target.checked)}
                                className="w-4 h-4 rounded accent-indigo-600"
                            />
                            <span className="text-xs font-semibold" style={{ color: "#1E293B" }}>
                                📌 Сразу на доску
                            </span>
                        </label>

                        {/* Actions */}
                        <div className="mt-5 flex gap-2 justify-end">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium rounded-lg bg-black/10 hover:bg-black/20 transition"
                                style={{ color: "#1E293B" }}
                            >
                                Отмена
                            </button>
                            <button
                                type="submit"
                                disabled={!content.trim() || createNote.isPending}
                                className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg"
                            >
                                {createNote.isPending ? "Создаю..." : "Создать"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
