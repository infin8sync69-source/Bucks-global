import * as ed25519 from '@noble/ed25519';
import { sha256 } from '@noble/hashes/sha2.js';
import { v7 as uuidv7 } from 'uuid';
import { base58btc } from 'multiformats/bases/base58';
import { fromString as uint8ArrayFromString, toString as uint8ArrayToString } from 'uint8arrays';
import type { Identity } from '$lib/crypto/identity';

export type Signed<T> = T & {
	id: string;
	author: string; // The DID of the author
	signature: string; // hex string
};

type SignerIdentity = Pick<Identity, 'did' | 'privkey'>;

/**
 * Extracts the public key from a did:key string.
 * @param did The did:key string.
 * @returns The Ed25519 public key as a Uint8Array.
 */
export function pubkeyFromDID(did: string): Uint8Array {
	if (!did.startsWith('did:key:z')) {
		throw new Error('Invalid DID format');
	}
	const didWithoutPrefix = did.substring('did:key:z'.length);
	const multicodecBytes = base58btc.decode(didWithoutPrefix);

	// The public key is after the multicodec prefix (0xed01)
	if (multicodecBytes[0] !== 0xed || multicodecBytes[1] !== 0x01) {
		throw new Error('DID is not an Ed25519 key');
	}

	return multicodecBytes.slice(2);
}


/**
 * Signs a payload with an Ed25519 private key.
 * The payload is augmented with a UUIDv7 ID and the author's DID.
 * The signature is calculated over the sha256 hash of the JSON stringified payload (with ID and author).
 * @param payload The content to sign.
 * @param privkey The author's private key.
 * @param authorDid The author's DID.
 * @returns A promise that resolves to the signed payload.
 */
export async function signContent<T extends object>(
	payload: T,
	signerOrPrivkey: SignerIdentity | Uint8Array,
	authorDid?: string
): Promise<Signed<T>> {
	const privkey = signerOrPrivkey instanceof Uint8Array
		? signerOrPrivkey
		: signerOrPrivkey.privkey;
	const did = signerOrPrivkey instanceof Uint8Array
		? authorDid
		: signerOrPrivkey.did;

	if (!did) {
		throw new Error('author DID is required to sign content');
	}

	const id = uuidv7();
	const contentToSign = {
		id,
		author: did,
		...payload
	};

	const contentBytes = uint8ArrayFromString(JSON.stringify(contentToSign), 'utf-8');
	const hash = sha256(contentBytes);
	const signature = await ed25519.signAsync(hash, privkey);

	return {
		...contentToSign,
		signature: uint8ArrayToString(signature, 'hex')
	};
}

/**
 * Verifies the signature of a signed payload.
 * It extracts the public key from the author's DID.
 * @param signedPayload The signed payload to verify.
 * @returns A promise that resolves to true if the signature is valid, false otherwise.
 */
export async function verifyContent<T extends object>(
	signedPayload: Signed<T>
): Promise<boolean> {
	try {
		const pubkey = pubkeyFromDID(signedPayload.author);
		const { signature, ...content } = signedPayload;
        
		if (!signature) return false;

		const contentBytes = uint8ArrayFromString(JSON.stringify(content), 'utf-8');
		const hash = sha256(contentBytes);
		const signatureBytes = uint8ArrayFromString(signature, 'hex');

		return await ed25519.verifyAsync(signatureBytes, hash, pubkey);
	} catch (error) {
		console.error("Signature verification failed:", error);
		return false;
	}
}
