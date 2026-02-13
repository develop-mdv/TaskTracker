"use client";

import { useState, useMemo, useCallback, memo } from "react";
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
    horizontalListSortingStrategy,
    useSortable,
    arrayMove,
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
    position?: number;
    _count?: { tasks: number };
}

/* ─── Sortable Task ─── */
const SortableTaskItem = memo(function SortableTaskItem({
    task,
    onSelect,
}: {
    task: Task;
    onSelect: (id: string) => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
        isOver,
    } = useSortable({ id: task.id, data: { type: "task", task } });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition: transition || "transform 200ms cubic-bezier(0.25, 1, 0.5, 1)",
        opacity: isDragging ? 0 : 1,
        zIndex: isDragging ? 50 : undefined,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            {/* Drop indicator line above */}
            {isOver && (
                <div className="h-0.5 bg-indigo-500 rounded-full mx-1 mb-1 shadow-[0_0_8px_rgba(99,102,241,0.6)] animate-pulse" />
            )}
            <TaskCard task={task} onClick={() => onSelect(task.id)} />
        </div>
    );
});

/* ─── Kanban Column (sortable + droppable) ─── */
const KanbanColumn = memo(function KanbanColumn({
    column,
    tasks,
    onSelectTask,
    onAddTask,
    onDeleteColumn,
    onMoveLeft,
    onMoveRight,
    isFirst,
    isLast,
    isActiveDropTarget,
}: {
    column: Column;
    tasks: Task[];
    onSelectTask: (id: string) => void;
    onAddTask: (columnId: string) => void;
    onDeleteColumn: (columnId: string) => void;
    onMoveLeft: () => void;
    onMoveRight: () => void;
    isFirst: boolean;
    isLast: boolean;
    isActiveDropTarget: boolean;
}) {
    const {
        attributes,
        listeners,
        setNodeRef: setSortableRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: `col-${column.id}`, data: { type: "column", columnId: column.id } });

    const { setNodeRef: setDroppableRef, isOver } = useDroppable({
        id: `column-${column.id}`,
        data: { type: "column", columnId: column.id },
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition: transition || "transform 250ms cubic-bezier(0.25, 1, 0.5, 1)",
    };

    const [editingName, setEditingName] = useState(false);
    const [name, setName] = useState(column.name);
    const updateColumn = trpc.columns.update.useMutation();
    const utils = trpc.useUtils();

    const isHighlighted = isOver || isActiveDropTarget;

    return (
        <div
            ref={(node) => {
                setSortableRef(node);
                setDroppableRef(node);
            }}
            style={style}
            className={`flex-shrink-0 w-72 rounded-xl transition-all duration-200 ${isDragging
                    ? "opacity-40 scale-95 rotate-1"
                    : isHighlighted
                        ? "bg-slate-800/80 ring-2 ring-indigo-500/50 shadow-lg shadow-indigo-500/10"
                        : "bg-slate-900/50"
                }`}
        >
            {/* Column header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-700/30">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    {/* Drag handle */}
                    <button
                        {...attributes}
                        {...listeners}
                        className="cursor-grab active:cursor-grabbing p-0.5 rounded text-slate-600 hover:text-slate-400 transition"
                        title="Перетащить колонку"
                    >
                        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
                        </svg>
                    </button>
                    <div
                        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-transform duration-200 ${isHighlighted ? "scale-125" : ""}`}
                        style={{ backgroundColor: column.color || "#64748b" }}
                    />
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

                <div className="flex items-center gap-0.5">
                    {!isFirst && (
                        <button
                            onClick={onMoveLeft}
                            className="p-1 rounded text-slate-600 hover:text-indigo-400 hover:bg-slate-800 transition"
                            title="Переместить влево"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                    )}
                    {!isLast && (
                        <button
                            onClick={onMoveRight}
                            className="p-1 rounded text-slate-600 hover:text-indigo-400 hover:bg-slate-800 transition"
                            title="Переместить вправо"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    )}
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
            <div className={`p-2 space-y-2 min-h-[100px] max-h-[calc(100vh-220px)] overflow-y-auto transition-colors duration-200 ${isHighlighted && tasks.length === 0 ? "bg-indigo-500/5 rounded-b-xl" : ""
                }`}>
                <SortableContext
                    items={tasks.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                >
                    {tasks.map((task) => (
                        <SortableTaskItem key={task.id} task={task} onSelect={onSelectTask} />
                    ))}
                </SortableContext>

                {/* Empty drop zone indicator */}
                {isHighlighted && tasks.length === 0 && (
                    <div className="flex items-center justify-center py-6 border-2 border-dashed border-indigo-500/30 rounded-lg text-indigo-400/50 text-xs">
                        Отпустите задачу здесь
                    </div>
                )}
            </div>
        </div>
    );
});

/* ─── Main KanbanBoard ─── */
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
    const [activeType, setActiveType] = useState<"task" | "column" | null>(null);
    const [overColumnId, setOverColumnId] = useState<string | null>(null);
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

    const reorderColumns = trpc.columns.reorder.useMutation({
        onSuccess: () => utils.columns.list.invalidate(),
    });

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    );

    const getTasksByColumn = useCallback(
        (columnId: string) =>
            tasks.filter((t) => t.boardColumnId === columnId).sort((a, b) => a.position - b.position),
        [tasks]
    );

    const activeTask = activeType === "task" && activeId ? tasks.find((t) => t.id === activeId) : null;
    const activeColumn = activeType === "column" && activeId
        ? columns.find((c) => `col-${c.id}` === activeId)
        : null;

    const columnIds = useMemo(() => columns.map((c) => `col-${c.id}`), [columns]);

    const handleDragStart = useCallback((event: DragStartEvent) => {
        const data = event.active.data.current;
        if (data?.type === "column") {
            setActiveId(event.active.id as string);
            setActiveType("column");
        } else {
            setActiveId(event.active.id as string);
            setActiveType("task");
        }
    }, []);

    const handleDragOver = useCallback((event: DragOverEvent) => {
        const { over } = event;
        if (!over) {
            setOverColumnId(null);
            return;
        }

        // Determine which column we're hovering over
        const overData = over.data.current;
        if (overData?.type === "column") {
            setOverColumnId(overData.columnId);
        } else if (over.id.toString().startsWith("column-")) {
            setOverColumnId(over.id.toString().replace("column-", ""));
        } else if (over.id.toString().startsWith("col-")) {
            setOverColumnId(over.id.toString().replace("col-", ""));
        } else {
            // Over a task — find its column
            const overTask = tasks.find((t) => t.id === over.id);
            setOverColumnId(overTask?.boardColumnId || null);
        }
    }, [tasks]);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        setActiveType(null);
        setOverColumnId(null);

        if (!over) return;

        const activeData = active.data.current;

        // Column reorder
        if (activeData?.type === "column") {
            if (active.id === over.id) return;

            const oldIndex = columns.findIndex((c) => `col-${c.id}` === active.id);
            const overData = over.data.current;

            let newIndex: number;
            if (overData?.type === "column" || over.id.toString().startsWith("col-")) {
                newIndex = columns.findIndex((c) => `col-${c.id}` === over.id);
            } else {
                const overTask = tasks.find((t) => t.id === over.id);
                if (!overTask?.boardColumnId) return;
                newIndex = columns.findIndex((c) => c.id === overTask.boardColumnId);
            }

            if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

            const reordered = arrayMove(columns, oldIndex, newIndex);
            reorderColumns.mutate({
                items: reordered.map((c, i) => ({ id: c.id, position: i })),
            });
            return;
        }

        // Task move
        const taskId = active.id as string;
        let targetColumnId: string | null = null;

        if (over.id.toString().startsWith("col-")) {
            targetColumnId = over.id.toString().replace("col-", "");
        } else if (over.id.toString().startsWith("column-")) {
            targetColumnId = over.id.toString().replace("column-", "");
        } else {
            const overTask = tasks.find((t) => t.id === over.id);
            if (overTask) targetColumnId = overTask.boardColumnId || null;
        }

        if (!targetColumnId) return;

        const task = tasks.find((t) => t.id === taskId);
        if (!task) return;

        if (task.boardColumnId === targetColumnId && active.id === over.id) return;

        const columnTasks = getTasksByColumn(targetColumnId).filter((t) => t.id !== taskId);
        const overIndex = over.id.toString().startsWith("col-") || over.id.toString().startsWith("column-")
            ? columnTasks.length
            : columnTasks.findIndex((t) => t.id === over.id);

        const position = overIndex >= 0 ? overIndex : columnTasks.length;

        moveMut.mutate({
            id: taskId,
            boardColumnId: targetColumnId,
            position,
        });
    }, [columns, tasks, getTasksByColumn, moveMut, reorderColumns]);

    const handleMoveColumn = useCallback((columnId: string, direction: -1 | 1) => {
        const idx = columns.findIndex((c) => c.id === columnId);
        const targetIdx = idx + direction;
        if (targetIdx < 0 || targetIdx >= columns.length) return;

        const reordered = arrayMove(columns, idx, targetIdx);
        reorderColumns.mutate({
            items: reordered.map((c, i) => ({ id: c.id, position: i })),
        });
    }, [columns, reorderColumns]);

    return (
        <>
            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
            >
                <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
                    <div className="flex gap-4 overflow-x-auto pb-4 h-full">
                        {columns.map((column, idx) => (
                            <KanbanColumn
                                key={column.id}
                                column={column}
                                tasks={getTasksByColumn(column.id)}
                                onSelectTask={setSelectedTaskId}
                                onAddTask={(colId) => setShowCreateInColumn(colId)}
                                onDeleteColumn={(id) => deleteColumn.mutate({ id })}
                                onMoveLeft={() => handleMoveColumn(column.id, -1)}
                                onMoveRight={() => handleMoveColumn(column.id, 1)}
                                isFirst={idx === 0}
                                isLast={idx === columns.length - 1}
                                isActiveDropTarget={overColumnId === column.id && activeType === "task"}
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
                </SortableContext>

                {/* Drag overlay — shows the dragged item as a floating card/column */}
                <DragOverlay dropAnimation={{
                    duration: 200,
                    easing: "cubic-bezier(0.25, 1, 0.5, 1)",
                }}>
                    {activeTask ? (
                        <div className="w-72 shadow-2xl shadow-black/50 scale-105">
                            <TaskCard task={activeTask} isDragging />
                        </div>
                    ) : activeColumn ? (
                        <div className="w-72 bg-slate-900/95 rounded-xl border-2 border-indigo-500/60 shadow-2xl shadow-indigo-500/20 p-3 backdrop-blur-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: activeColumn.color || "#64748b" }} />
                                <span className="text-sm font-medium text-white">{activeColumn.name}</span>
                                <span className="text-xs text-slate-500 ml-auto">
                                    {getTasksByColumn(activeColumn.id).length} задач
                                </span>
                            </div>
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
