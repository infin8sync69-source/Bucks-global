import { unixfs } from "@helia/unixfs";
import { sha256 } from "@noble/hashes/sha2.js";
import * as ed from "@noble/ed25519";
import { v7 as uuidv7 } from "uuid";
import { getHeliaNode } from "$lib/ipfs/node";
import { openMessageDB } from "$lib/ipfs/orbitdb";
import * as signalStore from "./store";
import type { EncryptedEnvelope, PreKeyBundle } from "./store";

export type ChatMessage = {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: string;
  cid?: string;
  encrypted: boolean;
};

type ConversationSummary = {
  peer_id: string;
  last_message: string;
  timestamp: string;
  unread_count: number;
  encrypted: boolean;
  hasSession: boolean;
};

type MessageEventDetail = {
  topic?: string;
  data?: Uint8Array;
};

type ChatEnvelope = {
  type: "chat_message";
  message_id: string;
  from: string;
  to: string;
  encrypted: EncryptedEnvelope;
  ratchetKey: string;
  counter: number;
  timestamp: number;
  nonce: string;
};

type X3DHInitEnvelope = {
  type: "x3dh_init";
  from: string;
  to: string;
  identityKey: string;
  ephemeralKey: string;
  oneTimePreKeyId: number | null;
  timestamp: number;
};

type BundleEnvelope = {
  type: "prekey_bundle";
  peerId: string;
  bundle: PreKeyBundle;
  timestamp: number;
};

type ChatHistoryResult = {
  history: ChatMessage[];
  sessionInfo: ReturnType<typeof signalStore.getSessionInfo>;
  hasSession: boolean;
};

const DB_NAME = "bucks-chat-engine";
const STORE_NAME = "meta";
const KEY_PEER_BUNDLES = "peer-bundles.json";

const CLUSTER_SECRET =
  ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_BUCKS_CLUSTER_SECRET ??
    "BUCKS_DEFAULT_CLUSTER")
    .trim() || "BUCKS_DEFAULT_CLUSTER";

function topicSuffix(secret: string): string {
  const hash = sha256(new TextEncoder().encode(secret));
  return ed.etc.bytesToHex(hash).slice(0, 16);
}

export const CHAT_TOPIC = `bucks-chat-${topicSuffix(CLUSTER_SECRET)}`;
export const BUNDLE_TOPIC = `bucks-keys-${topicSuffix(CLUSTER_SECRET)}`;

let pubsub: any = null;
let heliaFs: ReturnType<typeof unixfs> | null = null;
let localPeerId = "";
let initialized = false;
let onMessageCallback:
  | ((payload: { peerId: string; message: ChatMessage }) => void)
  | null = null;
let bundlePublishTimer: ReturnType<typeof setInterval> | null = null;

const peerBundles = new Map<string, PreKeyBundle>();
const conversationSummaries = new Map<
  string,
  { unreadCount: number; lastMessage: string; lastTimestamp: string }
>();

function bytesToB64(bytes: Uint8Array): string {
  if (typeof btoa === "function") {
    let binary = "";
    for (const b of bytes) {
      binary += String.fromCharCode(b);
    }
    return btoa(binary);
  }

  const maybeBuffer = (globalThis as { Buffer?: { from: (input: Uint8Array) => { toString: (enc: string) => string } } }).Buffer;
  if (maybeBuffer) {
    return maybeBuffer.from(bytes).toString("base64");
  }

  throw new Error("base64 encoding unavailable");
}

function openMetaDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"));
      return;
    }

    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to open chat metadata store"));
  });
}

async function readMeta<T>(key: string): Promise<T | null> {
  const db = await openMetaDB();
  try {
    const value = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () =>
        reject(req.error ?? new Error(`Failed to read key ${key}`));
    });
    return (value as T | undefined) ?? null;
  } finally {
    db.close();
  }
}

async function writeMeta(key: string, value: unknown): Promise<void> {
  const db = await openMetaDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(tx.error ?? new Error(`Failed to write key ${key}`));
      tx.onabort = () =>
        reject(tx.error ?? new Error(`Write aborted for key ${key}`));
    });
  } finally {
    db.close();
  }
}

async function loadPeerBundles(): Promise<void> {
  const raw = await readMeta<Record<string, PreKeyBundle>>(KEY_PEER_BUNDLES);
  peerBundles.clear();
  if (!raw) {
    return;
  }
  for (const [peerId, bundle] of Object.entries(raw)) {
    peerBundles.set(peerId, bundle);
  }
}

async function savePeerBundles(): Promise<void> {
  const obj: Record<string, PreKeyBundle> = {};
  peerBundles.forEach((bundle, peerId) => {
    obj[peerId] = bundle;
  });
  await writeMeta(KEY_PEER_BUNDLES, obj);
}

function getMessageData(detail: MessageEventDetail): Uint8Array | null {
  if (detail?.data instanceof Uint8Array) {
    return detail.data;
  }
  return null;
}

