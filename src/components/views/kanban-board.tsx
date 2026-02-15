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
    defaultDropAnimationSideEffects,
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

const ColumnHeader = ({ title, color, count, onDelete, onEdit, dragHandleProps }: any) => {
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
                {onDelete && (
                    <button onClick={onDelete} className="p-1 rounded text-slate-600 hover:text-red-400 hover:bg-slate-800 transition">
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
}: {
    columnId: string;
    sectionId: string | null;
    tasks: Task[];
    onSelectTask: (id: string) => void;
    onAddTask: (colId: string) => void;
    isActiveDropTarget: boolean;
}) {
    // Unique ID for droppable: "sectionID:columnID" or "null:columnID"
    const droppableId = `${sectionId ?? "null"}:${columnId}`;

    const { setNodeRef, isOver } = useDroppable({
        id: droppableId,
        data: { type: "cell", columnId, sectionId },
    });

    const isHighlighted = isOver || isActiveDropTarget;

    return (
        <div
            ref={setNodeRef}
            className={`flex-shrink-0 w-72 rounded-xl transition-all duration-200 min-h-[100px] bg-slate-900/40 border border-slate-700/30 ${isHighlighted ? "bg-slate-800/80 ring-2 ring-indigo-500/50" : ""
                }`}
        >
            <div className="p-2 space-y-2 h-full flex flex-col">
                <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                    {tasks.map((task) => (
                        <SortableTaskItem key={task.id} task={task} onSelect={onSelectTask} />
                    ))}
                </SortableContext>

                {tasks.length === 0 && !isHighlighted && (
                    <button
                        onClick={() => onAddTask(columnId)}
                        className="w-full py-2 flex items-center justify-center text-slate-600 hover:text-slate-400 opacity-0 hover:opacity-100 transition"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                    </button>
                )}

                {isHighlighted && tasks.length === 0 && (
                    <div className="flex items-center justify-center py-6 border-2 border-dashed border-indigo-500/30 rounded-lg text-indigo-400/50 text-xs">
                        Отпустите здесь
                    </div>
                )}
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
            setShowCreateInColumn(null); // Close modal
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

    // Render Helper
    const renderContent = () => {
        // If we have sections, we render Matrix View
        const hasSections = projectSections.length > 0;

        const hasUncategorized = tasks.some(t => !t.projectSectionId);

        const sectionsToRender = [
            ...(hasUncategorized ? [{ id: null, name: "Без секции", position: -1 }] : []),
            ...projectSections
        ];

        if (!hasSections && !hasUncategorized) {
            // Fallback/Legacy View (Single Row)
            return (
                <div className="flex gap-4 h-full pb-4">
                    {columns.map(col => (
                        <div key={col.id} className="flex flex-col gap-2">
                            <SortableContext items={[col.id]} id={`col-${col.id}`}>
                                <div className="w-72 bg-slate-900/50 rounded-xl flex flex-col max-h-full">
                                    <ColumnHeader
                                        title={col.name}
                                        color={col.color}
                                        count={getTasks(col.id, null).length}
                                        onDelete={() => deleteColumn.mutate({ id: col.id })}
                                        onEdit={() => {/* TODO: inline edit */ }}
                                        dragHandleProps={{ ...useSortable({ id: `col-${col.id}`, data: { type: "column" } }).attributes, ...useSortable({ id: `col-${col.id}`, data: { type: "column" } }).listeners }}
                                    />
                                    <div className="flex-1 overflow-y-auto p-2">
                                        <KanbanCell
                                            columnId={col.id}
                                            sectionId={null}
                                            tasks={getTasks(col.id, null)}
                                            onSelectTask={setSelectedTaskId}
                                            onAddTask={(colId) => setShowCreateInColumn({ columnId: colId, sectionId: null })}
                                            isActiveDropTarget={overContainerId === `null:${col.id}`}
                                        />
                                    </div>
                                </div>
                            </SortableContext>
                        </div>
                    ))}

                    {/* Add Column Button (Legacy) */}
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
            );
        }

        return (
            <div className="flex flex-col gap-8 pb-10 min-w-fit">
                {/* Header Row (Col Names) */}
                <div className="flex gap-4 sticky top-0 z-20 bg-slate-950/80 backdrop-blur-md py-2 border-b border-slate-800">
                    <div className="w-6 shrink-0" />
                    <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
                        {columns.map(col => (
                            <div key={col.id} className="w-72 px-2">
                                <SortableItem id={`col-${col.id}`}>
                                    <div className="flex items-center gap-2 font-semibold text-slate-300">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color || "#64748b" }} />
                                        {col.name}
                                        <span className="text-xs text-slate-600 ml-auto">{getTasksByColumn(col.id).length}</span>
                                    </div>
                                </SortableItem>
                            </div>
                        ))}
                    </SortableContext>
                </div>

                {/* Swimlanes */}
                {sectionsToRender.map(sect => (
                    <div key={sect.id ?? "uncat"} className="flex flex-col gap-2">
                        {/* Section Header */}
                        <div className="sticky left-0 z-10 bg-slate-950/50 backdrop-blur-sm px-4 py-1 flex items-center gap-2 border-b border-slate-800/50 w-full">
                            <h3 className="text-lg font-bold text-white">{sect.name}</h3>
                            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                                {/* Count tasks in section? */}
                                {tasks.filter(t => (sect.id ? t.projectSectionId === sect.id : !t.projectSectionId)).length}
                            </span>
                        </div>

                        {/* Columns Grid */}
                        <div className="flex gap-4 pl-6">
                            {columns.map(col => (
                                <KanbanCell
                                    key={`${sect.id}:${col.id}`}
                                    columnId={col.id}
                                    sectionId={sect.id ?? null}
                                    tasks={getTasks(col.id, sect.id ?? null)}
                                    onSelectTask={setSelectedTaskId}
                                    onAddTask={(colId) => setShowCreateInColumn({ columnId: colId, sectionId: sect.id ?? null })}
                                    isActiveDropTarget={overContainerId === `${sect.id ?? "null"}:${col.id}`}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            {renderContent()}

            <DragOverlay dropAnimation={defaultDropAnimation}>
                {activeType === "task" ? (
                    <div className="w-72"><TaskCard task={tasks.find(t => t.id === activeId)!} isDragging /></div>
                ) : null}
            </DragOverlay>

            {selectedTaskId && (
                <TaskDetailDrawer
                    taskId={selectedTaskId}
                    onClose={() => setSelectedTaskId(null)}
                />
            )}

            {showCreateInColumn && (
                <QuickCreateInColumn
                    columnId={showCreateInColumn.columnId}
                    projectId={projectId}
                    section={section}
                    onClose={() => setShowCreateInColumn(null)}
                    onCreate={(title) => {
                        createTask.mutate({
                            title,
                            section: projectId ? undefined : (section as "inbox" | undefined),
                            projectId: projectId || undefined,
                            boardColumnId: showCreateInColumn.columnId,
                            projectSectionId: showCreateInColumn.sectionId,
                        });
                    }}
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
