"use client";

import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { createNoteEditorExtensions } from "@/lib/note-editor-extensions";

export function NoteBodyEditor({
  value,
  onChange,
  readOnly = false,
}: {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}) {
  const editor = useEditor({
    extensions: createNoteEditorExtensions(),
    content: value,
    contentType: "markdown",
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: "note-rich-text",
        role: "textbox",
        "aria-label": "Текст заметки",
        "aria-multiline": "true",
        "data-placeholder": "Запишите мысль, план или идею…",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getMarkdown()),
  });
  useEffect(() => {
    if (editor && editor.getMarkdown() !== value)
      editor.commands.setContent(value, {
        contentType: "markdown",
        emitUpdate: false,
      });
  }, [editor, value]);
  useEffect(() => {
    editor?.setEditable(!readOnly, false);
  }, [editor, readOnly]);
  const tools = [
    {
      label: "Aa",
      title: "Заголовок",
      active: editor?.isActive("heading"),
      action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: "B",
      title: "Жирный текст",
      active: editor?.isActive("bold"),
      action: () => editor?.chain().focus().toggleBold().run(),
    },
    {
      label: "• ≡",
      title: "Маркированный список",
      active: editor?.isActive("bulletList"),
      action: () => editor?.chain().focus().toggleBulletList().run(),
    },
    {
      label: "1. ≡",
      title: "Нумерованный список",
      active: editor?.isActive("orderedList"),
      action: () => editor?.chain().focus().toggleOrderedList().run(),
    },
    {
      label: "☑",
      title: "Чек-лист",
      active: editor?.isActive("taskList"),
      action: () => editor?.chain().focus().toggleTaskList().run(),
    },
    {
      label: "↶",
      title: "Отменить изменение",
      active: false,
      action: () => editor?.chain().focus().undo().run(),
    },
    {
      label: "↷",
      title: "Повторить изменение",
      active: false,
      action: () => editor?.chain().focus().redo().run(),
    },
  ];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {!readOnly && (
        <div
          className="mb-4 flex flex-wrap items-center gap-1 rounded-xl border border-slate-700/60 bg-slate-800/50 p-1"
          role="toolbar"
          aria-label="Форматирование заметки"
        >
          {tools.map((tool) => (
            <button
              key={tool.title}
              type="button"
              title={tool.title}
              aria-label={tool.title}
              aria-pressed={tool.active}
              disabled={!editor}
              onMouseDown={(e) => e.preventDefault()}
              onClick={tool.action}
              className={`min-h-10 min-w-10 rounded-lg px-3 font-semibold transition hover:bg-slate-700 hover:text-amber-300 ${tool.active ? "bg-amber-500/10 text-amber-300" : "text-slate-300"}`}
            >
              {tool.label}
            </button>
          ))}
        </div>
      )}
      <EditorContent editor={editor} className="min-h-[260px] flex-1" />
    </div>
  );
}
