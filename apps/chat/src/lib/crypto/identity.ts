import * as ed25519 from "@noble/ed25519";
import { v7 as uuidv7 } from "uuid";
import { base58btc } from "multiformats/bases/base58";
import { get, set, del } from "idb-keyval";
import {
  toString as uint8ArrayToString,
  fromString as uint8ArrayFromString,
} from "uint8arrays";

export interface Identity {
  identity_id: string;
  did: string;
  peerId: string;
  pubkey: Uint8Array;
  privkey: Uint8Array;
}

export type BucksIdentity = Identity;

const IDB_KEY = "bucks-identity";
const PBKDF2_ITERATIONS = 100_000;

export async function generateIdentity(): Promise<Identity> {
  const privkey = crypto.getRandomValues(new Uint8Array(32));
  const pubkey = await ed25519.getPublicKeyAsync(privkey);
  const identity_id = uuidv7();

  const didMulticodec = new Uint8Array(2 + pubkey.length);
  didMulticodec[0] = 0xed;
  didMulticodec[1] = 0x01;
  didMulticodec.set(pubkey, 2);

  const did = `did:key:z${base58btc.encode(didMulticodec)}`;
  const peerId = `12D3KooW${base58btc.encode(pubkey).slice(0, 36)}`;

  return { identity_id, did, peerId, pubkey, privkey };
}

export async function encryptIdentity(
  identity: Identity,
  password: string,
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    uint8ArrayFromString(password, "utf-8"),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );

  const payload = JSON.stringify({
    ...identity,
    pubkey: uint8ArrayToString(identity.pubkey, "base64"),
    privkey: uint8ArrayToString(identity.privkey, "base64"),
  });

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    uint8ArrayFromString(payload, "utf-8"),
  );

  const packed = JSON.stringify({
    salt: uint8ArrayToString(salt, "base64"),
    iv: uint8ArrayToString(iv, "base64"),
    iterations: PBKDF2_ITERATIONS,
    content: uint8ArrayToString(new Uint8Array(encrypted), "base64"),
  });

  return uint8ArrayToString(
    uint8ArrayFromString(packed, "utf-8"),
    "base64",
  );
}

export async function decryptIdentity(
  encrypted: string,
  password: string,
): Promise<Identity> {
  try {
    const decoded = uint8ArrayToString(
      uint8ArrayFromString(encrypted, "base64"),
      "utf-8",
    );
    const payload = JSON.parse(decoded) as {
      salt: string;
      iv: string;
      iterations: number;
      content: string;
    };

    const salt = uint8ArrayFromString(payload.salt, "base64");
    const iv = uint8ArrayFromString(payload.iv, "base64");
    const content = uint8ArrayFromString(payload.content, "base64");

    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      uint8ArrayFromString(password, "utf-8"),
      { name: "PBKDF2" },
      false,
      ["deriveKey"],
    );

    const key = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt,
        iterations: payload.iterations,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      content,
    );

    const identityJson = JSON.parse(
      uint8ArrayToString(new Uint8Array(decrypted), "utf-8"),
    ) as Omit<Identity, "pubkey" | "privkey"> & {
      pubkey: string;
      privkey: string;
    };

    return {
      ...identityJson,
      pubkey: uint8ArrayFromString(identityJson.pubkey, "base64"),
      privkey: uint8ArrayFromString(identityJson.privkey, "base64"),
    };
  } catch {
    throw new Error("Invalid password or corrupted identity.");
  }
}

export async function loadIdentity(): Promise<string | null> {
  const identity = await get<string>(IDB_KEY);
  return identity ?? null;
}

export async function saveIdentity(encrypted: string): Promise<void> {
  await set(IDB_KEY, encrypted);
}

export async function deleteIdentity(): Promise<void> {
  await del(IDB_KEY);
}

export async function changePassword(
  oldPassword: string,
  newPassword: string,
): Promise<void> {
  const encryptedIdentity = await loadIdentity();
  if (!encryptedIdentity) {
    throw new Error("No identity found to change password for.");
  }

  const identity = await decryptIdentity(encryptedIdentity, oldPassword);
  const reencrypted = await encryptIdentity(identity, newPassword);
  await saveIdentity(reencrypted);
}

// Compatibility aliases used by newer modules.
export const loadIdentityFromIDB = loadIdentity;
export const saveIdentityToIDB = saveIdentity;
export const deleteIdentityFromIDB = deleteIdentity;
