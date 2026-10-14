export async function uploadAttachment(
  file: File,
  owner: { noteId: string } | { taskId: string },
) {
  if (file.size > 20 * 1024 * 1024)
    throw new Error(`«${file.name}» превышает лимит 20 МБ`);
  const data = new FormData();
  data.append("file", file);
  for (const [key, value] of Object.entries(owner)) data.append(key, value);
  const response = await fetch("/api/attachments/upload", {
    method: "POST",
    body: data,
  });
  if (!response.ok)
    throw new Error(
      "Не удалось прикрепить файл. Проверьте соединение и попробуйте ещё раз.",
    );
  return response.json();
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Не удалось создать картинку")),
      "image/png",
    ),
  );
}

// Pass the promise directly to ClipboardItem to keep Safari's user activation.
export async function copyPng(blob: Promise<Blob>) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error(
      "Этот браузер не поддерживает копирование картинок. Скачайте PNG.",
    );
  }
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
