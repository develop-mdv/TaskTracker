import test from "node:test";
import assert from "node:assert/strict";
import { joinNoteContent, notePreview, splitNoteContent } from "./note-content";
import { MarkdownManager } from "@tiptap/markdown";
import { createNoteEditorExtensions } from "./note-editor-extensions";

test("legacy text round-trips without removing blank lines or spaces", () => {
  for (const content of [
    "Одна строка",
    "Название\n\nТекст\n",
    "Заголовок с пробелом \n- [ ] Пункт",
  ]) {
    const { title, body } = splitNoteContent(content);
    assert.equal(joinNoteContent(title, body), content);
  }
  assert.equal(joinNoteContent("Новый ", "Текст"), "Новый \nТекст");
});

const manager = new MarkdownManager({
  extensions: createNoteEditorExtensions(),
  markedOptions: { gfm: true, breaks: true },
});

test("saving and reopening rich notes preserves headings, bold and checklist states", () => {
  const source =
    "## План\n\n- [ ] Купить хлеб\n- [x] Позвонить\n\n**Важная мысль**";
  const document = manager.parse(source);
  const saved = manager.serialize(document);
  assert.deepEqual(manager.parse(saved), document);
  assert.match(saved, /- \[ \] Купить хлеб/);
  assert.match(saved, /- \[x\] Позвонить/);
  assert.match(saved, /\*\*Важная мысль\*\*/);
});

test("ordinary legacy line breaks survive rich editor serialization", () => {
  const document = manager.parse("Первая строка\nВторая строка\n\nНовый абзац");
  assert.deepEqual(manager.parse(manager.serialize(document)), document);
  assert.equal(document.content?.[0].content?.[1].type, "hardBreak");
});

test("previews remove formatting and keep searchable text", () => {
  assert.equal(
    notePreview("Заголовок\n## План\n- [ ] **Купить хлеб**\n2. Позвонить"),
    "План\nКупить хлеб\nПозвонить",
  );
});
