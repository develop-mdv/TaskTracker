"use client";

import { useState, useMemo, useCallback, memo, useEffect } from "react";
import { formatTasksToText, copyToClipboard, downloadAsFile } from "@/lib/export-utils";
import {
    DndContext,
    DragOverlay,
    closestCenter,
    rectIntersection,
    PointerSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragEndEvent,
    DragOverEvent,
    defaultDropAnimationSideEffects,
    type CollisionDetection,
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
    projectSectionId?: string | null;
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

interface ProjectSection {
    id: string;
    name: string;
    position: number;
}

/* ─── Custom Collision Detection for Matrix Layout ─── */
// Prioritizes droppable cells (sectionId:columnId) for task drags,
// and column headers (col-*) for column drags.
const createKanbanCollisionDetection = (activeType: "task" | "column" | null): CollisionDetection => {
    return (args) => {
        const { droppableContainers } = args;

        if (activeType === "column") {
            // For column dragging, only consider column sortable items
            const columnContainers = droppableContainers.filter(
                (container) => String(container.id).startsWith("col-")
            );
            return closestCenter({ ...args, droppableContainers: columnContainers });
        }

        // For task dragging: prefer cell droppables (sectionId:columnId),
        // fall back to task sortable items
        const cellContainers = droppableContainers.filter(
            (container) => String(container.id).includes(":")
        );
        const taskContainers = droppableContainers.filter(
            (container) => {
                const id = String(container.id);
                return !id.startsWith("col-") && !id.includes(":");
            }
        );

        // First check if we intersect any task items (for reordering within a cell)
        const taskCollisions = rectIntersection({ ...args, droppableContainers: taskContainers });
        if (taskCollisions.length > 0) {
            return taskCollisions;
        }

        // Then check cell droppables (for moving between columns/sections)
        const cellCollisions = closestCenter({ ...args, droppableContainers: cellContainers });
        if (cellCollisions.length > 0) {
            return cellCollisions;
        }

        // Fallback to all containers
        return closestCenter(args);
    };
};

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
        transform: CSS.Translate.toString(transform),
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

/* ─── Kanban Column (Legacy / Simple View) ─── */
// This component is kept for the "no sections" view or "column header" usage.
// We'll refactor it slightly to be reusable.

const ColumnHeader = ({ title, color, count, onDelete, onEdit, onAdd, onCopy, onDownload, dragHandleProps }: any) => {
    return (
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-700/30">
            <div className="flex items-center gap-2 flex-1 min-w-0">
                {dragHandleProps && (
                    <button
                        {...dragHandleProps}
                        className="cursor-grab active:cursor-grabbing p-0.5 rounded text-slate-600 hover:text-slate-400 transition"
                        title="Перетащить колонку"
                    >
                        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
                        </svg>
                    </button>
                )}
                <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color || "#64748b" }}
                />
                <span className="text-sm font-medium text-slate-300 truncate cursor-pointer hover:text-white" onClick={onEdit}>
                    {title}
                </span>
                <span className="text-xs text-slate-600 flex-shrink-0">{count}</span>
            </div>
            <div className="flex items-center gap-0.5">
                {onCopy && (
                    <button onClick={onCopy} className="p-1 rounded text-slate-600 hover:text-indigo-400 hover:bg-slate-800 transition" title="Копировать задачи">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                    </button>
                )}
                {onDownload && (
                    <button onClick={onDownload} className="p-1 rounded text-slate-600 hover:text-indigo-400 hover:bg-slate-800 transition" title="Скачать задачи">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                    </button>
                )}
                {onAdd && (
                    <button onClick={onAdd} className="p-1 rounded text-slate-600 hover:text-indigo-400 hover:bg-slate-800 transition" title="Добавить задачу">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                    </button>
                )}
                {onDelete && (
                    <button onClick={onDelete} className="p-1 rounded text-slate-600 hover:text-red-400 hover:bg-slate-800 transition" title="Удалить колонку">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>
        </div>
    );
};

/* ─── Kanban Cell (for Matrix View) ─── */
// Represents a single intersection of Section x Column
const KanbanCell = memo(function KanbanCell({
    columnId,
    sectionId,
    tasks,
    onSelectTask,
    onAddTask,
    isActiveDropTarget,
    isCreating,
    onCreateSubmit,
    onCreateCancel,
    header, // Optional custom header logic if needed
    onCopy,     // New prop
    onDownload  // New prop
}: {
    columnId: string;
    sectionId: string | null;
    tasks: Task[];
    onSelectTask: (id: string) => void;
    onAddTask: (colId: string) => void;
    isActiveDropTarget: boolean;
    isCreating: boolean;
    onCreateSubmit: (title: string) => void;
    onCreateCancel: () => void;
    header?: React.ReactNode;
    onCopy?: () => void;
    onDownload?: () => void;
}) {
    // Unique ID for droppable: "sectionID:columnID" or "null:columnID"
    const [inlineTitle, setInlineTitle] = useState("");

    // Unique ID for droppable: "sectionID:columnID" or "null:columnID"
    const droppableId = `${sectionId ?? "null"}:${columnId}`;

    const { setNodeRef, isOver } = useDroppable({
        id: droppableId,
        data: { type: "cell", columnId, sectionId }
    });

    const isHighlighted = isOver || isActiveDropTarget;

    return (
        <div
            ref={setNodeRef}
            className={`flex-shrink-0 w-80 flex flex-col rounded-xl bg-slate-900/40 border ${isActiveDropTarget ? "border-indigo-500/50 bg-indigo-500/10" : "border-slate-800/50"
                } transition-colors min-h-[150px]`}
        >
            {/* If we aren't using a global header, we might want per-cell headers? 
                Actually, usually Matrix view has headers on top row only. 
                But for Simple View (no sections), we render ColumnHeader inside the map loop. 
                Wait, let's look at usage. */}

            {/* 
               If this is the top row (or we only have one row), we might render header? 
               In current code (lines 740+), we just render KanbanCell. 
               The ColumnHeader is handled by the "Simple View" branch or separate column branch. 
               
               Wait, the KanbanCell is used inside the sections map for the MAIN detailed view.
               BUT the headers are rendered at the top of the columns SEPARATELY? 
               Checking `renderContent`...
               
               Ah, `sectionsToRender.map(sect => ...)` renders a row per section. 
               And inside that, `columns.map(col => KanbanCell)`.
               
               There are NO column headers inside KanbanCell in this view! 
               The headers are ... wait, where are the headers in Matrix view?
               
               Line 620-660 for Matrix view column headers.
            */}

            {header}

            <div className="p-3 flex-1 flex flex-col gap-3">
                <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                    {tasks.map((task) => (
                        <SortableTaskItem key={task.id} task={task} onSelect={onSelectTask} />
                    ))}
                </SortableContext>

                {isHighlighted && tasks.length === 0 && (
                    <div className="flex items-center justify-center py-6 border-2 border-dashed border-indigo-500/30 rounded-lg text-indigo-400/50 text-xs">
                        Отпустите здесь
                    </div>
                )}

                {/* Inline create form */}
                {isCreating && onCreateSubmit && onCreateCancel && (
                    <div className="mt-auto">
                        <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-2 space-y-2">
                            <input
                                type="text"
                                value={inlineTitle}
                                onChange={(e) => setInlineTitle(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && inlineTitle.trim()) {
                                        onCreateSubmit(inlineTitle.trim());
                                        setInlineTitle("");
                                    }
                                    if (e.key === "Escape") {
                                        setInlineTitle("");
                                        onCreateCancel();
                                    }
                                }}
                                autoFocus
                                placeholder="Название задачи..."
                                className="w-full px-2.5 py-1.5 bg-slate-900/60 border border-slate-600/40 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder-slate-500"
                            />
                            <div className="flex gap-1.5 justify-end">
                                <button
                                    onClick={() => { setInlineTitle(""); onCreateCancel(); }}
                                    className="px-2 py-1 text-xs text-slate-500 hover:text-slate-300 rounded transition"
                                >
                                    Отмена
                                </button>
                                <button
                                    onClick={() => {
                                        if (inlineTitle.trim()) {
                                            onCreateSubmit(inlineTitle.trim());
                                            setInlineTitle("");
                                        }
                                    }}
                                    className="px-2.5 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition"
                                >
                                    Добавить
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Always-visible add task button */}
                {!isCreating && (
                    <button
                        onClick={() => onAddTask(columnId)}
                        className="mt-auto w-full py-1.5 flex items-center justify-center gap-1.5 text-slate-600 hover:text-indigo-400 hover:bg-slate-800/50 rounded-lg transition-all duration-200 text-xs"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span>Добавить</span>
                    </button>
                )}
            </div>
        </div>
    );
});

/* ─── Sortable Column Header (for Matrix View) ─── */
const SortableColumnHeader = memo(function SortableColumnHeader({
    col,
    taskCount,
    onDelete,
    onEdit,
    onAdd,
}: {
    col: Column;
    taskCount: number;
    onDelete: () => void;
    onEdit: () => void;
    onAdd: () => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
        id: `col-${col.id}`,
        data: { type: "column" },
    });
    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} className="w-80 flex-shrink-0">
            <div className="bg-slate-900/50 rounded-xl overflow-hidden">
                <ColumnHeader
                    title={col.name}
                    color={col.color}
                    count={taskCount}
                    onDelete={onDelete}
                    onEdit={onEdit}
                    onAdd={onAdd}
                    dragHandleProps={{ ...attributes, ...listeners }}
                />
            </div>
        </div>
    );
});


