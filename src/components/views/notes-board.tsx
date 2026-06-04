"use client";

import { useState } from "react";
import {
    DndContext,
    DragOverlay,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragEndEvent,
    useDroppable,
} from "@dnd-kit/core";
import {
    SortableContext,
    rectSortingStrategy,
    useSortable,
    arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { trpc } from "@/lib/trpc";
import { NoteCard } from "./note-card";
import { CreateNoteModal } from "./create-note-modal";

type Note = {
    id: string;
    content: string;
    color: string;
    pinned: boolean;
    position: number;
    createdAt: Date | string;
    attachments?: Array<{
        id: string;
        filename: string;
        mimeType: string | null;
        size: number | null;
    }>;
    project?: {
        id: string;
        name: string;
        color: string;
    } | null;
};

interface NotesBoardProps {
    projectId?: string | null;
    section?: "inbox";
    title?: string;
}

// Deterministic pseudo-random rotation based on note id
function getRotation(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = ((hash << 5) - hash) + id.charCodeAt(i);
        hash |= 0;
    }
    return (hash % 5) - 2; // -2 to 2 degrees
}

function SortableNoteItem({
    note,
    rotation,
    showProjectBadge,
    isTrash,
}: {
    note: Note;
    rotation: number;
    showProjectBadge?: boolean;
    isTrash?: boolean;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: note.id, data: { note } });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition: transition || "transform 200ms cubic-bezier(0.25, 1, 0.5, 1)",
    };

    return (
        <NoteCard
            ref={setNodeRef}
            note={note}
            rotation={rotation}
            showProjectBadge={showProjectBadge}
            isTrash={isTrash}
            isDragging={isDragging}
            style={style}
            listeners={listeners}
            attributes={attributes}
        />
    );
}

function DroppableZone({ id, children }: { id: string; children: React.ReactNode }) {
    const { setNodeRef, isOver } = useDroppable({ id });

    return (
        <div
            ref={setNodeRef}
            className={`transition-all duration-200 ${isOver ? "ring-2 ring-amber-500/40 ring-offset-2 ring-offset-slate-900 rounded-2xl" : ""}`}
        >
            {children}
        </div>
    );
}

function StaticZone({ children }: { id: string; children: React.ReactNode }) {
    return <div>{children}</div>;
}

