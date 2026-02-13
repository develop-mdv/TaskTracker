"use client";

import { trpc } from "@/lib/trpc";

const PRIORITY_LABELS = ["Без приоритета", "Низкий", "Средний", "Высокий", "Срочный"];
const PRIORITY_COLORS = ["#64748b", "#3b82f6", "#eab308", "#f97316", "#ef4444"];

export default function StatsPage() {
    const { data: stats, isLoading } = trpc.stats.overview.useQuery({});
    const { data: projects } = trpc.projects.list.useQuery();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    if (!stats) return null;

    const maxDailyValue = Math.max(
        1,
        ...stats.dailyData.map((d) => Math.max(d.created, d.completed))
    );

    return (
        <div className="h-full flex flex-col">
            <div className="px-6 py-4 border-b border-slate-700/50">
                <h1 className="text-xl font-bold text-white">Статистика</h1>
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-6">
                {/* Summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="Открытых задач" value={stats.totalOpen} color="indigo" />
                    <StatCard label="Выполнено всего" value={stats.totalCompleted} color="green" />
                    <StatCard
                        label="Создано за неделю"
                        value={stats.createdThisWeek}
                        color="blue"
                    />
                    <StatCard
                        label="Выполнено за неделю"
                        value={stats.completedThisWeek}
                        color="emerald"
                    />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                        label="Создано за месяц"
                        value={stats.createdThisMonth}
                        color="cyan"
                    />
                    <StatCard
                        label="Выполнено за месяц"
                        value={stats.completedThisMonth}
                        color="teal"
                    />
                    <StatCard label="В корзине" value={stats.totalDeleted} color="red" />
                    <StatCard
                        label="Эффективность (нед.)"
                        value={
                            stats.createdThisWeek > 0
                                ? `${Math.round((stats.completedThisWeek / stats.createdThisWeek) * 100)}%`
                                : "—"
                        }
                        color="purple"
                    />
                </div>

                {/* Chart: Activity last 14 days */}
                <div className="bg-slate-800/50 border border-slate-700/30 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-slate-300 mb-4">
                        Активность за 14 дней
                    </h3>
                    <div className="flex items-end gap-1 h-40">
                        {stats.dailyData.map((day) => (
                            <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                                <div className="flex gap-0.5 items-end w-full h-32">
                                    <div
                                        className="flex-1 bg-indigo-500/60 rounded-t-sm transition-all"
                                        style={{
                                            height: `${(day.created / maxDailyValue) * 100}%`,
                                            minHeight: day.created > 0 ? "4px" : "0px",
                                        }}
                                        title={`Создано: ${day.created}`}
                                    />
                                    <div
                                        className="flex-1 bg-green-500/60 rounded-t-sm transition-all"
                                        style={{
                                            height: `${(day.completed / maxDailyValue) * 100}%`,
                                            minHeight: day.completed > 0 ? "4px" : "0px",
                                        }}
                                        title={`Выполнено: ${day.completed}`}
                                    />
                                </div>
                                <span className="text-[10px] text-slate-600 leading-none">
                                    {new Date(day.date).getDate()}
                                </span>
                            </div>
                        ))}
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 bg-indigo-500/60 rounded-sm" />
                            Создано
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 bg-green-500/60 rounded-sm" />
                            Выполнено
                        </div>
                    </div>
                </div>

                {/* Priority distribution */}
                <div className="bg-slate-800/50 border border-slate-700/30 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-slate-300 mb-4">
                        По приоритету (открытые)
                    </h3>
                    <div className="space-y-2">
                        {stats.byPriority.map((p) => (
                            <div key={p.priority} className="flex items-center gap-3">
                                <span className="text-xs text-slate-400 w-28">
                                    {PRIORITY_LABELS[p.priority]}
                                </span>
                                <div className="flex-1 bg-slate-900/50 rounded-full h-4 overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all"
                                        style={{
                                            width: `${Math.max(4, (p.count / Math.max(1, stats.totalOpen)) * 100)}%`,
                                            backgroundColor: PRIORITY_COLORS[p.priority],
                                            opacity: 0.7,
                                        }}
                                    />
                                </div>
                                <span className="text-xs text-slate-500 w-8 text-right">{p.count}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Per-project stats */}
                {projects && projects.length > 0 && (
                    <div className="bg-slate-800/50 border border-slate-700/30 rounded-xl p-5">
                        <h3 className="text-sm font-semibold text-slate-300 mb-4">
                            По проектам
                        </h3>
                        <div className="space-y-3">
                            {projects.map((project) => (
                                <ProjectStatRow key={project.id} project={project} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function StatCard({
    label,
    value,
    color,
}: {
    label: string;
    value: number | string;
    color: string;
}) {
    const colorMap: Record<string, string> = {
        indigo: "from-indigo-500/10 border-indigo-500/20 text-indigo-400",
        green: "from-green-500/10 border-green-500/20 text-green-400",
        blue: "from-blue-500/10 border-blue-500/20 text-blue-400",
        emerald: "from-emerald-500/10 border-emerald-500/20 text-emerald-400",
        cyan: "from-cyan-500/10 border-cyan-500/20 text-cyan-400",
        teal: "from-teal-500/10 border-teal-500/20 text-teal-400",
        red: "from-red-500/10 border-red-500/20 text-red-400",
        purple: "from-purple-500/10 border-purple-500/20 text-purple-400",
    };

    return (
        <div
            className={`bg-gradient-to-br to-transparent border rounded-xl p-4 ${colorMap[color] || colorMap.indigo
                }`}
        >
            <p className="text-xs text-slate-500 mb-1">{label}</p>
            <p className={`text-2xl font-bold ${colorMap[color]?.split(" ").pop()}`}>
                {value}
            </p>
        </div>
    );
}

function ProjectStatRow({ project }: { project: any }) {
    const { data: stats } = trpc.stats.overview.useQuery({ projectId: project.id });

    return (
        <div className="flex items-center gap-3">
            <div
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: project.color }}
            />
            <span className="text-sm text-slate-300 flex-1">{project.name}</span>
            <span className="text-xs text-slate-500">
                {stats?.totalOpen ?? "..."} открыто
            </span>
            <span className="text-xs text-green-500/70">
                {stats?.totalCompleted ?? "..."} выполнено
            </span>
        </div>
    );
}
