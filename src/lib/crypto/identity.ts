import { ed25519 } from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';
import { base58btc } from '@scure/base';
import { v7 as uuidv7 } from 'uuid';
import { get, set } from 'idb-keyval';
import { PeerId } from '@libp2p/interface/peer-id';
import { createFromPubKey } from '@libp2p/peer-id-factory';
import { Ed25519PublicKey } from '@libp2p/crypto/keys';
import { bytesToBase64, base64ToBytes } from './utils'; // We will create this util file.

// Extend ed25519 to use sha512, as required by libp2p for PeerId generation
ed25519.utils.sha512 = sha512;

export interface Identity {
  identity_id: string;
  did: string;
  peerId: string;
  pubkey: Uint8Array;
  privkey: Uint8Array;
}

function createDID(pubkey: Uint8Array): string {
  const multicodec = new Uint8Array([0xed, 0x01, ...pubkey]);
  return `did:key:z${base58btc.encode(multicodec)}`;
}

async function createPeerIdFromPubKey(pubkey: Uint8Array): Promise<PeerId> {
    const ed25519PubKey = new Ed25519PublicKey(pubkey);
    return await createFromPubKey(ed25519PubKey);
}

export async function generateIdentity(): Promise<Identity> {
  const privkey = ed25519.utils.randomPrivateKey();
  const pubkey = await ed25519.getPublicKey(privkey);
  const did = createDID(pubkey);
  const peerId = await createPeerIdFromPubKey(pubkey);

  return {
    identity_id: uuidv7(),
    did,
    peerId: peerId.toString(),
    pubkey,
    privkey,
  };
}

export async function encryptIdentity(identity: Identity, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const identityString = JSON.stringify({
    ...identity,
    pubkey: Array.from(identity.pubkey),
    privkey: Array.from(identity.privkey),
  });

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    new TextEncoder().encode(identityString)
  );

  const encryptedData = {
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
  };

  return JSON.stringify(encryptedData);
}

export async function decryptIdentity(encrypted: string, password: string): Promise<Identity> {
    const encryptedData = JSON.parse(encrypted);
    const salt = base64ToBytes(encryptedData.salt);
    const iv = base64ToBytes(encryptedData.iv);
    const ciphertext = base64ToBytes(encryptedData.ciphertext);

    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );
    const key = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );

    try {
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            ciphertext
        );

        const identityObject = JSON.parse(new TextDecoder().decode(decrypted));

        return {
            ...identityObject,
            pubkey: new Uint8Array(identityObject.pubkey),
            privkey: new Uint8Array(identityObject.privkey),
        };
    } catch (e) {
        throw new Error("Decryption failed. Invalid password?");
    }
}


export async function loadIdentity(): Promise<string | null> {
    const stored = await get('bucks-identity');
    if (typeof stored === 'string') {
        return stored;
    }
    return null;
}

export async function saveIdentity(encrypted: string): Promise<void> {
    await set('bucks-identity', encrypted);
}
