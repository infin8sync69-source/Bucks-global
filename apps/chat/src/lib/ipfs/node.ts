import { createHelia } from "helia";
import type { Helia } from "helia";
import { createLibp2p } from "libp2p";
import type { Libp2p } from "libp2p";
import { IDBBlockstore } from "blockstore-idb";
import { IDBDatastore } from "datastore-idb";
import { webSockets } from "@libp2p/websockets";
import { webRTC } from "@libp2p/webrtc";
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { identify } from "@libp2p/identify";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { dcutr } from "@libp2p/dcutr";
import { bootstrap } from "@libp2p/bootstrap";

const BOOTSTRAP_STORAGE_KEY = "bucks-bootstrap-nodes";
const DEFAULT_BOOTSTRAP_NODES = [
  "/dns4/relay.bucks.network/tcp/443/wss/p2p/12D3KooWDpJ7As7BWAwRMfu1VU2WCqNjvq387JEYKDBj4kx6nXTN",
];

export type HeliaNode = {
  helia: Helia;
  libp2p: Libp2p;
  peerId: string;
};

let nodePromise: Promise<HeliaNode> | null = null;

function getBootstrapNodes(): string[] {
  if (typeof localStorage === "undefined") {
    return DEFAULT_BOOTSTRAP_NODES;
  }

  const stored = localStorage.getItem(BOOTSTRAP_STORAGE_KEY);
  if (!stored) return DEFAULT_BOOTSTRAP_NODES;

  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return DEFAULT_BOOTSTRAP_NODES;
    const list = parsed
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter(Boolean);
    return list.length > 0 ? list : DEFAULT_BOOTSTRAP_NODES;
  } catch {
    return DEFAULT_BOOTSTRAP_NODES;
  }
}

async function createNode(): Promise<HeliaNode> {
  const blockstore = new IDBBlockstore("bucks-ipfs-blocks");
  const datastore = new IDBDatastore("bucks-ipfs-data");
  await Promise.all([blockstore.open(), datastore.open()]);

  const libp2p = await createLibp2p({
    transports: [webSockets(), webRTC(), circuitRelayTransport()],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    services: {
      identify: identify() as any,
      pubsub: gossipsub({
        allowPublishToZeroTopicPeers: true,
      }) as any,
      dcutr: dcutr() as any,
    },
    peerDiscovery: [
      bootstrap({
        list: getBootstrapNodes(),
      }) as any,
    ],
  });

  const helia = await createHelia({
    libp2p,
    blockstore,
    datastore,
  });

  return {
    helia,
    libp2p,
    peerId: libp2p.peerId.toString(),
  };
}

export async function getHeliaNode(): Promise<HeliaNode> {
  if (nodePromise == null) {
    nodePromise = createNode().catch((error) => {
      nodePromise = null;
      throw error;
    });
  }
  return nodePromise;
}

// Backward-compatible APIs still used in a few stores/modules.
export async function getHelia(): Promise<Helia> {
  const node = await getHeliaNode();
  return node.helia;
}

export async function getLibp2p(): Promise<Libp2p> {
  const node = await getHeliaNode();
  return node.libp2p;
}
