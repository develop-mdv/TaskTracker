"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { RecurrenceModal } from "@/components/task/recurrence-modal";

const FREQ_LABELS: Record<string, string> = {
    daily: "Ежедневно",
    weekly: "Еженедельно",
    monthly: "Ежемесячно",
    custom: "Свой интервал",
};

const DAY_NAMES = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

function formatFrequency(rule: {
    frequency: string;
    interval: number;
    daysOfWeek: number[];
    dayOfMonth: number | null;
}): string {
    let base = FREQ_LABELS[rule.frequency] || rule.frequency;
    if (rule.frequency === "daily" && rule.interval > 1) {
        base = `Каждые ${rule.interval} дн.`;
    } else if (rule.frequency === "weekly") {
        const days = rule.daysOfWeek.sort().map(d => DAY_NAMES[d]).join(", ");
        base = rule.interval > 1 ? `Каждые ${rule.interval} нед.` : "Еженедельно";
        if (days) base += ` (${days})`;
    } else if (rule.frequency === "monthly") {
        base = rule.interval > 1 ? `Каждые ${rule.interval} мес.` : "Ежемесячно";
        if (rule.dayOfMonth) base += ` (${rule.dayOfMonth}-го)`;
    } else if (rule.frequency === "custom") {
        base = `Каждые ${rule.interval} дн.`;
    }
    return base;
}

export default function RecurrencePage() {
    const { data: rules, isLoading } = trpc.recurrence.list.useQuery();
    const utils = trpc.useUtils();

    const [showModal, setShowModal] = useState(false);
    const [editRuleId, setEditRuleId] = useState<string | null>(null);

    const updateRule = trpc.recurrence.update.useMutation({
        onSuccess: () => utils.recurrence.list.invalidate(),
    });

    const deleteRule = trpc.recurrence.delete.useMutation({
        onSuccess: () => utils.recurrence.list.invalidate(),
    });

    return (
        <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white">Регулярные задачи</h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Правила для автоматического создания повторяющихся задач
                    </p>
                </div>
                <button
                    onClick={() => {
                        setEditRuleId(null);
                        setShowModal(true);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Создать правило
                </button>
            </div>

            {isLoading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-20 bg-slate-800/50 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : !rules || rules.length === 0 ? (
                <div className="text-center py-16">
                    <div className="text-4xl mb-4">🔄</div>
                    <h3 className="text-lg font-medium text-slate-300 mb-2">Нет регулярных задач</h3>
                    <p className="text-sm text-slate-500 mb-6">
                        Создайте правило, и задачи будут создаваться автоматически по расписанию
                    </p>
                    <button
                        onClick={() => setShowModal(true)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition"
                    >
                        Создать первое правило
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {rules.map(rule => (
                        <div
                            key={rule.id}
                            className="bg-slate-800/50 border border-slate-700/30 rounded-xl p-4 hover:bg-slate-800/70 transition group"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-white font-medium truncate">{rule.title}</h3>
                                        {!rule.active && (
                                            <span className="text-xs px-2 py-0.5 bg-yellow-500/10 text-yellow-400 rounded-md">
                                                Пауза
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-slate-400">
                                        <span className="flex items-center gap-1">
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            {formatFrequency(rule)}
                                        </span>
                                        {rule.priority > 0 && (
                                            <span className={`px-1.5 py-0.5 rounded text-xs ${rule.priority === 4 ? "bg-red-500/10 text-red-400" :
                                                    rule.priority === 3 ? "bg-orange-500/10 text-orange-400" :
                                                        rule.priority === 2 ? "bg-yellow-500/10 text-yellow-400" :
                                                            "bg-blue-500/10 text-blue-400"
                                                }`}>
                                                P{rule.priority}
                                            </span>
                                        )}
                                        {rule.lastGeneratedAt && (
                                            <span>
                                                Посл.: {new Date(rule.lastGeneratedAt).toLocaleDateString("ru-RU")}
                                            </span>
                                        )}
                                    </div>
                                    {rule.description && (
                                        <p className="text-xs text-slate-500 mt-1 truncate">{rule.description}</p>
                                    )}
                                </div>

                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition ml-3">
                                    <button
                                        onClick={() => updateRule.mutate({ id: rule.id, active: !rule.active })}
                                        className={`p-1.5 rounded-lg text-xs transition ${rule.active
                                                ? "text-yellow-400 hover:bg-yellow-500/10"
                                                : "text-green-400 hover:bg-green-500/10"
                                            }`}
                                        title={rule.active ? "Приостановить" : "Возобновить"}
                                    >
                                        {rule.active ? (
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        ) : (
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEditRuleId(rule.id);
                                            setShowModal(true);
                                        }}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition"
                                        title="Редактировать"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (confirm("Удалить это правило?")) {
                                                deleteRule.mutate({ id: rule.id });
                                            }
                                        }}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
                                        title="Удалить"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <RecurrenceModal
                    editRuleId={editRuleId}
                    onClose={() => {
                        setShowModal(false);
                        setEditRuleId(null);
                    }}
                />
            )}
        </div>
    );
}
