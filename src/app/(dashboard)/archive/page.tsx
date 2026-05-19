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
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${active
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
            <div className="flex items-center justify-between gap-4 border-b border-slate-700/50 px-6 py-4">
                <div>
                    <h1 className="text-xl font-bold text-white">Архив</h1>
                    <p className="mt-1 text-xs text-slate-500">Завершённые задачи и проекты остаются здесь без автоочистки</p>
                </div>

                <div className="flex rounded-xl bg-slate-800/80 p-1">
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
                    <div className="h-full overflow-auto p-6">
                        <ProjectRetentionList mode="archive" />
                    </div>
                )}
            </div>
        </div>
    );
}
