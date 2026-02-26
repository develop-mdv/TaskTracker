"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";

const FREQUENCIES = [
    { value: "daily", label: "Ежедневно" },
    { value: "weekly", label: "Еженедельно" },
    { value: "monthly", label: "Ежемесячно" },
    { value: "custom", label: "Свой интервал" },
];

const DAYS_OF_WEEK = [
    { value: 1, label: "Пн" },
    { value: 2, label: "Вт" },
    { value: 3, label: "Ср" },
    { value: 4, label: "Чт" },
    { value: 5, label: "Пт" },
    { value: 6, label: "Сб" },
    { value: 0, label: "Вс" },
];

const PRIORITIES = [
    { value: 0, label: "Без приоритета" },
    { value: 1, label: "Низкий" },
    { value: 2, label: "Средний" },
    { value: 3, label: "Высокий" },
    { value: 4, label: "Срочный" },
];

interface RecurrenceModalProps {
    onClose: () => void;
    editRuleId?: string | null;
}

export function RecurrenceModal({ onClose, editRuleId }: RecurrenceModalProps) {
    const utils = trpc.useUtils();
    const { data: projects } = trpc.projects.list.useQuery();
    const { data: rules } = trpc.recurrence.list.useQuery();

    const editRule = editRuleId ? rules?.find(r => r.id === editRuleId) : null;

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState(0);
    const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly" | "custom">("daily");
    const [interval, setInterval] = useState(1);
    const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
    const [dayOfMonth, setDayOfMonth] = useState<number | "">(1);
    const [projectId, setProjectId] = useState<string>("");

    useEffect(() => {
        if (editRule) {
            setTitle(editRule.title);
            setDescription(editRule.description ?? "");
            setPriority(editRule.priority);
            setFrequency(editRule.frequency as any);
            setInterval(editRule.interval);
            setDaysOfWeek(editRule.daysOfWeek ?? []);
            setDayOfMonth(editRule.dayOfMonth ?? "");
            setProjectId(editRule.projectId ?? "");
        }
    }, [editRule]);

    const createRule = trpc.recurrence.create.useMutation({
        onSuccess: () => {
            utils.recurrence.list.invalidate();
            onClose();
        },
    });

    const updateRule = trpc.recurrence.update.useMutation({
        onSuccess: () => {
            utils.recurrence.list.invalidate();
            onClose();
        },
    });

    const toggleDay = (day: number) => {
        setDaysOfWeek(prev =>
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;

        const data = {
            title: title.trim(),
            description: description || undefined,
            priority,
            frequency,
            interval,
            daysOfWeek: frequency === "weekly" ? daysOfWeek : undefined,
            dayOfMonth: frequency === "monthly" && dayOfMonth !== "" ? Number(dayOfMonth) : undefined,
            projectId: projectId || null,
            section: projectId ? null : ("inbox" as const),
        };

        if (editRuleId) {
            updateRule.mutate({ id: editRuleId, ...data });
        } else {
            createRule.mutate(data);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                    <h2 className="text-lg font-semibold text-white">
                        {editRuleId ? "Редактировать правило" : "Новая регулярная задача"}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Название задачи</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            autoFocus
                            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition"
                            placeholder="Что нужно делать регулярно?"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Описание</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition resize-none text-sm"
                            placeholder="Описание (опционально)"
                        />
                    </div>

                    {/* Frequency */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Частота повторения</label>
                        <div className="grid grid-cols-4 gap-2">
                            {FREQUENCIES.map(f => (
                                <button
                                    key={f.value}
                                    type="button"
                                    onClick={() => setFrequency(f.value as any)}
                                    className={`px-3 py-2 rounded-lg text-xs font-medium transition ${frequency === f.value
                                            ? "bg-indigo-600 text-white"
                                            : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
                                        }`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Interval */}
                    {(frequency === "daily" || frequency === "custom") && (
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">
                                Каждые N {frequency === "daily" ? "дней" : "дней"}
                            </label>
                            <input
                                type="number"
                                min={1}
                                max={365}
                                value={interval}
                                onChange={(e) => setInterval(Number(e.target.value) || 1)}
                                className="w-24 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            />
                        </div>
                    )}

                    {/* Days of week (for weekly) */}
                    {frequency === "weekly" && (
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Дни недели</label>
                            <div className="flex gap-2">
                                {DAYS_OF_WEEK.map(d => (
                                    <button
                                        key={d.value}
                                        type="button"
                                        onClick={() => toggleDay(d.value)}
                                        className={`w-10 h-10 rounded-lg text-xs font-bold transition ${daysOfWeek.includes(d.value)
                                                ? "bg-indigo-600 text-white"
                                                : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
                                            }`}
                                    >
                                        {d.label}
                                    </button>
                                ))}
                            </div>
                            <div className="mt-2">
                                <label className="block text-xs text-slate-500 mb-1">Каждые N недель</label>
                                <input
                                    type="number"
                                    min={1}
                                    max={52}
                                    value={interval}
                                    onChange={(e) => setInterval(Number(e.target.value) || 1)}
                                    className="w-24 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                />
                            </div>
                        </div>
                    )}

                    {/* Day of month (for monthly) */}
                    {frequency === "monthly" && (
                        <div className="flex gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">День месяца</label>
                                <input
                                    type="number"
                                    min={1}
                                    max={31}
                                    value={dayOfMonth}
                                    onChange={(e) => setDayOfMonth(Number(e.target.value) || "")}
                                    className="w-24 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Каждые N месяцев</label>
                                <input
                                    type="number"
                                    min={1}
                                    max={12}
                                    value={interval}
                                    onChange={(e) => setInterval(Number(e.target.value) || 1)}
                                    className="w-24 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                />
                            </div>
                        </div>
                    )}

                    {/* Priority & Project */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Приоритет</label>
                            <select
                                value={priority}
                                onChange={(e) => setPriority(Number(e.target.value))}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            >
                                {PRIORITIES.map(p => (
                                    <option key={p.value} value={p.value}>{p.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Проект</label>
                            <select
                                value={projectId}
                                onChange={(e) => setProjectId(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            >
                                <option value="">Входящие</option>
                                {projects?.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Actions */}
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
                            disabled={!title.trim() || createRule.isPending || updateRule.isPending}
                            className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-medium transition"
                        >
                            {editRuleId ? "Сохранить" : "Создать"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