/* ─── Kanban Board ─── */
export function KanbanBoard({
    columns,
    tasks,
    projectId,
    section,
    projectSections = [],
}: {
    columns: Column[];
    tasks: Task[];
    projectId?: string;
    section?: string;
    projectSections?: ProjectSection[];
}) {
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeType, setActiveType] = useState<"task" | "column" | null>(null);
    const [overContainerId, setOverContainerId] = useState<string | null>(null);
    const [showCreateInColumn, setShowCreateInColumn] = useState<{ columnId: string; sectionId: string | null } | null>(null);
    const [newColumnName, setNewColumnName] = useState("");

    const utils = trpc.useUtils();

    const moveMut = trpc.tasks.move.useMutation({
        onSuccess: () => utils.tasks.list.invalidate(),
    });

    const reorderColumns = trpc.columns.reorder.useMutation({
        onSuccess: () => utils.columns.list.invalidate(),
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
            // Keep form open for rapid additions — don't close
        },
    });

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    );

    const columnIds = useMemo(() => columns.map((c) => `col-${c.id}`), [columns]);

    // Group tasks
    const getTasks = useCallback((columnId: string, sectionId: string | null) => {
        return tasks.filter(t =>
            t.boardColumnId === columnId &&
            ((sectionId === null && !t.projectSectionId) || t.projectSectionId === sectionId)
        ).sort((a, b) => a.position - b.position);
    }, [tasks]);

    const getTasksByColumn = useCallback(
        (columnId: string) =>
            tasks.filter((t) => t.boardColumnId === columnId).sort((a, b) => a.position - b.position),
        [tasks]
    );

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        setActiveId(active.id as string);
        setActiveType(active.data.current?.type || "task");
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { over } = event;
        if (!over) {
            setOverContainerId(null);
            return;
        }
        setOverContainerId(over.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        setActiveType(null);
        setOverContainerId(null);

        if (!over) return;

        // Column Reorder
        if (activeType === "column") {
            if (active.id === over.id) return;
            const oldIndex = columns.findIndex(c => `col-${c.id}` === active.id);
            const newIndex = columns.findIndex(c => `col-${c.id}` === over.id);
            if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
                const reordered = arrayMove(columns, oldIndex, newIndex);
                reorderColumns.mutate({
                    items: reordered.map((c, i) => ({ id: c.id, position: i })),
                });
            }
            return;
        }

        // Task Move
        // Parse Target
        let targetColumnId: string | null = null;
        let targetSectionId: string | null = null;
        let overId = over.id.toString();

        // Check if over a Container (Cell)
        if (overId.includes(":")) {
            const [sId, cId] = overId.split(":");
            targetSectionId = sId === "null" ? null : sId;
            targetColumnId = cId;
        } else if (overId.startsWith("col-")) {
            // Dropped on a column header?
            targetColumnId = overId.replace("col-", "");
            targetSectionId = null;
        } else {
            // Dropped on a task?
            const overTask = tasks.find(t => t.id === overId);
            if (overTask) {
                targetColumnId = overTask.boardColumnId || null;
                targetSectionId = overTask.projectSectionId || null;
            }
        }

        if (!targetColumnId) return;

        const task = tasks.find(t => t.id === active.id);
        if (!task) return;

        // Simplify position logic: dropped -> end of list (or specific index if detailed impl)
        // Here we just update column/section.

        // Find target list to safe guesstimate position
        const targetTasks = getTasks(targetColumnId, targetSectionId).filter(t => t.id !== task.id);

        let newPosition = targetTasks.length;
        // If dropped on task, insert before it?
        if (!overId.includes(":") && !overId.startsWith("col-")) {
            const overTaskIndex = targetTasks.findIndex(t => t.id === overId);
            if (overTaskIndex >= 0) newPosition = overTaskIndex;
        }

        // Optimistic check: if nothing changed, return
        if (task.boardColumnId === targetColumnId && task.projectSectionId === targetSectionId && task.position === newPosition) return;

        moveMut.mutate({
            id: task.id,
            boardColumnId: targetColumnId,
            projectSectionId: targetSectionId,
            position: newPosition,
        });

        // Optimistic update for "Done" column status
        const targetColumn = columns.find(c => c.id === targetColumnId);
        if (targetColumn) {
            const colName = targetColumn.name.toLowerCase().trim();
            const isDoneColumn = ["done", "completed", "готово", "выполнено", "завершено"].includes(colName);

            // Optimistically update the UI by modifying the query cache
            const queryInput = {
                projectId: projectId || undefined,
                section: (section === "inbox" ? "inbox" : undefined) as "inbox" | undefined
            };

            utils.tasks.list.cancel(queryInput); // Cancel outgoing refetches

            utils.tasks.list.setData(queryInput, (oldData) => {
                if (!oldData) return oldData;
                // oldData is Task[]
                return oldData.map(t => {
                    if (t.id === task.id) {
                        // Update position and column
                        // Also update completion status based on column
                        return {
                            ...t,
                            boardColumnId: targetColumnId,
                            projectSectionId: targetSectionId,
                            position: newPosition, // This is an approximation
                            completedAt: isDoneColumn ? new Date() : (t.boardColumnId !== targetColumnId && t.completedAt ? null : t.completedAt)
                        };
                    }
                    return t;
                });
            });
        }
    };

    const handleMoveColumn = useCallback((columnId: string, direction: -1 | 1) => {
        const idx = columns.findIndex((c) => c.id === columnId);
        const targetIdx = idx + direction;
        if (targetIdx < 0 || targetIdx >= columns.length) return;

        const reordered = arrayMove(columns, idx, targetIdx);
        reorderColumns.mutate({
            items: reordered.map((c, i) => ({ id: c.id, position: i })),
        });
    }, [columns, reorderColumns]);



    const bulkMoveMut = trpc.tasks.bulkMove.useMutation({
        onSuccess: () => utils.tasks.list.invalidate(),
    });

    useEffect(() => {
        if (columns.length === 0) return;
        const firstColId = columns.sort((a, b) => (a.position || 0) - (b.position || 0))[0].id;

        const unallocatedIds = tasks
            .filter(t => !t.boardColumnId && !t.deletedAt && !t.completedAt)
            .map(t => t.id);

        if (unallocatedIds.length > 0) {
            bulkMoveMut.mutate({
                ids: unallocatedIds,
                boardColumnId: firstColId
            });
        }
    }, [tasks.length, columns.length]); // Dep: tasks.length to trigger when tasks load, but avoid loops? 
    // Actually [tasks] might loop if optimistically updated. 
    // But `bulkMove` will set boardColumnId, so they won't be unallocated anymore. Safe.

    // Helper Component for Simple View Column
    const SortableColumn = ({ col, children }: { col: Column, children: React.ReactNode }) => {
        const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
            id: `col-${col.id}`,
            data: { type: "column" },
        });
        const style = {
            transform: CSS.Translate.toString(transform),
            transition,
        };

        return (
            <div ref={setNodeRef} style={style} className="flex flex-col gap-2 h-full">
                {/* Pass attributes/listeners to children via cloneElement or context? 
                     Actually, we can just render the header here if we want?
                     Or we expect children to be the whole column content?
                     
                     Let's make this component responsible for rendering the specific Simple View column structure
                     so we can pass dragHandleProps to the header.
                  */}
                {children}
            </div>
        );
    };

    // Refactored Render Content
    const renderContent = () => {
        // If we have sections, we render Matrix View
        const hasSections = projectSections.length > 0;
        const hasUncategorized = tasks.some(t => !t.projectSectionId);

        const sectionsToRender = [
            ...(hasUncategorized ? [{ id: null, name: "Без секции", position: -1 }] : []),
            ...projectSections
        ];

        // Shared "Add Column" UI
        const AddColumnUI = () => (
            <div className="flex-shrink-0 w-80">
                {newColumnName !== "" ? (
                    <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-700/50">
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
                        className="w-full py-4 border-2 border-dashed border-slate-700/30 rounded-xl text-slate-500 hover:text-slate-300 hover:border-slate-600/50 transition flex items-center justify-center gap-2 text-sm"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Добавить колонку
                    </button>
                )}
            </div>
        );

        if (!hasSections && !hasUncategorized) {
            // Fallback/Legacy View (Single Row / Simple View)
            return (
                <div className="flex gap-4 h-full pb-4 items-start">
                    <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
                        {columns.map(col => {
                            // We need to use a specialized component to hook into useSortable 
                            // AND pass the listeners to the header.
                            return (
                                <SortableSimpleColumn
                                    key={col.id}
                                    col={col}
                                    tasks={getTasks(col.id, null)}
                                    onDelete={() => deleteColumn.mutate({ id: col.id })}
                                    onAdd={() => setShowCreateInColumn({ columnId: col.id, sectionId: null })}
                                    onSelectTask={setSelectedTaskId}
                                    overContainerId={overContainerId}
                                    showCreateInColumn={showCreateInColumn}
                                    createTask={createTask}
                                    projectId={projectId}
                                    section={section}
                                    projectSections={projectSections}
                                    setShowCreateInColumn={setShowCreateInColumn} />
                            );
                        })}
                    </SortableContext>
                    <AddColumnUI />
                </div>
            );
        }

        // Matrix View (With Sections)
        return (
            <div className="flex-1 overflow-x-auto overflow-y-auto pl-4">
                {/* Sticky Header Row for Columns */}
                <div className="sticky top-0 z-20 flex gap-4 pl-6 pb-2 pt-2 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 min-w-max items-start">
                    <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
                        {columns.map(col => (
                            <SortableColumnHeader
                                key={col.id}
                                col={col}
                                taskCount={tasks.filter(t => t.boardColumnId === col.id).length}
                                onDelete={() => deleteColumn.mutate({ id: col.id })}
                                onEdit={() => { /* TODO */ }}
                                onAdd={() => {
                                    const firstSection = sectionsToRender[0];
                                    setShowCreateInColumn({ columnId: col.id, sectionId: firstSection?.id ?? null });
                                }}
                            />
                        ))}
                    </SortableContext>
                    <AddColumnUI />
                </div>

                {/* Swimlanes */}
                {sectionsToRender.map(sect => (
                    <div key={sect.id ?? "uncat"} className="flex flex-col gap-2 mt-4">
                        {/* Section Header */}
                        <div className="sticky left-0 z-10 bg-slate-900/90 backdrop-blur-sm px-4 py-1.5 flex items-center gap-2 border-y border-slate-800 w-full shadow-sm">
                            <h3 className="text-lg font-bold text-white">{sect.name}</h3>
                            <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                                {tasks.filter(t => (sect.id ? t.projectSectionId === sect.id : !t.projectSectionId)).length}
                            </span>
                        </div>

                        {/* Columns Grid */}
                        <div className="flex gap-4 pl-6 min-w-max">
                            {columns.map(col => (
                                <KanbanCell
                                    key={`${sect.id}:${col.id}`}
                                    columnId={col.id}
                                    sectionId={sect.id ?? null}
                                    tasks={getTasks(col.id, sect.id ?? null)}
                                    onSelectTask={setSelectedTaskId}
                                    onAddTask={(colId) => setShowCreateInColumn({ columnId: colId, sectionId: sect.id ?? null })}
                                    isActiveDropTarget={overContainerId === `${sect.id ?? "null"}:${col.id}`}
                                    isCreating={showCreateInColumn?.columnId === col.id && showCreateInColumn?.sectionId === (sect.id ?? null)}
                                    onCreateSubmit={(title) => {
                                        createTask.mutate({
                                            title,
                                            section: projectId ? undefined : (section as "inbox" | undefined),
                                            projectId: projectId || undefined,
                                            boardColumnId: col.id,
                                            projectSectionId: sect.id ?? null,
                                        });
                                    }}
                                    onCreateCancel={() => setShowCreateInColumn(null)}
                                />
                            ))}
                            {/* Spacer to match Add Column button width if needed, or just let it flow */}
                            <div className="w-80 flex-shrink-0" />
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    // Define SortableSimpleColumn component locally to access props/context if needed, 
    // or just pass everything.
    const SortableSimpleColumn = ({
        col, tasks, onDelete, onAdd, onSelectTask, overContainerId,
        showCreateInColumn, createTask, projectId, section, projectSections, setShowCreateInColumn
    }: any) => {
        const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
            id: `col-${col.id}`,
            data: { type: "column" },
        });
        const style = {
            transform: CSS.Translate.toString(transform),
            transition,
        };

        return (
            <div ref={setNodeRef} style={style} className="flex flex-col gap-2 h-full">
                <SortableContext items={tasks.map((t: any) => t.id)} strategy={verticalListSortingStrategy}>
                    <div className="w-80 bg-slate-900/50 rounded-xl flex flex-col max-h-full border border-slate-800/50">
                        <ColumnHeader
                            title={col.name}
                            color={col.color}
                            count={tasks.length}
                            onDelete={onDelete}
                            onEdit={() => {/* TODO */ }}
                            onAdd={onAdd}
                            dragHandleProps={{ ...attributes, ...listeners }}
                            onCopy={() => {
                                const exportable = tasks.map((t: any) => ({
                                    ...t,
                                    section: t.section ? { name: t.section } : null,
                                    projectSection: t.projectSectionId ? { name: projectSections.find((s: any) => s.id === t.projectSectionId)?.name || "Unknown" } : null
                                }));
                                copyToClipboard(formatTasksToText(exportable, col.name));
                                alert("Скопировано!");
                            }}
                            onDownload={() => {
                                const exportable = tasks.map((t: any) => ({
                                    ...t,
                                    section: t.section ? { name: t.section } : null,
                                    projectSection: t.projectSectionId ? { name: projectSections.find((s: any) => s.id === t.projectSectionId)?.name || "Unknown" } : null
                                }));
                                downloadAsFile(formatTasksToText(exportable, col.name), `${col.name}.txt`);
                            }}
                        />
                        <div className="flex-1 overflow-y-auto p-2">
                            <KanbanCell
                                columnId={col.id}
                                sectionId={null}
                                tasks={tasks}
                                onSelectTask={onSelectTask}
                                onAddTask={onAdd}
                                isActiveDropTarget={overContainerId === `null:${col.id}`}
                                isCreating={showCreateInColumn?.columnId === col.id && showCreateInColumn?.sectionId === null}
                                onCreateSubmit={(title: string) => {
                                    createTask.mutate({
                                        title,
                                        section: projectId ? undefined : (section as "inbox" | undefined),
                                        projectId: projectId || undefined,
                                        boardColumnId: col.id,
                                        projectSectionId: null,
                                    });
                                }}
                                onCreateCancel={() => setShowCreateInColumn(null)}
                            />
                        </div>
                    </div>
                </SortableContext>
            </div>
        );
    };

    const KanbanToolbar = ({ onCopy, onDownload }: { onCopy: () => void, onDownload: () => void }) => {
        return (
            <div className="flex items-center justify-end gap-2 mb-4 px-4 py-2 bg-slate-900/40 border border-slate-700/30 rounded-xl backdrop-blur-sm">
                <button
                    onClick={onCopy}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 rounded-lg text-xs text-slate-300 hover:text-white transition group"
                    title="Копировать задачи как текст"
                >
                    <svg className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    <span>Коп. текст</span>
                </button>
                <button
                    onClick={onDownload}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 rounded-lg text-xs text-slate-300 hover:text-white transition group"
                    title="Скачать задачи как файл"
                >
                    <svg className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Скачать</span>
                </button>
            </div>
        );
    };

    // ... existing code ...

    const collisionDetection = useMemo(
        () => createKanbanCollisionDetection(activeType),
        [activeType]
    );

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >

            {renderContent()}

            <DragOverlay dropAnimation={defaultDropAnimation}>
                {activeType === "task" && activeId ? (
                    <div className="w-72"><TaskCard task={tasks.find(t => t.id === activeId)!} isDragging /></div>
                ) : activeType === "column" && activeId ? (
                    <div className="w-80 opacity-80">
                        <div className="bg-slate-800/90 rounded-xl border-2 border-indigo-500/50 shadow-xl shadow-indigo-500/20 p-3">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
                                <span className="text-sm font-medium text-white">
                                    {columns.find(c => `col-${c.id}` === activeId)?.name || "Колонка"}
                                </span>
                            </div>
                        </div>
                    </div>
                ) : null}
            </DragOverlay>

            {selectedTaskId && (
                <TaskDetailDrawer
                    taskId={selectedTaskId}
                    onClose={() => setSelectedTaskId(null)}
                />
            )}


        </DndContext>
    );
}

// Helper for sortable items
function SortableItem({ id, children }: { id: string, children: React.ReactNode }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id, data: { type: "column" } });
    const style = { transform: CSS.Translate.toString(transform), transition };
    return <div ref={setNodeRef} style={style} {...attributes} {...listeners}>{children}</div>;
}

const defaultDropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }),
};

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
