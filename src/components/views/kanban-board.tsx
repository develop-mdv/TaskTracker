"use client";

import { useState } from "react";
import {
    DndContext,
    DragOverlay,
    closestCorners,
    PointerSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragEndEvent,
    DragOverEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { TaskCard } from "../task/task-card";
import { TaskDetailDrawer } from "../task/task-detail-drawer";
import { trpc } from "@/lib/trpc";

interface Task {
    id: string;
    title: string;
    description?: string | null;
    priority: number;
    position: number;
    tags: string[];
    dueDate?: string | Date | null;
    completedAt?: string | Date | null;
    deletedAt?: string | Date | null;
    section?: string | null;
    projectId?: string | null;
    boardColumnId?: string | null;
    project?: { id: string; name: string; color: string } | null;
    boardColumn?: { id: string; name: string; color?: string | null } | null;
    _count?: { attachments: number };
}

interface Column {
    id: string;
    name: string;
    color?: string | null;
    _count?: { tasks: number };
}

function SortableTaskItem({
    task,
    onSelect,
}: {
    task: Task;
    onSelect: (id: string) => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: task.id, data: { type: "task", task } });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <TaskCard task={task} onClick={() => onSelect(task.id)} />
        </div>
    );
}

function KanbanColumn({
    column,
    tasks,
    onSelectTask,
    onAddTask,
    onEditColumn,
    onDeleteColumn,
}: {
    column: Column;
    tasks: Task[];
    onSelectTask: (id: string) => void;
    onAddTask: (columnId: string) => void;
    onEditColumn: (column: Column) => void;
    onDeleteColumn: (columnId: string) => void;
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: `column-${column.id}`,
        data: { type: "column", columnId: column.id },
    });

    const [editingName, setEditingName] = useState(false);
    const [name, setName] = useState(column.name);
    const updateColumn = trpc.columns.update.useMutation();
    const utils = trpc.useUtils();

    return (
        <div
            ref={setNodeRef}
            className={`flex-shrink-0 w-72 bg-slate-850 rounded-xl transition-colors ${isOver ? "bg-slate-800/80 ring-2 ring-indigo-500/30" : "bg-slate-900/50"
                }`}
        >
            {/* Column header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-700/30">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: column.color || "#64748b" }} />
                    {editingName ? (
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onBlur={() => {
                                if (name.trim() && name !== column.name) {
                                    updateColumn.mutate(
                                        { id: column.id, name: name.trim() },
                                        { onSuccess: () => utils.columns.list.invalidate() }
                                    );
                                }
                                setEditingName(false);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                if (e.key === "Escape") { setName(column.name); setEditingName(false); }
                            }}
                            autoFocus
                            className="flex-1 text-sm font-medium bg-transparent text-white outline-none border-b border-indigo-500"
                        />
                    ) : (
                        <span
                            className="text-sm font-medium text-slate-300 truncate cursor-pointer hover:text-white"
                            onDoubleClick={() => setEditingName(true)}
                        >
                            {column.name}
                        </span>
                    )}
                    <span className="text-xs text-slate-600 flex-shrink-0">{tasks.length}</span>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={() => onAddTask(column.id)}
                        className="p-1 rounded text-slate-600 hover:text-indigo-400 hover:bg-slate-800 transition"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                    </button>
                    <button
                        onClick={() => onDeleteColumn(column.id)}
                        className="p-1 rounded text-slate-600 hover:text-red-400 hover:bg-slate-800 transition"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Tasks */}
            <div className="p-2 space-y-2 min-h-[100px] max-h-[calc(100vh-220px)] overflow-y-auto">
                <SortableContext
                    items={tasks.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                >
                    {tasks.map((task) => (
                        <SortableTaskItem key={task.id} task={task} onSelect={onSelectTask} />
                    ))}
                </SortableContext>
            </div>
        </div>
    );
}

