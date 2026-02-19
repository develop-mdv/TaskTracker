import type { Task } from "@prisma/client";

// Define a simplified Task interface if the full Prisma type is too complex or if we need specific optional fields
interface ExportableTask {
    title: string;
    description?: string | null;
    project?: { name: string } | null;
    boardColumn?: { name: string } | null;
    completedAt?: Date | string | null;
    completionNote?: string | null;
}

export function formatTaskToText(task: ExportableTask): string {
    let text = `• ${task.title}`;
    if (task.description) {
        text += `\n  ${task.description.split('\n').join('\n  ')}`;
    }
    if (task.completionNote) {
        text += `\n  [Итог]: ${task.completionNote}`;
    }
    return text;
}

export function formatTasksToText(tasks: ExportableTask[], title?: string): string {
    let text = title ? `# ${title}\n\n` : "";

    if (tasks.length === 0) {
        text += "Нет задач.";
        return text;
    }

    text += tasks.map(formatTaskToText).join("\n\n");
    return text;
}

export async function copyToClipboard(text: string) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
    } else {
        // Fallback
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
        } catch (err) {
            console.error('Unable to copy to clipboard', err);
        }
        document.body.removeChild(textArea);
    }
}

export function downloadAsFile(text: string, filename: string) {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
