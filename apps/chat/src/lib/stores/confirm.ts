import { writable } from "svelte/store";

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

export interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  destructive: boolean;
}

const DEFAULT_STATE: ConfirmState = {
  open: false,
  title: "",
  message: "",
  confirmText: "Confirm",
  cancelText: "Cancel",
  destructive: false,
};

function createConfirmStore() {
  const { subscribe, set } = writable<ConfirmState>(DEFAULT_STATE);
  let resolver: ((accepted: boolean) => void) | null = null;

  function resolve(value: boolean): void {
    if (resolver) {
      resolver(value);
      resolver = null;
    }
    set(DEFAULT_STATE);
  }

  async function request(options: ConfirmOptions): Promise<boolean> {
    if (resolver) {
      resolver(false);
      resolver = null;
    }

    set({
      open: true,
      title: options.title ?? "Please confirm",
      message: options.message,
      confirmText: options.confirmText ?? "Confirm",
      cancelText: options.cancelText ?? "Cancel",
      destructive: options.destructive ?? false,
    });

    return new Promise<boolean>((resolvePromise) => {
      resolver = resolvePromise;
    });
  }

  return {
    subscribe,
    request,
    accept() {
      resolve(true);
    },
    reject() {
      resolve(false);
    },
  };
}

export const confirmStore = createConfirmStore();