export function KanbanBoard({
    columns,
    tasks,
    projectId,
    section,
}: {
    columns: Column[];
    tasks: Task[];
    projectId?: string;
    section?: string;
}) {
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [showCreateInColumn, setShowCreateInColumn] = useState<string | null>(null);
    const [newColumnName, setNewColumnName] = useState("");

    const utils = trpc.useUtils();

    const moveMut = trpc.tasks.move.useMutation({
        onSuccess: () => utils.tasks.list.invalidate(),
    });

    const createColumn = trpc.columns.create.useMutation({
        onSuccess: () => utils.columns.list.invalidate(),
    });

    const deleteColumn = trpc.columns.delete.useMutation({
        onSuccess: () => {
            utils.columns.list.invalidate();
            utils.tasks.list.invalidate();
        },
    });

    const createTask = trpc.tasks.create.useMutation({
        onSuccess: () => {
            utils.tasks.list.invalidate();
            setShowCreateInColumn(null);
        },
    });

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    );

    const getTasksByColumn = (columnId: string) =>
        tasks.filter((t) => t.boardColumnId === columnId).sort((a, b) => a.position - b.position);

    const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragOver = (event: DragOverEvent) => {
        // Handled in dragEnd
    };

    const handleDragEnd = (event: DragEndEvent) => {
        setActiveId(null);
        const { active, over } = event;
        if (!over) return;

        const taskId = active.id as string;
        const overData = over.data.current;

        let targetColumnId: string | null = null;

        if (over.id.toString().startsWith("column-")) {
            targetColumnId = over.id.toString().replace("column-", "");
        } else {
            // Dropped on another task, find its column
            const overTask = tasks.find((t) => t.id === over.id);
            if (overTask) targetColumnId = overTask.boardColumnId || null;
        }

        if (!targetColumnId) return;

        // Get current task
        const task = tasks.find((t) => t.id === taskId);
        if (!task) return;

        // If same column and same position, don't do anything
        if (task.boardColumnId === targetColumnId && active.id === over.id) return;

        // Calculate position
        const columnTasks = getTasksByColumn(targetColumnId).filter((t) => t.id !== taskId);
        const overIndex = over.id.toString().startsWith("column-")
            ? columnTasks.length
            : columnTasks.findIndex((t) => t.id === over.id);

        const position = overIndex >= 0 ? overIndex : columnTasks.length;

        moveMut.mutate({
            id: taskId,
            boardColumnId: targetColumnId,
            position,
        });
    };

    return (
        <>
            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
            >
                <div className="flex gap-4 overflow-x-auto pb-4 h-full">
                    {columns.map((column) => (
                        <KanbanColumn
                            key={column.id}
                            column={column}
                            tasks={getTasksByColumn(column.id)}
                            onSelectTask={setSelectedTaskId}
                            onAddTask={(colId) => setShowCreateInColumn(colId)}
                            onEditColumn={() => { }}
                            onDeleteColumn={(id) => deleteColumn.mutate({ id })}
                        />
                    ))}

                    {/* Add column button */}
                    <div className="flex-shrink-0 w-72">
                        {newColumnName !== "" ? (
                            <div className="bg-slate-900/50 rounded-xl p-3">
                                <input
                                    type="text"
                                    value={newColumnName}
                                    onChange={(e) => setNewColumnName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && newColumnName.trim()) {
                                            createColumn.mutate({
                                                name: newColumnName.trim(),
                                                projectId: projectId || undefined,
                                                section: section || undefined,
                                            });
                                            setNewColumnName("");
                                        }
                                        if (e.key === "Escape") setNewColumnName("");
                                    }}
                                    autoFocus
                                    placeholder="Название колонки"
                                    className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                />
                            </div>
                        ) : (
                            <button
                                onClick={() => setNewColumnName(" ")}
                                className="w-full py-8 border-2 border-dashed border-slate-700/30 rounded-xl text-slate-600 hover:text-slate-400 hover:border-slate-600/50 transition flex items-center justify-center gap-2 text-sm"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Добавить колонку
                            </button>
                        )}
                    </div>
                </div>

                <DragOverlay>
                    {activeTask ? (
                        <div className="w-72 opacity-90 rotate-3">
                            <TaskCard task={activeTask} isDragging />
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>

            {/* Quick create in column */}
            {showCreateInColumn && (
                <QuickCreateInColumn
                    columnId={showCreateInColumn}
                    projectId={projectId}
                    section={section}
                    onClose={() => setShowCreateInColumn(null)}
                    onCreate={(title) => {
                        createTask.mutate({
                            title,
                            section: projectId ? undefined : (section as "inbox" | undefined),
                            projectId: projectId || undefined,
                            boardColumnId: showCreateInColumn,
                        });
                    }}
                />
            )}

            {selectedTaskId && (
                <TaskDetailDrawer
                    taskId={selectedTaskId}
                    onClose={() => setSelectedTaskId(null)}
                />
            )}
        </>
    );
}

function QuickCreateInColumn({
    columnId,
    projectId,
    section,
    onClose,
    onCreate,
}: {
    columnId: string;
    projectId?: string;
    section?: string;
    onClose: () => void;
    onCreate: (title: string) => void;
}) {
    const [title, setTitle] = useState("");

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-4 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && title.trim()) {
                            onCreate(title.trim());
                        }
                        if (e.key === "Escape") onClose();
                    }}
                    autoFocus
                    placeholder="Название задачи"
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
                <div className="flex gap-2 mt-3 justify-end">
                    <button onClick={onClose} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white">
                        Отмена
                    </button>
                    <button
                        onClick={() => title.trim() && onCreate(title.trim())}
                        className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg"
                    >
                        Создать
                    </button>
                </div>
            </div>
        </div>
    );
}
