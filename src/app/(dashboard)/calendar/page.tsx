"use client";

import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { TaskDetailDrawer } from "@/components/task/task-detail-drawer";
import { CreateTaskModal } from "@/components/task/create-task-modal";
import { RecurrenceModal } from "@/components/task/recurrence-modal";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { type DateClickArg, type EventResizeDoneArg } from "@fullcalendar/interaction";
import ruLocale from "@fullcalendar/core/locales/ru";
import type { DatesSetArg, EventClickArg, EventDropArg, EventInput } from "@fullcalendar/core";

type CalendarTask = {
    id: string;
    title: string;
    dueDate?: Date | string | null;
    startDate?: Date | string | null;
    endDate?: Date | string | null;
    completedAt?: Date | string | null;
    project?: {
        color?: string | null;
    } | null;
};

type PlannedRecurrence = {
    id: string;
    recurrenceRuleId: string;
    title: string;
    dueAt: Date | string;
    releaseAt: Date | string;
    project?: {
        color?: string | null;
    } | null;
};

type CalendarRange = {
    from: string;
    to: string;
};

export default function CalendarPage() {
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [createDate, setCreateDate] = useState<string | null>(null);
    const [calendarRange, setCalendarRange] = useState<CalendarRange>(() => getInitialCalendarRange());

    const utils = trpc.useUtils();
    const { data: tasks = [] } = trpc.tasks.list.useQuery({});
    const { data: plannedRecurrences = [] } = trpc.recurrence.planned.useQuery(calendarRange);

    const updateTask = trpc.tasks.update.useMutation({
        onSuccess: () => {
            utils.tasks.list.invalidate();
            utils.recurrence.planned.invalidate();
        },
    });

    const events = useMemo<EventInput[]>(() => {
        const taskEvents = (tasks as CalendarTask[])
            .flatMap((task): EventInput[] => {
                const start = task.startDate || task.dueDate;
                if (!start) return [];
                const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !task.completedAt;
                const color = task.project?.color || "#6366f1";

                return [{
                    id: task.id,
                    title: task.title,
                    start,
                    end: task.endDate || undefined,
                    allDay: isAllDayDate(start),
                    backgroundColor: isOverdue ? "#ef444430" : `${color}30`,
                    borderColor: isOverdue ? "#ef4444" : color,
                    textColor: "#e2e8f0",
                    extendedProps: { kind: "task" },
                } satisfies EventInput];
            });

        const plannedEvents = (plannedRecurrences as PlannedRecurrence[]).map((event) => {
            const color = event.project?.color || "#22c55e";
            return {
                id: event.id,
                title: `План: ${event.title}`,
                start: event.dueAt,
                allDay: isAllDayDate(event.dueAt),
                editable: false,
                backgroundColor: `${color}18`,
                borderColor: color,
                textColor: "#bbf7d0",
                classNames: ["planned-recurrence-event"],
                extendedProps: {
                    kind: "planned-recurrence",
                    recurrenceRuleId: event.recurrenceRuleId,
                    releaseAt: event.releaseAt,
                },
            } satisfies EventInput;
        });

        return [...taskEvents, ...plannedEvents];
    }, [plannedRecurrences, tasks]);

    const handleEventDrop = (info: EventDropArg) => {
        if (info.event.extendedProps.kind !== "task") {
            info.revert();
            return;
        }

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

    const handleEventResize = (info: EventResizeDoneArg) => {
        if (info.event.extendedProps.kind !== "task") {
            info.revert();
            return;
        }

        const taskId = info.event.id;
        const newEnd = info.event.end?.toISOString();
        if (newEnd) {
            updateTask.mutate({
                id: taskId,
                endDate: newEnd,
            });
        }
    };

    const handleDateClick = (info: DateClickArg) => {
        setCreateDate(info.dateStr);
        setShowCreate(true);
    };

    const handleEventClick = (info: EventClickArg) => {
        if (info.event.extendedProps.kind === "planned-recurrence") {
            const ruleId = info.event.extendedProps.recurrenceRuleId;
            if (typeof ruleId === "string") setEditingRuleId(ruleId);
            return;
        }

        setSelectedTaskId(info.event.id);
    };

    const handleDatesSet = (info: DatesSetArg) => {
        setCalendarRange({
            from: info.start.toISOString(),
            to: info.end.toISOString(),
        });
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
                    editable
                    droppable
                    eventDrop={handleEventDrop}
                    eventResize={handleEventResize}
                    dateClick={handleDateClick}
                    eventClick={handleEventClick}
                    datesSet={handleDatesSet}
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

            {editingRuleId && (
                <RecurrenceModal
                    editRuleId={editingRuleId}
                    onClose={() => setEditingRuleId(null)}
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

function getInitialCalendarRange(): CalendarRange {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    from.setDate(from.getDate() - 7);

    const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    to.setDate(to.getDate() + 7);

    return {
        from: from.toISOString(),
        to: to.toISOString(),
    };
}

function isAllDayDate(value: Date | string): boolean {
    const date = new Date(value);
    return date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0;
}
