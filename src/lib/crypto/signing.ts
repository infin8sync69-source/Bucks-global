
import { ed25519 } from '@noble/ed25519';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { base58btc } from '@scure/base';
import { v7 as uuidv7 } from 'uuid';

export type Signed<T> = T & {
    id: string;
    signature: string;
};

// The payload being signed must have an author property containing the DID
export interface Authorable {
    author: string;
}

export function pubkeyFromDID(did: string): Uint8Array {
    if (!did.startsWith('did:key:z')) {
        throw new Error('Invalid DID format');
    }
    const didKey = did.substring('did:key:z'.length);
    const multicodecBytes = base58btc.decode(didKey);
    // The multicodec for ed25519 pubkey is 0xed01
    if (multicodecBytes[0] !== 0xed || multicodecBytes[1] !== 0x01) {
        throw new Error('DID is not an ed25519 key');
    }
    return multicodecBytes.slice(2);
}

export async function signContent<T extends object>(
    payload: T,
    privkey: Uint8Array
): Promise<Signed<T>> {
    const contentToSign = {
        id: uuidv7(),
        ...payload,
    };
    
    const contentString = JSON.stringify(contentToSign);
    const hash = sha256(contentString);
    const signature = await ed25519.sign(hash, privkey);

    return {
        ...contentToSign,
        signature: bytesToHex(signature),
    };
}

export async function verifyContent<T extends Authorable>(
    signed: Signed<T>
): Promise<boolean> {
    const { signature, ...payload } = signed;
    if (!payload.author) {
        throw new Error("Payload does not have an 'author' property.");
    }

    const pubkey = pubkeyFromDID(payload.author);
    
    const contentString = JSON.stringify(payload);
    const hash = sha256(contentString);
    
    return await ed25519.verify(signature, hash, pubkey);
}
