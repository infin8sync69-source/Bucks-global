import { NextResponse } from 'next/server';
import { generateKeyPairSync } from 'crypto';

// Base58-BTC alphabet (Bitcoin variant used by IPFS / multibase)
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Encode(bytes: Uint8Array): string {
    let num = BigInt('0x' + Buffer.from(bytes).toString('hex') || '0');
    if (bytes.length === 0) return '';

    let result = '';
    while (num > 0n) {
        result = BASE58_ALPHABET[Number(num % 58n)] + result;
        num = num / 58n;
    }
    // Leading zero bytes → leading '1's
    for (const byte of bytes) {
        if (byte === 0) result = '1' + result;
        else break;
    }
    return result;
}

/**
 * Generate an Ed25519 DID (did:key:z...) and return it with the hex private key.
 * Runs on the server (Vercel Functions) — no backend dependency needed.
 */
export async function POST() {
    try {
        // Generate Ed25519 key pair using Node.js built-in crypto
        const { privateKey, publicKey } = generateKeyPairSync('ed25519');

        // Export raw bytes
        // PKCS8 DER for Ed25519: the seed (private key) is the last 32 bytes
        const pkcs8Der = privateKey.export({ type: 'pkcs8', format: 'der' }) as Buffer;
        const privateBytes = pkcs8Der.slice(-32);

        // SPKI DER for Ed25519: the public key is the last 32 bytes
        const spkiDer = publicKey.export({ type: 'spki', format: 'der' }) as Buffer;
        const publicBytes = spkiDer.slice(-32);

        // Build did:key — multicodec prefix 0xed01 for Ed25519 public key
        const multicodecPrefix = Buffer.from([0xed, 0x01]);
        const multicodecBytes = Buffer.concat([multicodecPrefix, publicBytes]);

        // Base58-BTC encode with 'z' multibase prefix → did:key:z<encoded>
        const encoded = base58Encode(new Uint8Array(multicodecBytes));
        const did = `did:key:z${encoded}`;
        const secret = privateBytes.toString('hex');

        return NextResponse.json({ did, secret });
    } catch (err) {
        console.error('[generate-identity]', err);
        return NextResponse.json({ error: 'Failed to generate identity' }, { status: 500 });
    }
}