async function publishPreKeyBundle(): Promise<void> {
  if (!pubsub || !localPeerId) {
    return;
  }

  const message: BundleEnvelope = {
    type: "prekey_bundle",
    peerId: localPeerId,
    bundle: signalStore.getPreKeyBundle(),
    timestamp: Date.now(),
  };

  const encoded = new TextEncoder().encode(JSON.stringify(message));
  try {
    await pubsub.publish(BUNDLE_TOPIC, encoded);
  } catch {
    // Ignore publish failures when no peers are connected.
  }
}

async function addToConversation(
  peerId: string,
  message: ChatMessage,
  incrementUnread: boolean
): Promise<void> {
  const db = (await openMessageDB(peerId)) as unknown as {
    add: (value: ChatMessage) => Promise<void>;
  };
  await db.add(message);

  const existing =
    conversationSummaries.get(peerId) ??
    ({
      unreadCount: 0,
      lastMessage: "",
      lastTimestamp: "",
    } as const);

  conversationSummaries.set(peerId, {
    unreadCount: incrementUnread ? existing.unreadCount + 1 : existing.unreadCount,
    lastMessage: message.content || "📎 Attachment",
    lastTimestamp: message.timestamp,
  });
}

async function handleBundleMessage(detail: MessageEventDetail): Promise<void> {
  const data = getMessageData(detail);
  if (!data) {
    return;
  }

  try {
    const parsed = JSON.parse(new TextDecoder().decode(data)) as BundleEnvelope;
    if (parsed.type !== "prekey_bundle") {
      return;
    }
    if (parsed.peerId === localPeerId) {
      return;
    }
    peerBundles.set(parsed.peerId, parsed.bundle);
    await savePeerBundles();
  } catch {
    // Ignore malformed bundle messages.
  }
}

async function handleX3DHInit(data: X3DHInitEnvelope): Promise<void> {
  if (data.to !== localPeerId || data.from === localPeerId) {
    return;
  }
  if (signalStore.hasSession(data.from)) {
    return;
  }

  const sharedSecret = await signalStore.respondX3DH(
    data.identityKey,
    data.ephemeralKey,
    data.oneTimePreKeyId ?? null
  );
  await signalStore.createSession(data.from, sharedSecret, false);
}

async function handleChatMessage(detail: MessageEventDetail): Promise<void> {
  const raw = getMessageData(detail);
  if (!raw) {
    return;
  }

  try {
    const parsed = JSON.parse(new TextDecoder().decode(raw)) as
      | ChatEnvelope
      | X3DHInitEnvelope;

    if (parsed.type === "x3dh_init") {
      await handleX3DHInit(parsed);
      return;
    }

    if (parsed.type !== "chat_message") {
      return;
    }
    if (parsed.to !== localPeerId || parsed.from === localPeerId) {
      return;
    }

    const plaintext = await signalStore.decryptMessage(parsed.from, {
      encrypted: parsed.encrypted,
      ratchetKey: parsed.ratchetKey,
      counter: parsed.counter,
    });
    if (plaintext == null) {
      return;
    }

    let payload: { text?: string; attachmentCid?: string | null };
    try {
      payload = JSON.parse(plaintext) as { text?: string; attachmentCid?: string | null };
    } catch {
      payload = { text: plaintext, attachmentCid: null };
    }

    const localMessage: ChatMessage = {
      id: parsed.message_id || uuidv7(),
      from: parsed.from,
      to: parsed.to,
      content: payload.text ?? "",
      timestamp: new Date(parsed.timestamp).toISOString(),
      cid: payload.attachmentCid ?? undefined,
      encrypted: true,
    };

    await addToConversation(parsed.from, localMessage, true);

    if (onMessageCallback) {
      onMessageCallback({ peerId: parsed.from, message: localMessage });
    }
  } catch {
    // Ignore malformed or undecryptable messages.
  }
}

export async function initChat(): Promise<void> {
  if (initialized) {
    return;
  }

  const node = await getHeliaNode();
  localPeerId = node.peerId;
  heliaFs = unixfs(node.helia);
  pubsub = (node.libp2p as any)?.services?.pubsub;

  if (!pubsub) {
    throw new Error("Gossipsub is not available on the Helia libp2p node");
  }

  await signalStore.initStore();
  await loadPeerBundles();

  pubsub.addEventListener("message", (evt: CustomEvent<MessageEventDetail>) => {
    const topic = evt.detail?.topic;
    if (topic === CHAT_TOPIC) {
      void handleChatMessage(evt.detail);
    } else if (topic === BUNDLE_TOPIC) {
      void handleBundleMessage(evt.detail);
    }
  });

  await Promise.all([pubsub.subscribe(CHAT_TOPIC), pubsub.subscribe(BUNDLE_TOPIC)]);
  await publishPreKeyBundle();

  if (bundlePublishTimer == null) {
    bundlePublishTimer = setInterval(() => {
      void publishPreKeyBundle();
    }, 30_000);
  }

  initialized = true;
}

