"use client";

import { use, useState } from "react";
import { trpc } from "@/lib/trpc";
import { TaskView } from "@/components/views/task-view";
import { NotesBoard } from "@/components/views/notes-board";

type Tab = "tasks" | "notes";

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { data: project } = trpc.projects.getById.useQuery({ id });
    const [activeTab, setActiveTab] = useState<Tab>("tasks");

    return (
        <div className="h-screen flex flex-col">
            {/* Tabs bar */}
            <div className="flex items-center gap-3 px-6 pt-3 pb-0 shrink-0">
                <div className="flex bg-slate-800/80 rounded-xl p-1">
                    <button
                        onClick={() => setActiveTab("tasks")}
                        className={`
                            px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200
                            ${activeTab === "tasks"
                                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"
                                : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                            }
                        `}
                    >
                        <span className="flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            Задачи
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab("notes")}
                        className={`
                            px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200
                            ${activeTab === "notes"
                                ? "bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/25"
                                : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                            }
                        `}
                    >
                        <span className="flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            Заметки
                        </span>
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
                {activeTab === "tasks" ? (
                    <TaskView
                        projectId={id}
                        title={project?.name ?? "Проект"}
                    />
                ) : (
                    <NotesBoard projectId={id} />
                )}
            </div>
        </div>
    );
}
