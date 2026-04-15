import * as ed from "@noble/ed25519";
import { x25519 } from "@noble/curves/ed25519.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";

type X25519KeyPair = {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
};

type SignedPreKey = {
  keyId: number;
  keyPair: X25519KeyPair;
  signature: Uint8Array;
};

type SessionState = {
  rootKey: string;
  sendChainKey: string | null;
  recvChainKey: string | null;
  sendCounter: number;
  recvCounter: number;
  sendRatchetKey: {
    publicKey: string;
    privateKey: string;
  };
  peerRatchetKey: string | null;
  isInitiator: boolean;
  established: number;
};

export type EncryptedEnvelope = {
  ciphertext: string;
  iv: string;
  tag: string;
};

export type PreKeyBundle = {
  identityKey: string;
  signedPreKeyId: number;
  signedPreKey: string;
  signedPreKeySignature: string;
  oneTimePreKeyId: number | null;
  oneTimePreKey: string | null;
};

const DB_NAME = "bucks-chat-signal";
const STORE_NAME = "files";
const KEY_IDENTITY = "identity.json";
const KEY_SIGNED_PREKEY = "signed-prekey.json";
const KEY_ONE_TIME_PREKEYS = "one-time-prekeys.json";
const KEY_SESSIONS = "sessions.json";

let initPromise: Promise<void> | null = null;

let identityKeyPair: X25519KeyPair | null = null;
let signedPreKey: SignedPreKey | null = null;
let oneTimePreKeys = new Map<number, X25519KeyPair>();
let sessions = new Map<string, SessionState>();
let preKeyCounter = 0;

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

  throw new Error("base64 encoding not available");
}

function b64ToBytes(input: string): Uint8Array {
  if (typeof atob === "function") {
    const binary = atob(input);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  }

  const maybeBuffer = (globalThis as { Buffer?: { from: (input: string, enc: string) => { toString: (enc?: string) => string; [n: number]: number; length: number } } }).Buffer;
  if (maybeBuffer) {
    const buf = maybeBuffer.from(input, "base64");
    const out = new Uint8Array(buf.length);
    for (let i = 0; i < buf.length; i++) {
      out[i] = buf[i] as unknown as number;
    }
    return out;
  }

  throw new Error("base64 decoding not available");
}

function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  crypto.getRandomValues(out);
  return out;
}

function openDB(): Promise<IDBDatabase> {
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
      reject(request.error ?? new Error("Failed to open signal store database"));
  });
}

async function readJSON<T>(key: string): Promise<T | null> {
  const db = await openDB();
  try {
    const result = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () =>
        reject(req.error ?? new Error(`Failed to read ${key}`));
    });
    return (result as T | undefined) ?? null;
  } finally {
    db.close();
  }
}

async function writeJSON(key: string, value: unknown): Promise<void> {
  const db = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(tx.error ?? new Error(`Failed to write ${key}`));
      tx.onabort = () =>
        reject(tx.error ?? new Error(`Write transaction aborted for ${key}`));
    });
  } finally {
    db.close();
  }
}

function generateKeyPair(): X25519KeyPair {
  const generated = x25519.keygen();
  return {
    publicKey: generated.publicKey,
    privateKey: generated.secretKey,
  };
}

function computeSharedSecret(
  privateKeyBytes: Uint8Array,
  publicKeyBytes: Uint8Array
): Uint8Array {
  return x25519.getSharedSecret(privateKeyBytes, publicKeyBytes).subarray(0, 32);
}

export function hkdf(
  ikm: Uint8Array,
  salt: Uint8Array | null,
  info: Uint8Array,
  length = 32
): Uint8Array {
  const actualSalt = salt ?? new Uint8Array(32);
  const prk = hmac(sha256, actualSalt, ikm);
  let t = new Uint8Array(0);
  const okm = new Uint8Array(length);
  let position = 0;
  let iteration = 1;

  while (position < length) {
    const input = new Uint8Array(t.length + info.length + 1);
    input.set(t, 0);
    input.set(info, t.length);
    input[input.length - 1] = iteration;
    t = hmac(sha256, prk, input);

    const copyLen = Math.min(t.length, length - position);
    okm.set(t.subarray(0, copyLen), position);
    position += copyLen;
    iteration += 1;
  }

  return okm;
}

async function importAesKey(keyBytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encrypt(
  key: Uint8Array,
  plaintext: Uint8Array | string
): Promise<EncryptedEnvelope> {
  const iv = randomBytes(12);
  const keyObj = await importAesKey(key);
  const data =
    typeof plaintext === "string"
      ? new TextEncoder().encode(plaintext)
      : plaintext;

  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, keyObj, data)
  );
  const tag = encrypted.subarray(encrypted.length - 16);
  const ciphertext = encrypted.subarray(0, encrypted.length - 16);

  return {
    ciphertext: bytesToB64(ciphertext),
    iv: bytesToB64(iv),
    tag: bytesToB64(tag),
  };
}

