import { writable } from "svelte/store";

export type ToastKind = "info" | "success" | "error";

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  durationMs: number;
}

const DEFAULT_DURATION_MS = 3000;

function createToastStore() {
  const { subscribe, update, set } = writable<ToastItem[]>([]);
  let nextId = 1;
  const timers = new Map<number, ReturnType<typeof setTimeout>>();

  function dismiss(id: number): void {
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }
    update((items) => items.filter((item) => item.id !== id));
  }

  function push(kind: ToastKind, message: string, durationMs = DEFAULT_DURATION_MS): number {
    const id = nextId++;
    update((items) => [...items, { id, kind, message, durationMs }]);
    const timer = setTimeout(() => dismiss(id), durationMs);
    timers.set(id, timer);
    return id;
  }

  function clear(): void {
    timers.forEach((timer) => clearTimeout(timer));
    timers.clear();
    set([]);
  }

  return {
    subscribe,
    push,
    dismiss,
    clear,
    info(message: string, durationMs?: number): number {
      return push("info", message, durationMs);
    },
    success(message: string, durationMs?: number): number {
      return push("success", message, durationMs);
    },
    error(message: string, durationMs?: number): number {
      return push("error", message, durationMs);
    },
  };
}

export const toastStore = createToastStore();
