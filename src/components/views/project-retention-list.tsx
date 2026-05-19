"use client";

import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";

type RetentionMode = "archive" | "trash";

interface RetainedProject {
    id: string;
    name: string;
    description?: string | null;
    color: string;
    completedAt?: string | Date | null;
    deletedAt?: string | Date | null;
    _count?: { tasks: number };
}

function formatDate(value?: string | Date | null) {
    if (!value) return null;
    return new Date(value).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

function ProjectRow({
    project,
    mode,
    onPrimary,
    onSecondary,
    primaryPending,
    secondaryPending,
}: {
    project: RetainedProject;
    mode: RetentionMode;
    onPrimary: () => void;
    onSecondary: () => void;
    primaryPending: boolean;
    secondaryPending: boolean;
}) {
    const date = mode === "archive" ? project.completedAt : project.deletedAt;
    const dateLabel = mode === "archive" ? "Завершён" : "Удалён";

    return (
        <div className="group rounded-lg border border-slate-700/40 bg-slate-800/45 px-4 py-3 transition hover:border-slate-600/70">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                        <span
                            className="h-3 w-3 flex-shrink-0 rounded-sm"
                            style={{ backgroundColor: project.color }}
                        />
                        <span className="truncate text-sm font-semibold text-white">{project.name}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>{project._count?.tasks ?? 0} задач</span>
                        {date && <span>{dateLabel}: {formatDate(date)}</span>}
                    </div>
                    {project.description && (
                        <p className="mt-2 line-clamp-2 text-xs text-slate-500">{project.description}</p>
                    )}
                </div>

                <div className="flex flex-shrink-0 items-center gap-2 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                    <button
                        onClick={onPrimary}
                        disabled={primaryPending}
                        className="rounded-lg bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-300 transition hover:bg-indigo-500/20 disabled:opacity-50"
                    >
                        {mode === "archive" ? "Вернуть" : "Восстановить"}
                    </button>
                    <button
                        onClick={onSecondary}
                        disabled={secondaryPending}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${mode === "archive"
                            ? "bg-slate-700/70 text-slate-300 hover:bg-slate-700"
                            : "bg-red-500/10 text-red-300 hover:bg-red-500/20"
                            }`}
                    >
                        {mode === "archive" ? "Открыть" : "Удалить навсегда"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export function ProjectRetentionList({ mode }: { mode: RetentionMode }) {
    const router = useRouter();
    const utils = trpc.useUtils();
    const archiveQuery = trpc.projects.listCompleted.useQuery(undefined, { enabled: mode === "archive" });
    const trashQuery = trpc.projects.listDeleted.useQuery(undefined, { enabled: mode === "trash" });

    const projects = (mode === "archive" ? archiveQuery.data : trashQuery.data) ?? [];
    const isLoading = mode === "archive" ? archiveQuery.isLoading : trashQuery.isLoading;

    const reopenProject = trpc.projects.reopen.useMutation({
        onSuccess: () => {
            utils.projects.list.invalidate();
            utils.projects.listCompleted.invalidate();
        },
    });

    const restoreProject = trpc.projects.restore.useMutation({
        onSuccess: () => {
            utils.projects.list.invalidate();
            utils.projects.listDeleted.invalidate();
            utils.tasks.list.invalidate();
        },
    });

    const hardDeleteProject = trpc.projects.hardDelete.useMutation({
        onSuccess: () => {
            utils.projects.listDeleted.invalidate();
            utils.tasks.list.invalidate();
        },
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            </div>
        );
    }

    if (projects.length === 0) {
        return (
            <div className="py-12 text-center text-slate-600">
                <svg className="mx-auto mb-4 h-16 w-16 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                <p>{mode === "archive" ? "В архиве нет проектов" : "В корзине нет проектов"}</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {(projects as RetainedProject[]).map((project) => (
                <ProjectRow
                    key={project.id}
                    project={project}
                    mode={mode}
                    primaryPending={reopenProject.isPending || restoreProject.isPending}
                    secondaryPending={hardDeleteProject.isPending}
                    onPrimary={() => {
                        if (mode === "archive") {
                            reopenProject.mutate({ id: project.id });
                        } else {
                            restoreProject.mutate({ id: project.id });
                        }
                    }}
                    onSecondary={() => {
                        if (mode === "archive") {
                            router.push(`/project/${project.id}`);
                        } else {
                            hardDeleteProject.mutate({ id: project.id, mode: "DELETE_ALL" });
                        }
                    }}
                />
            ))}
        </div>
    );
}
