"use client";

import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { joinNoteContent } from "@/lib/note-content";
import { uploadAttachment } from "@/lib/attachments-client";
import { NOTE_COLORS } from "@/components/notes/note-editor";
import { NoteBodyEditor } from "@/components/notes/note-body";
import { SketchModal } from "@/components/notes/sketch-modal";

export function CreateNoteModal({
  projectId,
  section,
  onClose,
  onCreated,
}: {
  projectId?: string | null;
  section?: "inbox";
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [color, setColor] = useState("#FEF08A");
  const [pinned, setPinned] = useState(false);
  const [sketch, setSketch] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const createdId = useRef<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const create = trpc.notes.create.useMutation();
  const update = trpc.notes.update.useMutation();
  useEffect(() => {
    dialog.current?.showModal();
    titleRef.current?.focus();
  }, []);
  const close = () => {
    if (busy) return;
    if (title || body || files.length) setConfirmClose(true);
    else onClose();
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const content = joinNoteContent(
        title.trim() ||
          (files.length && !body.trim() ? "Зарисовка" : "Без названия"),
        body,
      );
      if (!createdId.current) {
        const note = await create.mutateAsync({
          projectId: projectId ?? null,
          section,
          content,
          color,
          pinned,
        });
        createdId.current = note.id;
      } else
        await update.mutateAsync({ id: createdId.current, content, color });
      const remaining = [...files];
      while (remaining.length) {
        await uploadAttachment(remaining[0], { noteId: createdId.current });
        remaining.shift();
        setFiles([...remaining]);
      }
      await utils.notes.list.invalidate();
      onCreated?.(createdId.current);
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Не удалось создать заметку",
      );
      void utils.notes.list.invalidate();
    } finally {
      setBusy(false);
    }
  };
  const button =
    "min-h-10 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-40";
  return (
    <>
      <dialog
        ref={dialog}
        aria-labelledby="new-note-title"
        onCancel={(e) => {
          e.preventDefault();
          if (!sketch) close();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            const rect = e.currentTarget.getBoundingClientRect();
            if (
              e.clientX < rect.left ||
              e.clientX > rect.right ||
              e.clientY < rect.top ||
              e.clientY > rect.bottom
            )
              close();
          }
        }}
        className="note-create-dialog m-auto max-h-[90dvh] w-[calc(100%_-_24px)] max-w-2xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 p-0 text-slate-200 shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm"
      >
        <form
          onSubmit={(e) => void submit(e)}
          className="flex max-h-[min(90dvh,calc(var(--app-height)-24px))] flex-col"
        >
          <header className="flex shrink-0 items-center justify-between border-b border-slate-800 px-5 py-3">
            <h2 id="new-note-title" className="font-semibold text-white">
              Новая заметка
            </h2>
            <button
              type="button"
              aria-label="Закрыть"
              className={button}
              disabled={busy}
              onClick={close}
            >
              ✕
            </button>
          </header>
          <div className="min-h-0 overflow-y-auto px-5 py-6 sm:px-8">
            <input
              ref={titleRef}
              autoFocus
              aria-label="Заголовок новой заметки"
              placeholder="Заголовок"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ fontSize: "1.75rem", fontWeight: 700 }}
              className="mb-5 w-full bg-transparent text-white outline-none placeholder:text-slate-600"
            />
            <NoteBodyEditor value={body} onChange={setBody} />
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs text-slate-500">Цвет</span>
              {NOTE_COLORS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  title={item.label}
                  aria-label={item.label}
                  aria-pressed={color === item.value}
                  onClick={() => setColor(item.value)}
                  className={`h-8 w-8 rounded-full border-2 ${color === item.value ? "border-white ring-2 ring-amber-500/40" : "border-transparent"}`}
                  style={{ background: item.value }}
                />
              ))}
              <label className="ml-auto flex items-center gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                  className="h-4 w-4 accent-amber-500"
                />
                Закрепить
              </label>
            </div>
            <div className="mt-5 flex gap-2 border-t border-slate-800 pt-3">
              <button
                type="button"
                className={`${button} text-amber-400`}
                onClick={() => setSketch(true)}
              >
                ✎ Рисовать
              </button>
              <button
                type="button"
                className={button}
                onClick={() => fileRef.current?.click()}
              >
                Прикрепить файл
              </button>
            </div>
            {!!files.length && (
              <ul className="mt-2 space-y-1">
                {files.map((file, i) => (
                  <li
                    key={`${file.name}-${i}`}
                    className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-xs"
                  >
                    <span className="flex-1 truncate">📎 {file.name}</span>
                    <button
                      type="button"
                      aria-label={`Убрать ${file.name}`}
                      disabled={busy}
                      onClick={() =>
                        setFiles(files.filter((_, index) => i !== index))
                      }
                      className="p-2 text-slate-500 hover:text-red-400"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {error && (
              <p role="alert" className="mt-4 text-sm text-red-400">
                {error}
                {createdId.current
                  ? " Текст уже сохранён. Повторите загрузку вложений."
                  : ""}
              </p>
            )}
            {confirmClose && (
              <div role="alert" className="mt-3 text-sm text-amber-300">
                <p>В заметке есть несохранённые изменения.</p>
                <button
                  type="button"
                  className={button}
                  onClick={() => setConfirmClose(false)}
                >
                  Продолжить
                </button>
                <button type="button" className={button} onClick={onClose}>
                  Закрыть без сохранения
                </button>
              </div>
            )}
          </div>
          <footer className="flex shrink-0 items-center justify-between border-t border-slate-800 px-5 py-3">
            <span className="hidden text-xs text-slate-600 sm:block">
              После создания — автосохранение
            </span>
            <button
              type="submit"
              disabled={
                busy || (!title.trim() && !body.trim() && !files.length)
              }
              className="min-h-10 rounded-xl bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-40"
            >
              {busy
                ? "Сохраняю…"
                : createdId.current
                  ? "Повторить"
                  : "Создать заметку"}
            </button>
          </footer>
        </form>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            setFiles((previous) => [
              ...previous,
              ...Array.from(e.target.files ?? []),
            ]);
            e.target.value = "";
          }}
        />
      </dialog>
      {sketch && (
        <SketchModal
          onClose={() => setSketch(false)}
          onAttach={async (file) => {
            setFiles((previous) => [...previous, file]);
          }}
        />
      )}
    </>
  );
}