export async function decrypt(
  key: Uint8Array,
  envelope: EncryptedEnvelope
): Promise<Uint8Array> {
  const iv = b64ToBytes(envelope.iv);
  const tag = b64ToBytes(envelope.tag);
  const ciphertext = b64ToBytes(envelope.ciphertext);
  const combined = new Uint8Array(ciphertext.length + tag.length);
  combined.set(ciphertext, 0);
  combined.set(tag, ciphertext.length);

  const keyObj = await importAesKey(key);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    keyObj,
    combined
  );
  return new Uint8Array(decrypted);
}

async function saveIdentity(): Promise<void> {
  if (!identityKeyPair) {
    return;
  }

  await writeJSON(KEY_IDENTITY, {
    publicKey: bytesToB64(identityKeyPair.publicKey),
    privateKey: bytesToB64(identityKeyPair.privateKey),
    preKeyCounter,
  });
}

async function saveSignedPreKey(): Promise<void> {
  if (!signedPreKey) {
    return;
  }

  await writeJSON(KEY_SIGNED_PREKEY, {
    keyId: signedPreKey.keyId,
    keyPair: {
      publicKey: bytesToB64(signedPreKey.keyPair.publicKey),
      privateKey: bytesToB64(signedPreKey.keyPair.privateKey),
    },
    signature: bytesToB64(signedPreKey.signature),
  });
}

async function saveOneTimePreKeys(): Promise<void> {
  const entries = Array.from(oneTimePreKeys.entries()).map(([keyId, keyPair]) => ({
    keyId,
    keyPair: {
      publicKey: bytesToB64(keyPair.publicKey),
      privateKey: bytesToB64(keyPair.privateKey),
    },
  }));
  await writeJSON(KEY_ONE_TIME_PREKEYS, entries);
}

async function saveSessions(): Promise<void> {
  const data: Record<string, SessionState> = {};
  sessions.forEach((session, peerId) => {
    data[peerId] = session;
  });
  await writeJSON(KEY_SESSIONS, data);
}

async function regenerateSignedPreKey(): Promise<void> {
  if (!identityKeyPair) {
    throw new Error("Identity key pair is not initialized");
  }

  const keyPair = generateKeyPair();
  const signature = hmac(sha256, identityKeyPair.privateKey, keyPair.publicKey);

  signedPreKey = {
    keyId: Date.now(),
    keyPair,
    signature,
  };

  await saveSignedPreKey();
}

async function generateOneTimePreKeys(count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    const keyId = ++preKeyCounter;
    oneTimePreKeys.set(keyId, generateKeyPair());
  }

  await Promise.all([saveIdentity(), saveOneTimePreKeys()]);
}

async function loadSessions(): Promise<void> {
  const raw = await readJSON<Record<string, SessionState>>(KEY_SESSIONS);
  sessions = new Map<string, SessionState>();
  if (!raw) {
    return;
  }

  for (const [peerId, session] of Object.entries(raw)) {
    sessions.set(peerId, session);
  }
}

export async function initStore(): Promise<void> {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const identityData = await readJSON<{
      publicKey: string;
      privateKey: string;
      preKeyCounter?: number;
    }>(KEY_IDENTITY);

    if (identityData) {
      identityKeyPair = {
        publicKey: b64ToBytes(identityData.publicKey),
        privateKey: b64ToBytes(identityData.privateKey),
      };
      preKeyCounter = identityData.preKeyCounter ?? 0;
    } else {
      identityKeyPair = generateKeyPair();
      preKeyCounter = 0;
      await saveIdentity();
    }

    const loadedSignedPreKey = await readJSON<{
      keyId: number;
      keyPair: { publicKey: string; privateKey: string };
      signature: string;
    }>(KEY_SIGNED_PREKEY);

    if (loadedSignedPreKey) {
      signedPreKey = {
        keyId: loadedSignedPreKey.keyId,
        keyPair: {
          publicKey: b64ToBytes(loadedSignedPreKey.keyPair.publicKey),
          privateKey: b64ToBytes(loadedSignedPreKey.keyPair.privateKey),
        },
        signature: b64ToBytes(loadedSignedPreKey.signature),
      };
    } else {
      await regenerateSignedPreKey();
    }

    const loadedOneTimePreKeys = await readJSON<
      Array<{
        keyId: number;
        keyPair: { publicKey: string; privateKey: string };
      }>
    >(KEY_ONE_TIME_PREKEYS);

    oneTimePreKeys = new Map<number, X25519KeyPair>();
    if (loadedOneTimePreKeys?.length) {
      for (const entry of loadedOneTimePreKeys) {
        oneTimePreKeys.set(entry.keyId, {
          publicKey: b64ToBytes(entry.keyPair.publicKey),
          privateKey: b64ToBytes(entry.keyPair.privateKey),
        });
      }
    } else {
      await generateOneTimePreKeys(10);
    }

    await loadSessions();
  })().catch((error) => {
    initPromise = null;
    throw error;
  });

  return initPromise;
}

