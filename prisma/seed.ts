import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEFAULT_COLUMNS = [
  { name: "Идея", position: 0, color: "#a78bfa" },
  { name: "Надо сделать", position: 1, color: "#60a5fa" },
  { name: "В работе", position: 2, color: "#fbbf24" },
  { name: "Тестируется", position: 3, color: "#fb923c" },
  { name: "Готово", position: 4, color: "#34d399" },
];

async function main() {
  const email = process.env.SEED_EMAIL || "admin@tasktracker.local";
  const password = process.env.SEED_PASSWORD || "admin123";

  const passwordHash = await bcrypt.hash(password, 12);

  // Upsert user
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Admin",
      passwordHash,
    },
  });

  console.log(`User created/found: ${user.email} (id: ${user.id})`);

  // Create default inbox columns
  const existingInboxCols = await prisma.boardColumn.findMany({
    where: { section: "inbox", projectId: null },
  });

  if (existingInboxCols.length === 0) {
    for (const col of DEFAULT_COLUMNS) {
      await prisma.boardColumn.create({
        data: {
          name: col.name,
          position: col.position,
          color: col.color,
          section: "inbox",
          projectId: null,
        },
      });
    }
    console.log("Default inbox columns created");
  }

  // Create a sample project
  const existingProject = await prisma.project.findFirst({
    where: { userId: user.id },
  });

  if (!existingProject) {
    const project = await prisma.project.create({
      data: {
        name: "Мой первый проект",
        description: "Пример проекта для начала работы",
        color: "#6366f1",
        position: 0,
        userId: user.id,
      },
    });

    // Create default columns for the project
    for (const col of DEFAULT_COLUMNS) {
      await prisma.boardColumn.create({
        data: {
          name: col.name,
          position: col.position,
          color: col.color,
          projectId: project.id,
        },
      });
    }

    // Create sample tasks
    const columns = await prisma.boardColumn.findMany({
      where: { projectId: project.id },
      orderBy: { position: "asc" },
    });

    await prisma.task.create({
      data: {
        title: "Настроить проект",
        description: "Начальная настройка проекта и окружения",
        priority: 3,
        position: 0,
        projectId: project.id,
        boardColumnId: columns[4]?.id, // "Готово"
        completedAt: new Date(),
        userId: user.id,
      },
    });

    await prisma.task.create({
      data: {
        title: "Добавить задачи",
        description: "Создать задачи для проекта",
        priority: 2,
        position: 0,
        projectId: project.id,
        boardColumnId: columns[1]?.id, // "Надо сделать"
        userId: user.id,
      },
    });

    await prisma.task.create({
      data: {
        title: "Изучить интерфейс",
        description: "Ознакомиться с возможностями таск-трекера",
        priority: 1,
        position: 1,
        projectId: project.id,
        boardColumnId: columns[2]?.id, // "В работе"
        dueDate: new Date(),
        userId: user.id,
      },
    });

    // Create an inbox task
    const inboxCols = await prisma.boardColumn.findMany({
      where: { section: "inbox" },
      orderBy: { position: "asc" },
    });

    await prisma.task.create({
      data: {
        title: "Разобрать входящие",
        description: "Пример задачи во входящих",
        priority: 0,
        position: 0,
        section: "inbox",
        boardColumnId: inboxCols[0]?.id,
        userId: user.id,
      },
    });

    console.log("Sample project and tasks created");
  }

  console.log("Seed completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
