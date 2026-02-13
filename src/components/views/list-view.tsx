"use client";

import { useState, memo } from "react";
import {
    DndContext,
    DragOverlay,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragEndEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
    } = useSortable({ id: task.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition: transition || "transform 200ms cubic-bezier(0.25, 1, 0.5, 1)",
        opacity: isDragging ? 0 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            {/* Drop indicator line */}
            {isOver && !isDragging && (
                <div className="h-0.5 bg-indigo-500 rounded-full mx-2 mb-1 shadow-[0_0_8px_rgba(99,102,241,0.6)] animate-pulse" />
            )}
            <TaskCard task={task} onClick={() => onSelect(task.id)} isDragging={isDragging} />
        </div>
    );
});

export function ListView({ tasks }: { tasks: Task[] }) {
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [activeTask, setActiveTask] = useState<Task | null>(null);
    const utils = trpc.useUtils();

    const reorderMut = trpc.tasks.reorder.useMutation({
        onSuccess: () => utils.tasks.list.invalidate(),
    });

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 5 },
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        const task = tasks.find((t) => t.id === event.active.id);
        setActiveTask(task || null);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        setActiveTask(null);
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = tasks.findIndex((t) => t.id === active.id);
        const newIndex = tasks.findIndex((t) => t.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;

        // Calculate new positions
        const items = tasks.map((t, i) => ({
            id: t.id,
            position: i === oldIndex ? newIndex : i < Math.min(oldIndex, newIndex) || i > Math.max(oldIndex, newIndex) ? i : oldIndex < newIndex ? i - 1 : i + 1,
        }));

        reorderMut.mutate({ items });
    };

    return (
        <>
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={tasks.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                >
                    <div className="space-y-2">
                        {tasks.map((task) => (
                            <SortableTaskItem
                                key={task.id}
                                task={task}
                                onSelect={setSelectedTaskId}
                            />
                        ))}
                    </div>
                </SortableContext>

                {/* Drag overlay */}
                <DragOverlay dropAnimation={{
                    duration: 200,
                    easing: "cubic-bezier(0.25, 1, 0.5, 1)",
                }}>
                    {activeTask ? (
                        <div className="shadow-2xl shadow-black/50 scale-[1.02] rounded-lg">
                            <TaskCard task={activeTask} isDragging />
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>

            {tasks.length === 0 && (
                <div className="text-center py-12 text-slate-600">
                    <svg className="w-16 h-16 mx-auto mb-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p>Задач пока нет</p>
                </div>
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
