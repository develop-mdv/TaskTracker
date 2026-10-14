"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { joinNoteContent, splitNoteContent } from "@/lib/note-content";
import { copyPng, uploadAttachment } from "@/lib/attachments-client";
import { copyToClipboard, downloadAsFile } from "@/lib/export-utils";
import { NoteBodyEditor } from "./note-body";
import { SketchModal } from "./sketch-modal";
import { useNoteAutosave } from "./use-note-autosave";

export type NoteItem = {
  id: string;
  content: string;
  color: string;
  pinned: boolean;
  position: number;
  createdAt: Date | string;
  updatedAt?: Date | string;
  attachments?: {
    id: string;
    filename: string;
    mimeType: string | null;
    size: number | null;
  }[];
  project?: { id: string; name: string; color: string } | null;
};
export const NOTE_COLORS = [
  { value: "#FEF08A", label: "Жёлтый" },
  { value: "#FECDD3", label: "Розовый" },
  { value: "#BAE6FD", label: "Голубой" },
  { value: "#BBF7D0", label: "Зелёный" },
  { value: "#FED7AA", label: "Оранжевый" },
  { value: "#E9D5FF", label: "Лиловый" },
];
export type NoteEditorHandle = { save: () => Promise<boolean> };

export const NoteEditor = forwardRef<
  NoteEditorHandle,
  { note: NoteItem; isTrash?: boolean; onBack: () => void }
