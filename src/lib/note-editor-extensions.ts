import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Markdown } from "@tiptap/markdown";

export function createNoteEditorExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: {
        openOnClick: true,
        defaultProtocol: "https",
        HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
      },
    }),
    TaskList,
    TaskItem.configure({
      nested: true,
      a11y: {
        checkboxLabel: (node) =>
          `Пункт списка: ${node.textContent || "без текста"}`,
      },
    }),
    Markdown.configure({ markedOptions: { gfm: true, breaks: true } }),
  ];
}
