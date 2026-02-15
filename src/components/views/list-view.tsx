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
    DragOverEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
    arrayMove,
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
    projectSectionId?: string | null;
    boardColumnId?: string | null;
    project?: { id: string; name: string; color: string } | null;
    boardColumn?: { id: string; name: string; color?: string | null } | null;
    _count?: { attachments: number };
}

interface ProjectSection {
    id: string;
    name: string;
    position: number;
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
    } = useSortable({ id: task.id, data: { task } });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition: transition || "transform 200ms cubic-bezier(0.25, 1, 0.5, 1)",
        opacity: isDragging ? 0 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            {isOver && !isDragging && (
                <div className="h-0.5 bg-indigo-500 rounded-full mx-2 mb-1 shadow-[0_0_8px_rgba(99,102,241,0.6)] animate-pulse" />
            )}
            <TaskCard task={task} onClick={() => onSelect(task.id)} isDragging={isDragging} />
        </div>
    );
});

export function ListView({ tasks, projectSections = [] }: { tasks: Task[]; projectSections?: ProjectSection[] }) {
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

    // Group tasks (memoize if needed, but simple filtering is cheap for small lists)
    const hasSections = projectSections.length > 0;

    // Helper to get section ID (treating null/undefined as "uncategorized")
    const getSectionId = (t: Task) => t.projectSectionId ?? "uncategorized";

    const handleDragStart = (event: DragStartEvent) => {
        const task = tasks.find((t) => t.id === event.active.id);
        setActiveTask(task || null);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveTask(null);

        if (!over) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        // If dropped on a container (section), move to that section (end of list)
        // If dropped on a task, reorder relative to that task

        const activeTask = tasks.find((t) => t.id === activeId);
        if (!activeTask) return;

        let newSectionId: string | null = activeTask.projectSectionId ?? null;
        let newIndex = -1;

        // Determine target section and index
        if (projectSections.some((s) => s.id === overId) || overId === "uncategorized") {
            // Dropped on a section header/container
            newSectionId = overId === "uncategorized" ? null : overId;
            // Append to end
            const sectionTasks = tasks.filter((t) => (newSectionId ? t.projectSectionId === newSectionId : !t.projectSectionId));
            newIndex = sectionTasks.length;
        } else {
            // Dropped on another task
            const overTask = tasks.find((t) => t.id === overId);
            if (overTask) {
                newSectionId = overTask.projectSectionId ?? null;
                const sectionTasks = tasks.filter((t) => (newSectionId ? t.projectSectionId === newSectionId : !t.projectSectionId));
                const overIndex = sectionTasks.findIndex((t) => t.id === overId);
                const activeIndex = sectionTasks.findIndex((t) => t.id === activeId);

                if (activeIndex !== -1) {
                    // Same section reorder
                    newIndex = arrayMove(sectionTasks, activeIndex, overIndex).findIndex(t => t.id === activeId); // Simplification, arrayMove returns array, we need index
                    // Logic:
                    // If moving down: newIndex = overIndex
                    // If moving up: newIndex = overIndex
                    // arrayMove handles index shift. 
                    // We just need to know the new order of IDs in this section.
                } else {
                    // Moving into section at specific spot
                    newIndex = overIndex;
                    // If moving from another section, we place it "at" overIndex, pushing others down?
                    // Typically insert before or after. dnd-kit uses collision center.
                    // Let's assume insert at overIndex.
                }
            }
        }

        // Construct new items list for the affected section(s)
        // Actually, we can just calculate the new Order for ALL tasks in the target section

        // This is complex to do perfectly optimistically without a reducer. 
        // Allow simpler approach:
        // 1. Identify target section tasks
        // 2. Insert activeTask into target list at correct position
        // 3. Re-calculate positions for target section
        // 4. Send updates

        const targetSectionId = newSectionId;
        const sourceSectionId = activeTask.projectSectionId ?? null;

        let targetTasks = tasks.filter(t => (targetSectionId ? t.projectSectionId === targetSectionId : !t.projectSectionId));

        // Remove active from source if different (though we just filtered raw tasks, so active might be in targetTasks if src==target)
        if (sourceSectionId === targetSectionId) {
            const oldIndex = targetTasks.findIndex(t => t.id === activeId);
            const overTask = tasks.find(t => t.id === overId);
            const newIndex = overTask ? targetTasks.findIndex(t => t.id === overId) : targetTasks.length; // If dropped on container, end

            if (oldIndex !== newIndex) {
                const newOrder = arrayMove(targetTasks, oldIndex, newIndex);
                reorderMut.mutate({
                    items: newOrder.map((t, i) => ({ id: t.id, position: i, projectSectionId: targetSectionId }))
                });
            }
        } else {
            // Moving between sections
            // Remove from source (implicitly handled by just preparing target list)
            // Add to target

            // New target list:
            // Find insertion index
            let insertIndex = targetTasks.length;
            const overTask = tasks.find(t => t.id === overId);
            if (overTask && (overTask.projectSectionId === targetSectionId || (!overTask.projectSectionId && !targetSectionId))) {
                insertIndex = targetTasks.findIndex(t => t.id === overId);
                // If we drop OVER a task, do we put it before or after? closestCenter implies replace.
                // Let's just use insertIndex.
            }

            const newTargetList = [...targetTasks];
            newTargetList.splice(insertIndex, 0, activeTask);

            reorderMut.mutate({
                items: newTargetList.map((t, i) => ({ id: t.id, position: i, projectSectionId: targetSectionId }))
            });
        }
    };

    if (!hasSections) {
        // Flat list behavior (legacy) with SortableContext
        return (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                        {tasks.map(task => <SortableTaskItem key={task.id} task={task} onSelect={setSelectedTaskId} />)}
                    </div>
                </SortableContext>
                {/* ... Overlay ... */}
                <DragOverlay>{activeTask ? <TaskCard task={activeTask} isDragging /> : null}</DragOverlay>
                {selectedTaskId && <TaskDetailDrawer taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />}
            </DndContext>
        );
    }

    // Render Grouped List
    const sectionsToRender = [
        // Uncategorized if any
        ...(tasks.some(t => !t.projectSectionId) ? [{ id: "uncategorized", name: "Без секции", position: -1 }] : []),
        ...projectSections
    ];

    return (
        <>
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div className="space-y-8 pb-10">
                    {sectionsToRender.map(section => {
                        const sectionId = section.id === "uncategorized" ? null : section.id;
                        const sectionTasks = tasks.filter(t => (sectionId ? t.projectSectionId === sectionId : !t.projectSectionId));

                        return (
                            <div key={section.id} className="space-y-3">
                                <div className="flex items-center gap-2 border-b border-slate-700/50 pb-2">
                                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
                                        {section.name}
                                    </h3>
                                    <span className="text-xs bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full">
                                        {sectionTasks.length}
                                    </span>
                                </div>

                                <SortableContext
                                    id={section.id} // Container ID
                                    items={sectionTasks.map(t => t.id)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    <div className="space-y-2 min-h-[50px]" /* min-height for drop target */>
                                        {sectionTasks.map((task) => (
                                            <SortableTaskItem
                                                key={task.id}
                                                task={task}
                                                onSelect={setSelectedTaskId}
                                            />
                                        ))}
                                        {sectionTasks.length === 0 && (
                                            <div className="h-10 border-2 border-dashed border-slate-800/50 rounded-lg flex items-center justify-center text-xs text-slate-600">
                                                Перетащите задачи сюда
                                            </div>
                                        )}
                                    </div>
                                </SortableContext>
                            </div>
                        );
                    })}
                </div>

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

            {selectedTaskId && (
                <TaskDetailDrawer
                    taskId={selectedTaskId}
                    onClose={() => setSelectedTaskId(null)}
                />
            )}
        </>
    );
}
