"use client";

import { useState } from "react";

interface CompleteTaskDialogProps {
    taskTitle: string;
    isOpen: boolean;
    onClose: () => void;
    onComplete: (result: "SUCCESS" | "FAILURE", note?: string) => Promise<unknown>;
}

export function CompleteTaskDialog({
    taskTitle,
    isOpen,
    onClose,
    onComplete,
}: CompleteTaskDialogProps) {
    const [note, setNote] = useState("");
    const [submittingResult, setSubmittingResult] = useState<"SUCCESS" | "FAILURE" | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (result: "SUCCESS" | "FAILURE") => {
        if (submittingResult) return;
        setSubmittingResult(result);
        try {
            await onComplete(result, note.trim() || undefined);
            setNote("");
            onClose();
        } catch (error) {
            console.error("Failed to close task:", error);
            alert("Не удалось завершить задачу. Попробуйте еще раз.");
        } finally {
            setSubmittingResult(null);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={(e) => { e.stopPropagation(); if (!submittingResult) onClose(); }}>
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
                            Итог / причина (опционально)
                        </label>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && e.ctrlKey) {
                                    handleSubmit("SUCCESS");
                                }
                            }}
                            placeholder="Как прошла задача? Какой результат?"
                            className="w-full h-32 px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none placeholder-slate-500"
                            autoFocus
                        />
                        <p className="text-xs text-slate-500 mt-1">Ctrl + Enter для отправки</p>
                    </div>
                </div>

                <div className="p-4 bg-slate-900/30 flex flex-wrap justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-slate-400 hover:text-white transition rounded-lg hover:bg-slate-700/50"
                        disabled={!!submittingResult}
                    >
                        Отмена
                    </button>
                    <button
                        onClick={() => handleSubmit("FAILURE")}
                        disabled={!!submittingResult}
                        className="px-4 py-2 text-sm bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded-lg font-medium transition"
                    >
                        {submittingResult === "FAILURE" ? "Сохранение..." : "Не выполнено"}
                    </button>
                    <button
                        onClick={() => handleSubmit("SUCCESS")}
                        disabled={!!submittingResult}
                        className="px-4 py-2 text-sm bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition flex items-center gap-2"
                    >
                        {submittingResult === "SUCCESS" ? (
                            <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                        Выполнено
                    </button>
                </div>
            </div>
        </div>
    );
}