export function getIdentityPublicKey(): string | null {
  return identityKeyPair ? bytesToB64(identityKeyPair.publicKey) : null;
}

export function getPreKeyBundle(): PreKeyBundle {
  if (!identityKeyPair || !signedPreKey) {
    throw new Error("Signal store not initialized");
  }

  let oneTimePreKeyId: number | null = null;
  let oneTimePreKey: string | null = null;
  if (oneTimePreKeys.size > 0) {
    const [id, keyPair] = oneTimePreKeys.entries().next().value as [
      number,
      X25519KeyPair,
    ];
    oneTimePreKeyId = id;
    oneTimePreKey = bytesToB64(keyPair.publicKey);
  }

  return {
    identityKey: bytesToB64(identityKeyPair.publicKey),
    signedPreKeyId: signedPreKey.keyId,
    signedPreKey: bytesToB64(signedPreKey.keyPair.publicKey),
    signedPreKeySignature: bytesToB64(signedPreKey.signature),
    oneTimePreKeyId,
    oneTimePreKey,
  };
}

export function performX3DH(peerBundle: PreKeyBundle): {
  sharedSecret: Uint8Array;
  ephemeralPublicKey: string;
} {
  if (!identityKeyPair) {
    throw new Error("Signal store not initialized");
  }

  const ephemeral = generateKeyPair();
  const peerIdentityKey = b64ToBytes(peerBundle.identityKey);
  const peerSignedPreKey = b64ToBytes(peerBundle.signedPreKey);

  const dh1 = computeSharedSecret(identityKeyPair.privateKey, peerSignedPreKey);
  const dh2 = computeSharedSecret(ephemeral.privateKey, peerIdentityKey);
  const dh3 = computeSharedSecret(ephemeral.privateKey, peerSignedPreKey);

  let dhConcat = new Uint8Array(dh1.length + dh2.length + dh3.length);
  dhConcat.set(dh1, 0);
  dhConcat.set(dh2, dh1.length);
  dhConcat.set(dh3, dh1.length + dh2.length);

  if (peerBundle.oneTimePreKey) {
    const peerOTK = b64ToBytes(peerBundle.oneTimePreKey);
    const dh4 = computeSharedSecret(ephemeral.privateKey, peerOTK);
    const combined = new Uint8Array(dhConcat.length + dh4.length);
    combined.set(dhConcat, 0);
    combined.set(dh4, dhConcat.length);
    dhConcat = combined;
  }

  const sharedSecret = hkdf(
    dhConcat,
    null,
    new TextEncoder().encode("BucksSignalX3DH"),
    32
  );

  return {
    sharedSecret,
    ephemeralPublicKey: bytesToB64(ephemeral.publicKey),
  };
}

export async function respondX3DH(
  peerIdentityKeyB64: string,
  ephemeralKeyB64: string,
  oneTimePreKeyId: number | null
): Promise<Uint8Array> {
  if (!identityKeyPair || !signedPreKey) {
    throw new Error("Signal store not initialized");
  }

  const peerIdentityKey = b64ToBytes(peerIdentityKeyB64);
  const ephemeralKey = b64ToBytes(ephemeralKeyB64);

  const dh1 = computeSharedSecret(signedPreKey.keyPair.privateKey, peerIdentityKey);
  const dh2 = computeSharedSecret(identityKeyPair.privateKey, ephemeralKey);
  const dh3 = computeSharedSecret(signedPreKey.keyPair.privateKey, ephemeralKey);

  let dhConcat = new Uint8Array(dh1.length + dh2.length + dh3.length);
  dhConcat.set(dh1, 0);
  dhConcat.set(dh2, dh1.length);
  dhConcat.set(dh3, dh1.length + dh2.length);

  if (oneTimePreKeyId !== null && oneTimePreKeys.has(oneTimePreKeyId)) {
    const otk = oneTimePreKeys.get(oneTimePreKeyId) as X25519KeyPair;
    const dh4 = computeSharedSecret(otk.privateKey, ephemeralKey);
    const combined = new Uint8Array(dhConcat.length + dh4.length);
    combined.set(dhConcat, 0);
    combined.set(dh4, dhConcat.length);
    dhConcat = combined;
    oneTimePreKeys.delete(oneTimePreKeyId);

    if (oneTimePreKeys.size < 5) {
      await generateOneTimePreKeys(5);
    } else {
      await saveOneTimePreKeys();
    }
  }

  return hkdf(dhConcat, null, new TextEncoder().encode("BucksSignalX3DH"), 32);
}

