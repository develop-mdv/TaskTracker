import { TaskView } from "@/components/views/task-view";

export default function TodayPage() {
    return <TaskView title="Сегодня" today showViewToggle={false} />;
}
