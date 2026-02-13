"use client";

import { use } from "react";
import { trpc } from "@/lib/trpc";
import { TaskView } from "@/components/views/task-view";

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { data: project } = trpc.projects.getById.useQuery({ id });

    return (
        <TaskView
            projectId={id}
            title={project?.name ?? "Проект"}
        />
    );
}
