import { getHeliaNode } from "$lib/ipfs/node";

declare const $state: <T>(initial: T) => T;
const useState =
  typeof $state === "function" ? $state : <T>(initial: T) => initial;

type NodeStatus = "stopped" | "starting" | "running";

export const nodeStore = useState({
  status: "stopped" as NodeStatus,
  peerId: "",
  peers: [] as string[],
  storage: {
    used: 0,
    total: 0,
  },
});

let pollTimer: ReturnType<typeof setInterval> | null = null;

function startPolling(): void {
  if (pollTimer != null) {
    return;
  }

  pollTimer = setInterval(() => {
    if (nodeStore.status === "running") {
      void refreshPeers();
    }
  }, 30_000);
}

export async function initNode(): Promise<void> {
  if (nodeStore.status === "running") {
    return;
  }

  nodeStore.status = "starting";

  try {
    const node = await getHeliaNode();
    nodeStore.status = "running";
    nodeStore.peerId = node.peerId;
    nodeStore.storage = {
      used: 0,
      total: 0,
    };

    await refreshPeers();
    startPolling();
  } catch (error) {
    nodeStore.status = "stopped";
    nodeStore.peers = [];
    throw error;
  }
}

export async function refreshPeers(): Promise<void> {
  if (nodeStore.status !== "running" && nodeStore.status !== "starting") {
    return;
  }

  const node = await getHeliaNode();
  const peers = node.libp2p
    .getPeers()
    .map((peer: { toString: () => string }) => peer.toString())
    .sort();

  nodeStore.peers = peers;
}
