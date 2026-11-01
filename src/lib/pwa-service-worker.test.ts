import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");

function worker(fullStorage = false) {
  const listeners = new Map<string, (event: unknown) => void>();
  const stored = new Map<string, Response>();
  const deleted: string[] = [];
  const fetched: string[] = [];
  const precached: string[] = [];
  let offline = false;
  let skipWaiting = 0;
  let claimed = false;
  const key = (request: { url: string } | string) => typeof request === "string" ? request : request.url;
  const cache = {
    addAll: async (urls: string[]) => { precached.push(...urls); },
    put: async (request: { url: string }, response: Response) => {
      if (fullStorage) throw new Error("Quota exceeded");
      stored.set(key(request), response);
    },
  };
  runInNewContext(source, {
    URL, Response,
    self: {
      location: { origin: "https://tasks.example" },
      clients: { claim: async () => { claimed = true; } },
      skipWaiting: () => { skipWaiting++; },
      addEventListener: (type: string, listener: (event: unknown) => void) => listeners.set(type, listener),
    },
    caches: {
      open: async () => cache,
      match: async (request: { url: string } | string) => stored.get(key(request)),
      keys: async () => ["tasktracker-public-v0", "tasktracker-public-v1", "another-app"],
      delete: async (name: string) => { deleted.push(name); return true; },
    },
    fetch: async (request: { url: string }) => {
      fetched.push(request.url);
      if (offline) throw new TypeError("Network unavailable");
      // Same-origin browser responses have type basic, unlike Node's constructed responses.
      const response = new Response("network");
      Object.defineProperty(response, "type", { value: "basic" });
      return response;
    },
  });
  const request = (path: string, options: { method?: string; mode?: string; origin?: string } = {}) => {
    let response: Promise<Response> | undefined;
    listeners.get("fetch")!({
      request: { url: `${options.origin ?? "https://tasks.example"}${path}`, method: options.method ?? "GET", mode: options.mode ?? "cors" },
      respondWith: (promise: Promise<Response>) => { response = promise; },
    });
    return response;
  };
  const lifecycle = async (type: string) => {
    let done: Promise<void> | undefined;
    listeners.get(type)!({ waitUntil: (promise: Promise<void>) => { done = promise; } });
    await done;
  };
  return { request, lifecycle, listeners, stored, deleted, fetched, precached, setOffline: () => { offline = true; }, get skipWaiting() { return skipWaiting; }, get claimed() { return claimed; } };
}

test("never intercepts API, auth, private attachments, RSC or writes", () => {
  const app = worker();
  for (const path of ["/api/trpc/tasks.list", "/api/auth/session", "/api/attachments/private-id", "/inbox?_rsc=private", "/project/private-id"]) {
    assert.equal(app.request(path), undefined, path);
  }
  assert.equal(app.request("/_next/static/file.js", { method: "POST" }), undefined);
  assert.equal(app.request("/_next/static/file.js", { origin: "https://other.example" }), undefined);
  assert.equal(app.stored.size, 0);
});

test("online navigations always use the network and never cache private HTML", async () => {
  const app = worker();
  assert.equal(await (await app.request("/inbox", { mode: "navigate" }))!.text(), "network");
  assert.equal(app.stored.size, 0);
});

test("offline navigations return the public fallback without changing the requested URL", async () => {
  const app = worker();
  app.stored.set("/offline.html", new Response("offline screen"));
  app.setOffline();
  assert.equal(await (await app.request("/project/private-id", { mode: "navigate" }))!.text(), "offline screen");
});

test("caches immutable public assets and can serve them offline", async () => {
  const app = worker();
  const path = "/_next/static/chunks/versioned.js";
  assert.equal(await (await app.request(path))!.text(), "network");
  app.setOffline();
  assert.equal(await (await app.request(path))!.text(), "network");
  assert.equal(app.fetched.length, 1);
});

test("install only precaches public files; upgrades wait for explicit user action", async () => {
  const app = worker();
  await app.lifecycle("install");
  assert.ok(app.precached.includes("/offline.html"));
  assert.ok(app.precached.every((path) => path === "/offline.html" || path.startsWith("/icons/")));
  assert.equal(app.skipWaiting, 0);
  app.listeners.get("message")!({ data: { type: "SKIP_WAITING" } });
  assert.equal(app.skipWaiting, 1);
  await app.lifecycle("activate");
  assert.deepEqual(app.deleted, ["tasktracker-public-v0"]);
  assert.equal(app.claimed, true);
});

test("full browser storage does not break loading public scripts from the network", async () => {
  const app = worker(true);
  assert.equal(await (await app.request("/_next/static/chunks/new.js"))!.text(), "network");
});
