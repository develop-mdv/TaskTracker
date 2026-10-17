export function splitNoteContent(content: string) {
  const newline = content.indexOf("\n");
  return newline === -1
    ? { title: content, body: "" }
    : { title: content.slice(0, newline), body: content.slice(newline + 1) };
}

export function joinNoteContent(title: string, body: string) {
  return `${title}${body ? `\n${body}` : ""}`;
}

export function notePreview(
  content: string,
  { preserveLinks = false }: { preserveLinks?: boolean } = {},
) {
  const preview = splitNoteContent(content)
    .body.replace(/^\s*(?:#{1,3}\s|[-*]\s(?:\[[ xX]\]\s)?|\d+\.\s)/gm, "")
    .replace(/\*\*/g, "");
  if (preserveLinks) return preview.trim();
  return preview.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim();
}