>(function NoteEditor({ note, isTrash, onBack }, ref) {
  const utils = trpc.useUtils();
  const update = trpc.notes.update.useMutation();
  const draft = useNoteAutosave(note.id, note.content, async (content) => {
    await update.mutateAsync({
      id: note.id,
      content: content || "Без названия",
    });
    void utils.notes.list.invalidate();
  });
  useImperativeHandle(ref, () => ({ save: draft.save }), [draft.save]);
  const { title, body } = splitNoteContent(draft.content);
  const [sketch, setSketch] = useState<{ initialImage?: string } | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const invalidate = async () => {
    await Promise.all([
      utils.notes.list.invalidate(),
      utils.notes.listTrashed.invalidate(),
    ]);
  };
  const pin = trpc.notes.pin.useMutation({ onSuccess: invalidate });
  const unpin = trpc.notes.unpin.useMutation({ onSuccess: invalidate });
  const remove = trpc.notes.softDelete.useMutation({ onSuccess: invalidate });
  const restore = trpc.notes.restore.useMutation({ onSuccess: invalidate });
  const hardDelete = trpc.notes.hardDelete.useMutation({
    onSuccess: invalidate,
  });
  const deleteAttachment = trpc.attachments.delete.useMutation({
    onSuccess: invalidate,
  });
  const run = async (action: () => Promise<unknown>) => {
    setError("");
    setMessage("");
    try {
      await action();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Не удалось выполнить действие",
      );
    }
  };
  const attach = async (file: File) => {
    await uploadAttachment(file, { noteId: note.id });
    await invalidate();
  };
  const files = async (list: FileList | null) => {
    if (!list?.length) return;
    setUploading(true);
    await run(async () => {
      try {
        for (const file of Array.from(list)) await attach(file);
      } finally {
        await invalidate();
      }
    });
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };
  const button =
    "min-h-10 rounded-lg px-3 py-2 text-sm text-slate-400 transition hover:bg-slate-800 hover:text-amber-300 disabled:opacity-40";
  const busy =
    pin.isPending ||
    unpin.isPending ||
    remove.isPending ||
    restore.isPending ||
    hardDelete.isPending;
  return (
    <section
      className="flex h-full min-h-0 flex-col bg-slate-900/60"
      aria-label="Редактор заметки"
    >
      <header className="flex shrink-0 flex-wrap items-center gap-1 border-b border-slate-800 px-3 py-2 sm:px-5">
        <button className={`${button} md:hidden`} onClick={onBack}>
          ‹ Заметки
        </button>
        <div className="mr-auto text-xs text-slate-500" role="status">
          {isTrash
            ? "В корзине"
            : {
                saved: "Все изменения сохранены",
                changed: "Есть изменения…",
                saving: "Сохраняю…",
                error: "Не удалось сохранить",
              }[draft.status]}
        </div>
        {!isTrash && (
          <>
            <button
              className={button}
              aria-label={
                note.pinned ? "Открепить заметку" : "Закрепить заметку"
              }
              disabled={busy}
              onClick={() =>
                void run(() =>
                  note.pinned
                    ? unpin.mutateAsync({ id: note.id })
                    : pin.mutateAsync({ id: note.id }),
                )
              }
            >
              {note.pinned ? "Открепить" : "Закрепить"}
            </button>
            <button
              className={button}
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              Файл
            </button>
            <button
              className={`${button} text-amber-400`}
              onClick={() => setSketch({})}
            >
              Рисовать
            </button>
            <button
              className={button}
              aria-label="В корзину"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  if (await draft.save())
                    await remove.mutateAsync({ id: note.id });
                })
              }
            >
              Удалить
            </button>
          </>
        )}
        {isTrash && (
          <>
            <button
              className={`${button} text-amber-400`}
              disabled={busy}
              onClick={() =>
                void run(() => restore.mutateAsync({ id: note.id }))
              }
            >
              Восстановить
            </button>
            <button
              className={`${button} text-red-400`}
              onClick={() => setConfirmDelete(true)}
            >
              Удалить навсегда
            </button>
          </>
        )}
      </header>
      {(error || draft.status === "error") && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 border-b border-red-500/20 bg-red-500/10 px-5 py-3 text-sm text-red-300"
        >
          {error ||
            (draft.hasLocalDraft
              ? "Текст ещё не сохранён на сервере. Черновик сохранён в браузере."
              : "Не удалось сохранить текст. Оставьте заметку открытой и повторите сохранение.")}
          {draft.status === "error" && (
            <button className="underline" onClick={() => void draft.save()}>
              Повторить сохранение
            </button>
          )}
        </div>
      )}
      {confirmDelete && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 px-5 py-3 text-sm text-red-300"
        >
          <span>Удалить заметку и вложения навсегда?</span>
          <button
            disabled={busy}
            className={button}
            onClick={() =>
              void run(() => hardDelete.mutateAsync({ id: note.id }))
            }
          >
            Удалить
          </button>
          <button className={button} onClick={() => setConfirmDelete(false)}>
            Отмена
          </button>
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-6 sm:px-8 lg:px-12">
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <time className="text-xs text-slate-500">
              {new Date(note.updatedAt ?? note.createdAt).toLocaleString(
                "ru-RU",
                {
                  day: "numeric",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                },
              )}
            </time>
          </div>
          <input
            aria-label="Заголовок заметки"
            value={title}
            onChange={(e) =>
              draft.change(joinNoteContent(e.target.value, body))
            }
            readOnly={isTrash}
            placeholder="Заголовок"
            style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 700 }}
            className="mb-6 w-full bg-transparent tracking-tight text-white outline-none placeholder:text-slate-600"
          />
          <NoteBodyEditor
            value={body}
            onChange={(value) => draft.change(joinNoteContent(title, value))}
            readOnly={isTrash}
          />
          {!!note.attachments?.length && (
            <div className="mt-6 border-t border-slate-800 pt-5">
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
                Вложения · {note.attachments.length}
              </h3>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {note.attachments.map((file) => (
                  <div
                    key={file.id}
                    className="overflow-hidden rounded-xl border border-slate-700/70 bg-slate-800/30"
                  >
                    {file.mimeType?.startsWith("image/") && (
                      <a
                        href={`/api/attachments/${file.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img
                          src={`/api/attachments/${file.id}`}
                          alt={file.filename}
                          className="max-h-64 w-full bg-white object-contain"
                        />
                      </a>
                    )}
                    <div className="p-3">
                      <p className="truncate text-sm text-slate-300">
                        {file.filename}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs">
                        <a
                          className="py-2 text-amber-400 hover:underline"
                          href={`/api/attachments/${file.id}?download=true`}
                          download={file.filename}
                        >
                          Скачать
                        </a>
                        {file.mimeType === "image/png" && (
                          <button
                            className="py-2 text-slate-400 hover:text-white"
                            onClick={() =>
                              void run(async () => {
                                await copyPng(
                                  fetch(`/api/attachments/${file.id}`).then(
                                    (res) => {
                                      if (!res.ok)
                                        throw new Error(
                                          "Не удалось открыть картинку",
                                        );
                                      return res.blob();
                                    },
                                  ),
                                );
                                setMessage("Картинка скопирована");
                              })
                            }
                          >
                            Копировать
                          </button>
                        )}
                        {!isTrash && file.mimeType?.startsWith("image/") && (
                          <button
                            className="py-2 text-slate-400 hover:text-white"
                            onClick={() =>
                              setSketch({
                                initialImage: `/api/attachments/${file.id}`,
                              })
                            }
                          >
                            Дорисовать
                          </button>
                        )}
                        {!isTrash && (
                          <button
                            disabled={deleteAttachment.isPending}
                            className="py-2 text-red-400"
                            onClick={() => setDeleting(file.id)}
                          >
                            Удалить
                          </button>
                        )}
                        {deleting === file.id && (
                          <>
                            <span className="py-2 text-slate-400">
                              Удалить файл?
                            </span>
                            <button
                              className="py-2 text-red-400"
                              disabled={deleteAttachment.isPending}
                              onClick={() =>
                                void run(async () => {
                                  await deleteAttachment.mutateAsync({
                                    id: file.id,
                                  });
                                  setDeleting(null);
                                })
                              }
                            >
                              Да
                            </button>
                            <button
                              className="py-2 text-slate-400"
                              onClick={() => setDeleting(null)}
                            >
                              Отмена
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!isTrash && (
            <div className="mt-6 flex items-center gap-2 border-t border-slate-800 pt-4">
              <span className="mr-2 text-xs text-slate-500">Цвет</span>
              {NOTE_COLORS.map((item) => (
                <button
                  key={item.value}
                  aria-label={item.label}
                  aria-pressed={note.color === item.value}
                  disabled={update.isPending}
                  onClick={() =>
                    void run(async () => {
                      await update.mutateAsync({
                        id: note.id,
                        color: item.value,
                      });
                      await invalidate();
                    })
                  }
                  className={`h-7 w-7 rounded-full border-2 ${note.color === item.value ? "border-white ring-2 ring-amber-500/40" : "border-transparent"}`}
                  style={{ background: item.value }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <footer className="flex shrink-0 flex-wrap items-center gap-1 border-t border-slate-800 px-4 py-2">
        <span className="mr-auto text-xs text-slate-500">
          {draft.content.length} символов{uploading ? " · Загружаю файлы…" : ""}
        </span>
        {message && (
          <span role="status" className="text-xs text-amber-300">
            {message}
          </span>
        )}
        <button
          className={button}
          onClick={() =>
            void run(async () => {
              await copyToClipboard(draft.content);
              setMessage("Текст скопирован");
            })
          }
        >
          Копировать текст
        </button>
        <button
          className={button}
          onClick={() =>
            downloadAsFile(
              draft.content,
              `${title.replace(/[<>:"/\\|?*]/g, "").slice(0, 80) || "Заметка"}.txt`,
            )
          }
        >
          Скачать
        </button>
      </footer>
      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        aria-label="Прикрепить файлы"
        onChange={(e) => void files(e.target.files)}
      />
      {sketch && (
        <SketchModal
          initialImage={sketch.initialImage}
          onClose={() => setSketch(null)}
          onAttach={attach}
        />
      )}
    </section>
  );
});
