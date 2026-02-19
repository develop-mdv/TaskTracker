"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";

interface CompleteTaskDialogProps {
    taskId: string;
    taskTitle: string;
    isOpen: boolean;
    onClose: () => void;
    onComplete: (note?: string) => void;
}

export function CompleteTaskDialog({
    taskId,
    taskTitle,
    isOpen,
    onClose,
    onComplete,
}: CompleteTaskDialogProps) {
    const [note, setNote] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            await onComplete(note.trim() || undefined);
            setNote("");
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
            <div
                className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md shadow-xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-4 border-b border-slate-700 bg-slate-900/50">
                    <h3 className="text-lg font-semibold text-white">Завершение задачи</h3>
                    <p className="text-sm text-slate-400 mt-1 truncate">{taskTitle}</p>
                </div>

                <div className="p-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">
                            Итог / Заметка (опционально)
                        </label>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && e.ctrlKey) {
                                    handleSubmit();
                                }
                            }}
                            placeholder="Как прошла задача? Какой результат?"
                            className="w-full h-32 px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none placeholder-slate-500"
                            autoFocus
                        />
                        <p className="text-xs text-slate-500 mt-1">Ctrl + Enter для отправки</p>
                    </div>
                </div>

                <div className="p-4 bg-slate-900/30 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-slate-400 hover:text-white transition rounded-lg hover:bg-slate-700/50"
                        disabled={isSubmitting}
                    >
                        Отмена
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-sm bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition flex items-center gap-2"
                    >
                        {isSubmitting ? (
                            <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                        Завершить
                    </button>
                </div>
            </div>
        </div>
    );
}
