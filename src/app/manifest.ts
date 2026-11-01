import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "TaskTracker — задачи и заметки",
    short_name: "TaskTracker",
    description: "Задачи, проекты, заметки и календарь под рукой",
    lang: "ru",
    start_url: "/inbox",
    scope: "/",
    display: "standalone",
    background_color: "#020617",
    theme_color: "#020617",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Входящие", url: "/inbox" },
      { name: "Сегодня", url: "/today" },
      { name: "Календарь", url: "/calendar" },
    ],
  };
}
