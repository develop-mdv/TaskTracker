"use client";

import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { notePreview, splitNoteContent } from "@/lib/note-content";
import {
  NoteEditor,
  type NoteEditorHandle,
  type NoteItem,
} from "@/components/notes/note-editor";
import { CreateNoteModal } from "./create-note-modal";
import { StickyNotesBoard } from "./sticky-notes-board";

export function NotesBoard({
  projectId,
  section,
  title = "Заметки",
}: {
  projectId?: string | null;
  section?: "inbox";
  title?: string;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [allProjects, setAllProjects] = useState(false);
  const [trash, setTrash] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("updated");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileEditor, setMobileEditor] = useState(false);
  const [board, setBoard] = useState(true);
  const editorRef = useRef<NoteEditorHandle>(null);
  const input =
    section === "inbox"
      ? { section, includeProjectNotes: allProjects }
      : { projectId: projectId ?? undefined };
  const {
    data: notes = [],
    isLoading,
    error,
  } = trpc.notes.list.useQuery(input);
  const {
    data: trashed = [],
    isLoading: trashLoading,
    error: trashError,
  } = trpc.notes.listTrashed.useQuery(input, { enabled: trash });
  const source: NoteItem[] = trash ? trashed : notes;
  const normalized = query.trim().toLocaleLowerCase("ru-RU");
  const visible = source
    .filter((note) =>
      `${note.content} ${note.project?.name ?? ""} ${note.attachments?.map((a) => a.filename).join(" ") ?? ""}`
        .toLocaleLowerCase("ru-RU")
        .includes(normalized),
    )
    .sort((a, b) => {
      if (!trash && a.pinned !== b.pinned)
        return Number(b.pinned) - Number(a.pinned);
      if (sort === "title")
        return splitNoteContent(a.content).title.localeCompare(
          splitNoteContent(b.content).title,
          "ru",
        );
      if (sort === "manual") return a.position - b.position;
      return (
        new Date(b.updatedAt ?? b.createdAt).getTime() -
        new Date(a.updatedAt ?? a.createdAt).getTime()
      );
    });
  // Keep the open editor mounted while its own text changes the search results.
  const selected = source.find((note) => note.id === selectedId) ?? visible[0];
  const navigate = async (action: () => void) => {
    if (editorRef.current && !(await editorRef.current.save())) return;
    action();
  };
  const activeError = trash ? trashError : error;
  const loading = trash ? trashLoading : isLoading;
  const groups = trash
    ? [{ title: "Недавно удалённые", items: visible }]
    : [
        { title: "Закреплённые", items: visible.filter((n) => n.pinned) },
        { title: "Все заметки", items: visible.filter((n) => !n.pinned) },
      ];
  const button =
    "min-h-10 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-white";
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-800 px-4 py-3 sm:px-6">
        <div className="mr-auto">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <p className="text-xs text-slate-500">
            {notes.length} заметок · мысли, планы и зарисовки
          </p>
        </div>
        <div className="flex rounded-lg bg-slate-800 p-0.5">
          {[true, false].map((value) => (
            <button
              key={String(value)}
              aria-pressed={board === value}
              className={`rounded-md px-3 py-2 text-xs ${board === value ? "bg-slate-700 text-white" : "text-slate-500"}`}
              onClick={() => void navigate(() => setBoard(value))}
            >
              {value ? "Доска" : "Список"}
            </button>
          ))}
        </div>
        <button
          onClick={() => void navigate(() => setShowCreate(true))}
          className="min-h-10 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-amber-400"
        >
          + Новая заметка
        </button>
      </div>
      {board ? (
        <div className="min-h-0 flex-1">
          <StickyNotesBoard
            projectId={projectId}
            section={section}
            title="Доска"
            onOpenNote={(id) => {
              if (section === "inbox" && !notes.some((note) => note.id === id))
                setAllProjects(true);
              setSelectedId(id);
              setQuery("");
              setBoard(false);
              setMobileEditor(true);
            }}
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <aside
            aria-label="Список заметок"
            className={`${mobileEditor && selected ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col border-r border-slate-800 bg-slate-900/30 md:w-72 lg:w-80 xl:w-96`}
          >
            <div className="space-y-3 p-4">
              <div className="relative">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-2.5 text-slate-500"
                >
                  ⌕
                </span>
                <input
                  aria-label="Поиск заметок"
                  placeholder="Поиск заметок"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="min-h-10 w-full rounded-xl border border-slate-700/60 bg-slate-800/70 py-2 pl-9 pr-8 text-sm text-white outline-none placeholder:text-slate-500 focus:border-amber-500/60"
                />
                {query && (
                  <button
                    aria-label="Очистить поиск"
                    onClick={() => setQuery("")}
                    className="absolute right-2 top-2 text-slate-400"
                  >
                    ✕
                  </button>
                )}
              </div>
              {section === "inbox" && (
                <div className="flex rounded-lg bg-slate-800/60 p-0.5">
                  {[false, true].map((value) => (
                    <button
                      key={String(value)}
                      aria-pressed={allProjects === value}
                      onClick={() =>
                        void navigate(() => {
                          setAllProjects(value);
                          setSelectedId(null);
                          setMobileEditor(false);
                        })
                      }
                      className={`flex-1 rounded-md px-2 py-2 text-xs ${allProjects === value ? "bg-slate-700 text-white" : "text-slate-500"}`}
                    >
                      {value ? "Все проекты" : "Входящие"}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <button
                  aria-pressed={trash}
                  onClick={() =>
                    void navigate(() => {
                      setTrash(!trash);
                      setSelectedId(null);
                      setMobileEditor(false);
                    })
                  }
                  className={`text-xs ${trash ? "text-amber-400" : "text-slate-500 hover:text-slate-300"}`}
                >
                  {trash ? "‹ К заметкам" : "Корзина"}
                </button>
                <select
                  aria-label="Сортировка заметок"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="min-h-8 max-w-44 rounded-lg bg-slate-800 px-2 text-xs text-slate-400"
                >
                  <option value="updated">По изменению</option>
                  <option value="title">По названию</option>
                  <option value="manual">Порядок на доске</option>
                </select>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
              {loading ? (
                <p role="status" className="p-6 text-sm text-slate-500">
                  Загружаю заметки…
                </p>
              ) : activeError ? (
                <p role="alert" className="p-5 text-sm text-red-400">
                  Не удалось загрузить заметки. {activeError.message}
                </p>
              ) : !visible.length ? (
                <div className="px-5 py-12 text-center">
                  <div className="mb-3 text-3xl text-amber-500">
                    {trash ? "⌫" : "✎"}
                  </div>
                  <h3 className="font-medium text-slate-300">
                    {normalized
                      ? "Ничего не найдено"
                      : trash
                        ? "Корзина пуста"
                        : "Место для ваших идей"}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {normalized
                      ? "Попробуйте другое слово или очистите поиск."
                      : trash
                        ? "Удалённые заметки появятся здесь."
                        : "Запишите первую мысль или набросайте её на холсте."}
                  </p>
                  {!trash && !normalized && (
                    <button
                      className={`${button} mt-3 text-amber-400`}
                      onClick={() => setShowCreate(true)}
                    >
                      Создать заметку
                    </button>
                  )}
                </div>
              ) : (
                groups.map(
                  (group) =>
                    group.items.length > 0 && (
                      <div key={group.title} className="mb-4">
                        <h3 className="px-3 pb-2 pt-2 text-xs font-semibold text-slate-500">
                          {group.title}{" "}
                          <span className="ml-1 text-slate-600">
                            {group.items.length}
                          </span>
                        </h3>
                        {group.items.map((note) => {
                          const content = splitNoteContent(note.content);
                          const image = note.attachments?.find((file) =>
                            file.mimeType?.startsWith("image/"),
                          );
                          return (
                            <button
                              key={note.id}
                              aria-current={
                                selected?.id === note.id ? "true" : undefined
                              }
                              onClick={() =>
                                void navigate(() => {
                                  setSelectedId(note.id);
                                  setMobileEditor(true);
                                })
                              }
                              className={`mb-1 flex w-full gap-3 rounded-xl border px-3 py-4 text-left transition ${selected?.id === note.id ? "border-amber-500/20 bg-amber-500/10" : "border-transparent hover:bg-slate-800/70"}`}
                            >
                              <span
                                className="mt-1 h-2 w-2 shrink-0 rounded-full"
                                style={{ background: note.color }}
                              />
                              <div className="min-w-0 flex-1">
                                <h4 className="truncate text-sm font-semibold text-slate-100">
                                  {content.title.trim() || "Без названия"}
                                </h4>
                                <p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-slate-500">
                                  {notePreview(note.content) ||
                                    (image
                                      ? "Зарисовка или картинка"
                                      : "Нет дополнительного текста")}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-x-2 text-[11px] text-slate-600">
                                  <time>
                                    {new Date(
                                      note.updatedAt ?? note.createdAt,
                                    ).toLocaleDateString("ru-RU", {
                                      day: "numeric",
                                      month: "short",
                                    })}
                                  </time>
                                  {allProjects && note.project && (
                                    <span className="max-w-36 truncate">
                                      {note.project.name}
                                    </span>
                                  )}
                                  {!!note.attachments?.length && (
                                    <span>📎 {note.attachments.length}</span>
                                  )}
                                </div>
                              </div>
                              {image && (
                                <img
                                  src={`/api/attachments/${image.id}`}
                                  alt=""
                                  className="h-12 w-12 shrink-0 rounded-lg bg-white object-cover"
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ),
                )
              )}
            </div>
          </aside>
          <div
            onFocusCapture={() => {
              if (selected) setSelectedId(selected.id);
            }}
            className={`${mobileEditor && selected ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}
          >
            {selected ? (
              <NoteEditor
                key={`${selected.id}-${trash}`}
                ref={editorRef}
                note={selected}
                isTrash={trash}
                onBack={() => void navigate(() => setMobileEditor(false))}
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <span className="mb-4 text-5xl text-amber-500/60">✎</span>
                <h3 className="text-xl font-semibold text-slate-300">
                  {trash ? "Корзина" : "Ваши заметки"}
                </h3>
                <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">
                  {trash
                    ? "Выберите заметку, чтобы восстановить её."
                    : "Выберите заметку слева или создайте новую, чтобы сохранить идею."}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      {showCreate && (
        <CreateNoteModal
          projectId={projectId}
          section={section}
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setSelectedId(id);
            setQuery("");
            setTrash(false);
            setMobileEditor(true);
            setBoard(false);
          }}
        />
      )}
    </div>
  );
}
