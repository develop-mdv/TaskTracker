"use client";

import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { TaskDetailDrawer } from "@/components/task/task-detail-drawer";
import { CreateTaskModal } from "@/components/task/create-task-modal";

// FullCalendar dynamic import to avoid SSR issues
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import ruLocale from "@fullcalendar/core/locales/ru";

export default function CalendarPage() {
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [createDate, setCreateDate] = useState<string | null>(null);

    const utils = trpc.useUtils();

    // Fetch all non-deleted, non-completed tasks with dates
    const { data: tasks = [] } = trpc.tasks.list.useQuery({});

    const updateTask = trpc.tasks.update.useMutation({
        onSuccess: () => utils.tasks.list.invalidate(),
    });

    const events = (tasks as any[])
        .filter((t: any) => t.dueDate || t.startDate)
        .map((task: any) => {
            const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !task.completedAt;
            return {
                id: task.id,
                title: task.title,
                start: task.startDate || task.dueDate,
                end: task.endDate || undefined,
                allDay: true,
                backgroundColor: isOverdue ? "#ef444430" : task.project?.color ? `${task.project.color}30` : "#6366f130",
                borderColor: isOverdue ? "#ef4444" : task.project?.color || "#6366f1",
                textColor: "#e2e8f0",
                extendedProps: { task },
            };
        });

    const handleEventDrop = (info: any) => {
        const taskId = info.event.id;
        const newDate = info.event.start?.toISOString();
        const newEndDate = info.event.end?.toISOString();

        if (newDate) {
            updateTask.mutate({
                id: taskId,
                dueDate: newDate,
                startDate: newDate,
                endDate: newEndDate || null,
            });
        }
    };

    const handleEventResize = (info: any) => {
        const taskId = info.event.id;
        const newEnd = info.event.end?.toISOString();
        if (newEnd) {
            updateTask.mutate({
                id: taskId,
                endDate: newEnd,
            });
        }
    };

    const handleDateClick = (info: any) => {
        setCreateDate(info.dateStr);
        setShowCreate(true);
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
                <h1 className="text-xl font-bold text-white">Календарь</h1>
            </div>

            <div className="flex-1 overflow-auto p-6 calendar-wrapper">
                <FullCalendar
                    plugins={[dayGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    locale={ruLocale}
                    events={events}
                    editable={true}
                    droppable={true}
                    eventDrop={handleEventDrop}
                    eventResize={handleEventResize}
                    dateClick={handleDateClick}
                    eventClick={(info) => setSelectedTaskId(info.event.id)}
                    headerToolbar={{
                        left: "prev,next today",
                        center: "title",
                        right: "dayGridMonth,dayGridWeek",
                    }}
                    height="auto"
                    dayMaxEvents={4}
                    eventDisplay="block"
                />
            </div>

            {selectedTaskId && (
                <TaskDetailDrawer
                    taskId={selectedTaskId}
                    onClose={() => setSelectedTaskId(null)}
                />
            )}

            {showCreate && (
                <CreateTaskModal
                    onClose={() => {
                        setShowCreate(false);
                        setCreateDate(null);
                    }}
                    defaultDueDate={createDate}
                />
            )}
        </div>
    );
}