export async function sendMessage(
  peerId: string,
  text: string,
  attachmentCid: string | null = null
): Promise<{ success: boolean; error?: string }> {
  if (!initialized || !pubsub) {
    return { success: false, error: "Chat engine not initialized" };
  }

  if (!signalStore.hasSession(peerId)) {
    const bundle = peerBundles.get(peerId);
    if (!bundle) {
      return {
        success: false,
        error: "No key bundle available for this peer. They may be offline.",
      };
    }

    const { sharedSecret, ephemeralPublicKey } = signalStore.performX3DH(bundle);
    await signalStore.createSession(peerId, sharedSecret, true);

    const initEnvelope: X3DHInitEnvelope = {
      type: "x3dh_init",
      from: localPeerId,
      to: peerId,
      identityKey: signalStore.getIdentityPublicKey() ?? "",
      ephemeralKey: ephemeralPublicKey,
      oneTimePreKeyId: bundle.oneTimePreKeyId,
      timestamp: Date.now(),
    };
    await pubsub.publish(
      CHAT_TOPIC,
      new TextEncoder().encode(JSON.stringify(initEnvelope))
    );
  }

  const payload = JSON.stringify({
    text: text || "",
    attachmentCid: attachmentCid || null,
  });

  const encResult = await signalStore.encryptMessage(peerId, payload);
  if (!encResult) {
    return { success: false, error: "Encryption failed — no session" };
  }

  const messageId = uuidv7();
  const envelope: ChatEnvelope = {
    type: "chat_message",
    message_id: messageId,
    from: localPeerId,
    to: peerId,
    encrypted: encResult.encrypted,
    ratchetKey: encResult.ratchetKey,
    counter: encResult.counter,
    timestamp: Date.now(),
    nonce: bytesToB64(crypto.getRandomValues(new Uint8Array(8))),
  };

  try {
    await pubsub.publish(CHAT_TOPIC, new TextEncoder().encode(JSON.stringify(envelope)));
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to send via gossipsub",
    };
  }

  const localMessage: ChatMessage = {
    id: messageId,
    from: localPeerId,
    to: peerId,
    content: text || "",
    timestamp: new Date(envelope.timestamp).toISOString(),
    cid: attachmentCid || undefined,
    encrypted: true,
  };
  await addToConversation(peerId, localMessage, false);

  return { success: true };
}

export async function sendFile(
  peerId: string,
  fileData: Uint8Array | number[],
  filename: string
): Promise<{ success: boolean; cid?: string; error?: string }> {
  if (!heliaFs) {
    return { success: false, error: "IPFS not ready" };
  }

  try {
    const bytes = fileData instanceof Uint8Array ? fileData : new Uint8Array(fileData);
    const cid = await heliaFs.addBytes(bytes);
    const cidStr = cid.toString();
    const result = await sendMessage(peerId, `📎 ${filename}`, cidStr);
    if (!result.success) {
      return result;
    }
    return { success: true, cid: cidStr };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "File send failed",
    };
  }
}

export async function getChatHistory(peerId: string): Promise<ChatHistoryResult> {
  const db = (await openMessageDB(peerId)) as unknown as {
    all: () => Promise<Array<{ value: ChatMessage }>>;
  };
  const entries = await db.all();
  const history = entries
    .map((entry) => entry.value)
    .filter((value): value is ChatMessage => value != null && typeof value.id === "string")
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

  return {
    history,
    sessionInfo: signalStore.getSessionInfo(peerId),
    hasSession: signalStore.hasSession(peerId),
  };
}

export function getConversations(): { conversations: ConversationSummary[] } {
  const conversations: ConversationSummary[] = [];
  conversationSummaries.forEach((summary, peerId) => {
    conversations.push({
      peer_id: peerId,
      last_message: summary.lastMessage,
      timestamp: summary.lastTimestamp,
      unread_count: summary.unreadCount,
      encrypted: true,
      hasSession: signalStore.hasSession(peerId),
    });
  });

  conversations.sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return { conversations };
}

export async function markAsRead(
  peerId: string
): Promise<{ success: boolean }> {
  const summary = conversationSummaries.get(peerId);
  if (summary) {
    conversationSummaries.set(peerId, {
      ...summary,
      unreadCount: 0,
    });
  }
  return { success: true };
}

export function setOnMessageCallback(
  callback: ((payload: { peerId: string; message: ChatMessage }) => void) | null
): void {
  onMessageCallback = callback;
}

export function getOwnBundle(): { peerId: string; bundle: PreKeyBundle } {
  return {
    peerId: localPeerId,
    bundle: signalStore.getPreKeyBundle(),
  };
}

export async function processPeerBundle(
  peerId: string,
  bundle: PreKeyBundle
): Promise<{ success: boolean }> {
  peerBundles.set(peerId, bundle);
  await savePeerBundles();
  return { success: true };
}

export function hasPeerBundle(peerId: string): boolean {
  return peerBundles.has(peerId);
}
