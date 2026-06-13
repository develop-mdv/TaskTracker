"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { TaskView } from "@/components/views/task-view";
import { ProjectRetentionList } from "@/components/views/project-retention-list";

type ArchiveTab = "tasks" | "projects";

function TabButton({
    active,
    label,
    count,
    onClick,
}: {
    active: boolean;
    label: string;
    count: number;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition sm:flex-none ${active
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                : "text-slate-400 hover:bg-slate-700/60 hover:text-white"
                }`}
        >
            <span>{label}</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-white/15 text-white" : "bg-slate-700 text-slate-400"}`}>
                {count}
            </span>
        </button>
    );
}

export default function ArchivePage() {
    const [activeTab, setActiveTab] = useState<ArchiveTab>("tasks");
    const { data: tasks = [] } = trpc.tasks.list.useQuery({ archived: true });
    const { data: projects = [] } = trpc.projects.listCompleted.useQuery();

    return (
        <div className="h-full flex flex-col">
            <div className="flex flex-col justify-between gap-3 border-b border-slate-700/50 px-4 py-3 sm:flex-row sm:items-center sm:px-6 sm:py-4">
                <div>
                    <h1 className="text-xl font-bold text-white">Архив</h1>
                    <p className="mt-1 text-xs text-slate-500">Завершённые задачи и проекты остаются здесь без автоочистки</p>
                </div>

                <div className="flex w-full rounded-xl bg-slate-800/80 p-1 sm:w-auto">
                    <TabButton
                        active={activeTab === "tasks"}
                        label="Задачи"
                        count={tasks.length}
                        onClick={() => setActiveTab("tasks")}
                    />
                    <TabButton
                        active={activeTab === "projects"}
                        label="Проекты"
                        count={projects.length}
                        onClick={() => setActiveTab("projects")}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-hidden">
                {activeTab === "tasks" ? (
                    <TaskView title="Задачи в архиве" archived showViewToggle={false} hideHeader />
                ) : (
                    <div className="h-full overflow-auto p-4 sm:p-6">
                        <ProjectRetentionList mode="archive" />
                    </div>
                )}
            </div>
        </div>
    );
}
