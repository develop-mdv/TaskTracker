"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { TaskDetailDrawer } from "@/components/task/task-detail-drawer";
import { LinkifiedText } from "@/components/ui/linkified-text";
import { formatRelativeDate, getBrowserTimeZone } from "@/lib/timezone";

type SearchTask = {
    id: string;
    title: string;
    description?: string | null;
    dueDate?: Date | string | null;
    completedAt?: Date | string | null;
    priority: number;
    tags: string[];
    project?: { id: string; name: string; color: string } | null;
    boardColumn?: { id: string; name: string; color?: string | null } | null;
};

type SearchNote = {
    id: string;
    content: string;
    pinned: boolean;
    projectId?: string | null;
    project?: { id: string; name: string; color: string } | null;
    attachments?: Array<{ id: string }>;
};

type SearchProject = {
    id: string;
    name: string;
    description?: string | null;
    color: string;
    completedAt?: Date | string | null;
    archived: boolean;
    _count?: { tasks: number };
};

export function SearchView() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const query = searchParams.get("q")?.trim() ?? "";
    const [draft, setDraft] = useState(query);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const timezone = getBrowserTimeZone();

    useEffect(() => {
        setDraft(query);
    }, [query]);

    const { data, isFetching } = trpc.search.all.useQuery(
        { query },
        { enabled: query.length > 0 }
    );

    const tasks = (data?.tasks ?? []) as SearchTask[];
    const notes = (data?.notes ?? []) as SearchNote[];
    const projects = (data?.projects ?? []) as SearchProject[];

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        const nextQuery = draft.trim();
        router.push(nextQuery ? `/search?q=${encodeURIComponent(nextQuery)}` : "/search");
    };

    return (
        <div className="h-full flex flex-col">
            <div className="border-b border-slate-700/50 px-6 py-4">
                <form onSubmit={handleSubmit} className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-3xl">
                        <svg
                            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-5.2-5.2m1.7-4.3a6 6 0 11-12 0 6 6 0 0112 0z" />
                        </svg>
                        <input
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            autoFocus
                            placeholder="Поиск по задачам, заметкам и проектам"
                            className="w-full rounded-xl border border-slate-700/60 bg-slate-900/80 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none transition focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20"
                        />
                    </div>
                    <button
                        type="submit"
                        className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
                        disabled={!draft.trim()}
                    >
                        Найти
                    </button>
                </form>
            </div>

            <div className="flex-1 overflow-auto px-6 py-6">
                {!query ? (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500">
                        Начните вводить запрос выше.
                    </div>
                ) : isFetching && !data ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                    </div>
                ) : data?.total === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500">
                        Ничего не найдено.
                    </div>
                ) : (
                    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_0.9fr]">
                        <section className="space-y-3">
                            <ResultHeader title="Задачи" count={tasks.length} />
                            <div className="space-y-2">
                                {tasks.map((task) => (
                                    <article
                                        key={task.id}
                                        onClick={() => setSelectedTaskId(task.id)}
                                        className="cursor-pointer rounded-lg border border-slate-800 bg-slate-900/55 p-4 transition hover:border-indigo-500/40 hover:bg-slate-900"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <h2 className="truncate text-sm font-semibold text-white">{task.title}</h2>
                                                {task.description && (
                                                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400">
                                                        <LinkifiedText text={task.description} />
                                                    </p>
                                                )}
                                            </div>
                                            {task.completedAt && (
                                                <span className="shrink-0 rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-400">
                                                    готово
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                            {task.dueDate && (
                                                <span className="rounded-full bg-slate-800 px-2 py-0.5">
                                                    {formatRelativeDate(task.dueDate, timezone)}
                                                </span>
                                            )}
                                            {task.project && (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5">
                                                    <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: task.project.color }} />
                                                    {task.project.name}
                                                </span>
                                            )}
                                            {task.boardColumn && (
                                                <span className="rounded-full bg-slate-800 px-2 py-0.5">{task.boardColumn.name}</span>
                                            )}
                                            {task.tags.map((tag) => (
                                                <span key={tag} className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-indigo-300">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </section>

                        <div className="space-y-6">
                            <section className="space-y-3">
                                <ResultHeader title="Заметки" count={notes.length} />
                                <div className="space-y-2">
                                    {notes.map((note) => (
                                        <article
                                            key={note.id}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => router.push(note.projectId ? `/project/${note.projectId}?tab=notes` : "/inbox?tab=notes")}
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter") {
                                                    router.push(note.projectId ? `/project/${note.projectId}?tab=notes` : "/inbox?tab=notes");
                                                }
                                            }}
                                            className="cursor-pointer rounded-lg border border-amber-500/15 bg-amber-500/[0.08] p-4 transition hover:border-amber-400/40 hover:bg-amber-500/[0.12]"
                                        >
                                            <p className="line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-amber-50/90">
                                                <LinkifiedText
                                                    text={note.content}
                                                    linkClassName="font-semibold text-amber-200 underline decoration-amber-200/50 underline-offset-2"
                                                />
                                            </p>
                                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-amber-100/60">
                                                {note.pinned && <span>на доске</span>}
                                                {note.project && (
                                                    <span className="inline-flex items-center gap-1">
                                                        <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: note.project.color }} />
                                                        {note.project.name}
                                                    </span>
                                                )}
                                                {(note.attachments?.length ?? 0) > 0 && <span>вложения: {note.attachments?.length}</span>}
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            </section>

                            <section className="space-y-3">
                                <ResultHeader title="Проекты" count={projects.length} />
                                <div className="space-y-2">
                                    {projects.map((project) => (
                                        <article
                                            key={project.id}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => router.push(`/project/${project.id}`)}
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter") router.push(`/project/${project.id}`);
                                            }}
                                            className="cursor-pointer rounded-lg border border-slate-800 bg-slate-900/55 p-4 text-left transition hover:border-indigo-500/40 hover:bg-slate-900"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: project.color }} />
                                                <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{project.name}</h2>
                                                {project.completedAt && (
                                                    <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-400">
                                                        завершён
                                                    </span>
                                                )}
                                            </div>
                                            {project.description && (
                                                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-400">
                                                    <LinkifiedText text={project.description} />
                                                </p>
                                            )}
                                            <p className="mt-3 text-xs text-slate-500">
                                                задач: {project._count?.tasks ?? 0}
                                            </p>
                                        </article>
                                    ))}
                                </div>
                            </section>
                        </div>
                    </div>
                )}
            </div>

            {selectedTaskId && (
                <TaskDetailDrawer
                    taskId={selectedTaskId}
                    onClose={() => setSelectedTaskId(null)}
                />
            )}
        </div>
    );
}

function ResultHeader({ title, count }: { title: string; count: number }) {
    return (
        <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold uppercase tracking-wide text-slate-400">{title}</h1>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-500">{count}</span>
        </div>
    );
}
