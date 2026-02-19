import type { Task } from "@prisma/client";

// Define a simplified Task interface if the full Prisma type is too complex or if we need specific optional fields
interface ExportableTask {
    title: string;
    description?: string | null;
    project?: { name: string } | null;
    boardColumn?: { name: string } | null;
    section?: { name: string } | null; // Global section
    projectSection?: { name: string } | null; // Project specific section
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

    // Grouping Logic
    const sections = new Map<string, Map<string, ExportableTask[]>>();

    // Helper to get or create map entries
    const getSection = (name: string) => {
        if (!sections.has(name)) sections.set(name, new Map());
        return sections.get(name)!;
    };

    tasks.forEach(task => {
        // We prioritize section names for grouping
        const sName = task.section?.name ?? task.projectSection?.name ?? "Общие";
        const cName = task.boardColumn?.name ?? "Без колонки";

        const sectionGroup = getSection(sName);
        if (!sectionGroup.has(cName)) sectionGroup.set(cName, []);
        sectionGroup.get(cName)!.push(task);
    });

    // If only one section "Общие" and it has "Без колонки", just list them? 
    // No, let's always be structured if multiple groups exist.

    const sortedSections = Array.from(sections.keys()).sort();

    sortedSections.forEach(sName => {
        if (sortedSections.length > 1 || sName !== "Общие") {
            text += `## ${sName}\n\n`;
        }

        const columns = sections.get(sName)!;
        const sortedColumns = Array.from(columns.keys()).sort();

        sortedColumns.forEach(cName => {
            if (sortedColumns.length > 1 || cName !== "Без колонки") {
                text += `### ${cName}\n`;
            }

            const columnTasks = columns.get(cName)!;
            text += columnTasks.map(t => formatTaskToText(t)).join("\n\n");
            text += "\n\n";
        });
    });

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