export function NotesBoard({ projectId, section, title = "Доска заметок" }: NotesBoardProps) {
    const [showCreate, setShowCreate] = useState(false);
    const [showTrash, setShowTrash] = useState(false);
    const [activeNote, setActiveNote] = useState<Note | null>(null);
    const [showProjectNotes, setShowProjectNotes] = useState(false);

    const isInbox = section === "inbox";
    const listInput = isInbox
        ? { section: "inbox" as const, includeProjectNotes: showProjectNotes }
        : { projectId: projectId ?? undefined };

    const { data: notes = [], isLoading } = trpc.notes.list.useQuery(listInput);
    const { data: trashedNotes = [] } = trpc.notes.listTrashed.useQuery(
        listInput,
        { enabled: showTrash }
    );

    const utils = trpc.useUtils();
    const reorderMut = trpc.notes.reorder.useMutation({
        onSuccess: () => utils.notes.list.invalidate(),
    });

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 },
        })
    );

    const visibleNotes = notes as Note[];
    const visibleTrashedNotes = trashedNotes as Note[];
    const pinnedNotes = visibleNotes.filter((n) => n.pinned);
    const stackNotes = visibleNotes.filter((n) => !n.pinned);
    const canReorder = !showProjectNotes;
    const showProjectBadge = isInbox && showProjectNotes;
    const Zone = canReorder ? DroppableZone : StaticZone;

    const handleDragStart = (event: DragStartEvent) => {
        const note = visibleNotes.find((n) => n.id === event.active.id);
        setActiveNote(note || null);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveNote(null);

        if (!over) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        const draggedNote = visibleNotes.find((n) => n.id === activeId);
        if (!draggedNote) return;

        const isActiveInPinned = draggedNote.pinned;

        const overNote = visibleNotes.find((n) => n.id === overId);
        const isOverPinnedZone = overId === "zone-pinned";
        const isOverStackZone = overId === "zone-stack";
        const isOverInPinned = overNote ? overNote.pinned : isOverPinnedZone;

        if (isActiveInPinned && (isOverInPinned || isOverPinnedZone)) {
            if (overNote) {
                const oldIndex = pinnedNotes.findIndex((n) => n.id === activeId);
                const newIndex = pinnedNotes.findIndex((n) => n.id === overId);
                if (oldIndex !== newIndex) {
                    const newOrder = arrayMove(pinnedNotes, oldIndex, newIndex);
                    reorderMut.mutate({
                        items: newOrder.map((n, i) => ({ id: n.id, position: i })),
                    });
                }
            }
        } else if (!isActiveInPinned && (!isOverInPinned || isOverStackZone) && !isOverPinnedZone) {
            if (overNote) {
                const oldIndex = stackNotes.findIndex((n) => n.id === activeId);
                const newIndex = stackNotes.findIndex((n) => n.id === overId);
                if (oldIndex !== newIndex) {
                    const newOrder = arrayMove(stackNotes, oldIndex, newIndex);
                    reorderMut.mutate({
                        items: newOrder.map((n, i) => ({ id: n.id, position: i })),
                    });
                }
            }
        } else {
            const movingToPinned = isOverInPinned || isOverPinnedZone;

            if (movingToPinned) {
                const newStackNotes = stackNotes.filter((n) => n.id !== activeId);
                let insertIndex = pinnedNotes.length;
                if (overNote) {
                    insertIndex = pinnedNotes.findIndex((n) => n.id === overId);
                    if (insertIndex === -1) insertIndex = pinnedNotes.length;
                }
                const newPinnedNotes = [...pinnedNotes];
                newPinnedNotes.splice(insertIndex, 0, draggedNote);

                const items = [
                    ...newPinnedNotes.map((n, i) => ({ id: n.id, position: i, pinned: true })),
                    ...newStackNotes.map((n, i) => ({ id: n.id, position: i })),
                ];
                reorderMut.mutate({ items });
            } else {
                const newPinnedNotes = pinnedNotes.filter((n) => n.id !== activeId);
                let insertIndex = stackNotes.length;
                if (overNote) {
                    insertIndex = stackNotes.findIndex((n) => n.id === overId);
                    if (insertIndex === -1) insertIndex = stackNotes.length;
                }
                const newStackNotes = [...stackNotes];
                newStackNotes.splice(insertIndex, 0, draggedNote);

                const items = [
                    ...newPinnedNotes.map((n, i) => ({ id: n.id, position: i })),
                    ...newStackNotes.map((n, i) => ({ id: n.id, position: i, pinned: false })),
                ];
                reorderMut.mutate({ items });
            }
        }
    };

    const renderNotesGrid = (items: Note[], gapClass: string) => {
        const grid = (
            <div className={`grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${gapClass}`}>
                {items.map((note) => (
                    canReorder ? (
                        <SortableNoteItem
                            key={note.id}
                            note={note}
                            rotation={getRotation(note.id)}
                            showProjectBadge={showProjectBadge}
                        />
                    ) : (
                        <NoteCard
                            key={note.id}
                            note={note}
                            rotation={getRotation(note.id)}
                            showProjectBadge={showProjectBadge}
                        />
                    )
                ))}
            </div>
        );

        return canReorder ? (
            <SortableContext items={items.map((note) => note.id)} strategy={rectSortingStrategy}>
                {grid}
            </SortableContext>
        ) : grid;
    };

    const boardContent = (
        <div className="flex gap-6 h-full">
            <div className="flex-1 min-w-0">
                <Zone id="zone-pinned">
                    {pinnedNotes.length > 0 ? (
                        <>
                            <div className="flex items-center gap-2 mb-4">
                                <span className="text-sm font-semibold text-slate-400">На доске</span>
                                <span className="text-xs text-slate-600">{pinnedNotes.length}</span>
                            </div>
                            <div className="cork-board rounded-2xl p-6">
                                {renderNotesGrid(pinnedNotes, "gap-5")}
                            </div>
                        </>
                    ) : stackNotes.length > 0 ? (
                        <div className="cork-board rounded-2xl p-10 flex flex-col items-center justify-center text-center min-h-[200px]">
                            <span className="text-4xl mb-3">📌</span>
                            <p className="text-slate-500 text-sm">
                                Доска пуста. Перетащите заметки из стопки.
                            </p>
                        </div>
                    ) : null}
                </Zone>

                <Zone id="zone-stack">
                    {stackNotes.length > 0 && (
                        <div className="mt-6">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="text-sm font-semibold text-slate-400">Стопка</span>
                                <span className="text-xs text-slate-600">{stackNotes.length}</span>
                            </div>
                            <div className="note-stack">
                                {renderNotesGrid(stackNotes, "gap-4")}
                            </div>
                        </div>
                    )}
                </Zone>
            </div>

            <div className="w-16 flex flex-col items-center justify-end pb-4 shrink-0">
                <button
                    onClick={() => setShowTrash(!showTrash)}
                    className={`
                        w-14 h-14 rounded-2xl flex items-center justify-center transition-all
                        ${showTrash
                            ? "bg-red-500/20 text-red-400 shadow-lg shadow-red-500/10 ring-2 ring-red-500/30"
                            : "bg-slate-800/80 text-slate-500 hover:bg-slate-700 hover:text-slate-300"
                        }
                    `}
                    title="Корзина"
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                    </svg>
                </button>
                {visibleTrashedNotes.length > 0 && (
                    <span className="mt-1 text-xs text-slate-600">{visibleTrashedNotes.length}</span>
                )}
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-700/50">
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-white">{title}</h2>
                    <span className="text-xs text-slate-500 bg-slate-800 rounded-full px-2 py-0.5">
                        {visibleNotes.length}
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    {isInbox && (
                        <div className="flex bg-slate-800 rounded-lg p-0.5">
                            <button
                                onClick={() => setShowProjectNotes(false)}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${!showProjectNotes
                                    ? "bg-amber-500 text-slate-900"
                                    : "text-slate-400 hover:text-white"
                                }`}
                            >
                                Входящие
                            </button>
                            <button
                                onClick={() => setShowProjectNotes(true)}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${showProjectNotes
                                    ? "bg-amber-500 text-slate-900"
                                    : "text-slate-400 hover:text-white"
                                }`}
                            >
                                Все заметки
                            </button>
                        </div>
                    )}

                    <button
                        onClick={() => setShowCreate(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 text-sm rounded-lg font-semibold transition shadow-lg shadow-amber-500/20"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Заметка
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin h-8 w-8 border-2 border-amber-500 border-t-transparent rounded-full" />
                    </div>
                ) : visibleNotes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="text-6xl mb-4">📌</div>
                        <h3 className="text-lg font-semibold text-slate-300 mb-2">Пока нет заметок</h3>
                        <p className="text-sm text-slate-500 max-w-sm">
                            Создайте первую заметку, и она появится как стикер на доске.
                        </p>
                        <button
                            onClick={() => setShowCreate(true)}
                            className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 text-sm rounded-lg font-semibold transition"
                        >
                            Создать заметку
                        </button>
                    </div>
                ) : canReorder ? (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        {boardContent}

                        <DragOverlay dropAnimation={{
                            duration: 200,
                            easing: "cubic-bezier(0.25, 1, 0.5, 1)",
                        }}>
                            {activeNote ? (
                                <NoteCard
                                    note={activeNote}
                                    rotation={getRotation(activeNote.id)}
                                    showProjectBadge={showProjectBadge}
                                    isDragOverlay
                                />
                            ) : null}
                        </DragOverlay>
                    </DndContext>
                ) : (
                    boardContent
                )}

                {showTrash && visibleTrashedNotes.length > 0 && (
                    <div className="mt-6 border-t border-slate-700/50 pt-6">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-sm font-semibold text-red-400">Корзина</span>
                            <span className="text-xs text-slate-600">{visibleTrashedNotes.length}</span>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 opacity-60">
                            {visibleTrashedNotes.map((note) => (
                                <NoteCard
                                    key={note.id}
                                    note={note}
                                    rotation={0}
                                    showProjectBadge={showProjectBadge}
                                    isTrash
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {showCreate && (
                <CreateNoteModal
                    projectId={projectId ?? null}
                    section={isInbox ? "inbox" : undefined}
                    onClose={() => setShowCreate(false)}
                />
            )}
        </div>
    );
}
