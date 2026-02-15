"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface ManageSectionsModalProps {
    projectId: string;
    onClose: () => void;
}

interface Section {
    id: string;
    name: string;
    position: number;
}

export function ManageSectionsModal({ projectId, onClose }: ManageSectionsModalProps) {
    const [newSectionName, setNewSectionName] = useState("");
    const utils = trpc.useUtils();

    const { data: project } = trpc.projects.getById.useQuery({ id: projectId });
    // Cast to any to access sections until types are updated
    const sections = (project as any)?.sections ?? [];

    const createSection = trpc.sections.create.useMutation({
        onSuccess: () => utils.projects.getById.invalidate({ id: projectId }),
    });

    const updateSection = trpc.sections.update.useMutation({
        onSuccess: () => utils.projects.getById.invalidate({ id: projectId }),
    });

    const deleteSection = trpc.sections.delete.useMutation({
        onSuccess: () => utils.projects.getById.invalidate({ id: projectId }),
    });

    const reorderSections = trpc.sections.reorder.useMutation({
        onSuccess: () => utils.projects.getById.invalidate({ id: projectId }),
    });

    const handleCreate = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!newSectionName.trim()) return;
        createSection.mutate({
            projectId,
            name: newSectionName.trim(),
        });
        setNewSectionName("");
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = sections.findIndex((s: any) => s.id === active.id);
        const newIndex = sections.findIndex((s: any) => s.id === over.id);

        const newSections = arrayMove(sections, oldIndex, newIndex);

        reorderSections.mutate({
            items: newSections.map((s: any, i: number) => ({ id: s.id, position: i })),
        });
    };

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                    <h2 className="text-lg font-semibold text-white">Управление секциями</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto">
                    {/* Create New */}
                    <form onSubmit={handleCreate} className="flex gap-2 mb-6">
                        <input
                            type="text"
                            value={newSectionName}
                            onChange={(e) => setNewSectionName(e.target.value)}
                            placeholder="Новая секция..."
                            className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        />
                        <button
                            type="submit"
                            disabled={!newSectionName.trim() || createSection.isPending}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-medium transition"
                        >
                            Добавить
                        </button>
                    </form>

                    {/* List */}
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={sections.map((s: any) => s.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="space-y-2">
                                {sections.map((section: any) => (
                                    <SortableSectionItem
                                        key={section.id}
                                        section={section}
                                        onUpdate={(name) => updateSection.mutate({ id: section.id, name })}
                                        onDelete={() => {
                                            if (confirm("Удалить секцию? Задачи останутся в проекте без секции.")) {
                                                deleteSection.mutate({ id: section.id, mode: "MOVE_TO_NONE" });
                                            }
                                        }}
                                    />
                                ))}
                                {sections.length === 0 && (
                                    <div className="text-center text-slate-500 py-4 text-sm">
                                        Секций пока нет
                                    </div>
                                )}
                            </div>
                        </SortableContext>
                    </DndContext>
                </div>
            </div>
        </div>
    );
}

function SortableSectionItem({
    section,
    onUpdate,
    onDelete,
}: {
    section: Section;
    onUpdate: (name: string) => void;
    onDelete: () => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: section.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(section.name);

    const handleSave = () => {
        if (name.trim() && name !== section.name) {
            onUpdate(name.trim());
        }
        setIsEditing(false);
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="flex items-center gap-3 p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg group"
        >
            <button
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400"
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                </svg>
            </button>

            {isEditing ? (
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") handleSave();
                        if (e.key === "Escape") {
                            setName(section.name);
                            setIsEditing(false);
                        }
                    }}
                    autoFocus
                    className="flex-1 bg-slate-900 border border-indigo-500/50 rounded px-2 py-1 text-white text-sm outline-none"
                />
            ) : (
                <span
                    className="flex-1 text-white text-sm font-medium cursor-pointer hover:text-indigo-400 transition"
                    onClick={() => setIsEditing(true)}
                >
                    {section.name}
                </span>
            )}

            <button
                onClick={onDelete}
                className="text-slate-600 hover:text-red-400 transition opacity-0 group-hover:opacity-100"
                title="Удалить"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            </button>
        </div>
    );
}