export async function createSession(
  peerId: string,
  sharedSecret: Uint8Array,
  isInitiator: boolean
): Promise<void> {
  const ratchetKeyPair = generateKeyPair();

  const session: SessionState = {
    rootKey: bytesToB64(sharedSecret),
    sendChainKey: null,
    recvChainKey: null,
    sendCounter: 0,
    recvCounter: 0,
    sendRatchetKey: {
      publicKey: bytesToB64(ratchetKeyPair.publicKey),
      privateKey: bytesToB64(ratchetKeyPair.privateKey),
    },
    peerRatchetKey: null,
    isInitiator,
    established: Date.now(),
  };

  if (isInitiator) {
    const derived = hkdf(
      sharedSecret,
      null,
      new TextEncoder().encode("BucksInitSend"),
      64
    );
    session.sendChainKey = bytesToB64(derived.subarray(0, 32));
    session.rootKey = bytesToB64(derived.subarray(32, 64));
  }

  sessions.set(peerId, session);
  await saveSessions();
}

export async function encryptMessage(
  peerId: string,
  plaintext: string
): Promise<{ encrypted: EncryptedEnvelope; ratchetKey: string; counter: number } | null> {
  const session = sessions.get(peerId);
  if (!session) {
    return null;
  }

  if (!session.sendChainKey) {
    const derived = hkdf(
      b64ToBytes(session.rootKey),
      null,
      new TextEncoder().encode("BucksMsgKey"),
      64
    );
    session.sendChainKey = bytesToB64(derived.subarray(0, 32));
  }

  const sendChainKey = b64ToBytes(session.sendChainKey);
  const messageKey = hkdf(
    sendChainKey,
    null,
    new TextEncoder().encode(`BucksMsgKey${session.sendCounter}`),
    32
  );

  session.sendChainKey = bytesToB64(
    hkdf(sendChainKey, null, new TextEncoder().encode("BucksChainAdv"), 32)
  );

  const encrypted = await encrypt(messageKey, plaintext);
  const counter = session.sendCounter;
  session.sendCounter += 1;
  await saveSessions();

  return {
    encrypted,
    ratchetKey: session.sendRatchetKey.publicKey,
    counter,
  };
}

export async function decryptMessage(
  peerId: string,
  envelope: { encrypted: EncryptedEnvelope; ratchetKey: string; counter: number }
): Promise<string | null> {
  const session = sessions.get(peerId);
  if (!session) {
    return null;
  }

  if (envelope.ratchetKey && envelope.ratchetKey !== session.peerRatchetKey) {
    session.peerRatchetKey = envelope.ratchetKey;
    try {
      const peerRatchetKey = b64ToBytes(envelope.ratchetKey);
      const ourPrivateKey = b64ToBytes(session.sendRatchetKey.privateKey);
      const dhResult = computeSharedSecret(ourPrivateKey, peerRatchetKey);
      const rootKey = b64ToBytes(session.rootKey);

      const concat = new Uint8Array(rootKey.length + dhResult.length);
      concat.set(rootKey, 0);
      concat.set(dhResult, rootKey.length);
      const derived = hkdf(
        concat,
        null,
        new TextEncoder().encode("BucksRatchet"),
        64
      );
      session.recvChainKey = bytesToB64(derived.subarray(0, 32));
      session.rootKey = bytesToB64(derived.subarray(32, 64));
      session.recvCounter = 0;
    } catch {
      return null;
    }
  }

  if (!session.recvChainKey) {
    const derived = hkdf(
      b64ToBytes(session.rootKey),
      null,
      new TextEncoder().encode("BucksRecvInit"),
      64
    );
    session.recvChainKey = bytesToB64(derived.subarray(0, 32));
  }

  const recvChain = b64ToBytes(session.recvChainKey);
  const messageKey = hkdf(
    recvChain,
    null,
    new TextEncoder().encode(`BucksMsgKey${envelope.counter}`),
    32
  );

  session.recvChainKey = bytesToB64(
    hkdf(recvChain, null, new TextEncoder().encode("BucksChainAdv"), 32)
  );
  session.recvCounter = envelope.counter + 1;

  await saveSessions();

  try {
    const plaintext = await decrypt(messageKey, envelope.encrypted);
    return new TextDecoder().decode(plaintext);
  } catch {
    return null;
  }
}

export function hasSession(peerId: string): boolean {
  return sessions.has(peerId);
}

export function getSessionInfo(peerId: string): {
  established: number;
  messagesSent: number;
  messagesReceived: number;
  isInitiator: boolean;
} | null {
  const session = sessions.get(peerId);
  if (!session) {
    return null;
  }

  return {
    established: session.established,
    messagesSent: session.sendCounter,
    messagesReceived: session.recvCounter,
    isInitiator: session.isInitiator,
  };
}

export { generateKeyPair, computeSharedSecret };
