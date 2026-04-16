import { NextResponse } from 'next/server';
import { generateKeyPairSync, randomBytes } from 'crypto';

// Base58-BTC alphabet (Bitcoin variant used by IPFS / multibase)
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Encode(bytes: Uint8Array): string {
    const hex = Buffer.from(bytes).toString('hex');
    let num = BigInt(hex ? '0x' + hex : '0');
    if (bytes.length === 0) return '';

    const ZERO = BigInt(0);
    const FIFTY_EIGHT = BigInt(58);

    let result = '';
    while (num > ZERO) {
        result = BASE58_ALPHABET[Number(num % FIFTY_EIGHT)] + result;
        num = num / FIFTY_EIGHT;
    }
    // Leading zero bytes → leading '1's
    for (const byte of bytes) {
        if (byte === 0) result = '1' + result;
        else break;
    }
    return result;
}

/** Server-side UUID7 using Node's crypto.randomBytes for strong randomness. */
function generateUUID7Server(): string {
    const ms = Date.now();
    const tsHex = ms.toString(16).padStart(12, '0');
    const rnd = randomBytes(8);
    const randA = ((rnd[0] & 0x0f) * 256 + rnd[1]).toString(16).padStart(3, '0');
    const variantOctet = (rnd[2] & 0x3f) | 0x80;
    const part4 = variantOctet.toString(16).padStart(2, '0') + rnd[3].toString(16).padStart(2, '0');
    const part5 = Array.from(rnd.slice(4)).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${tsHex.slice(0, 8)}-${tsHex.slice(8, 12)}-7${randA}-${part4}-${part5}`;
}

/**
 * Generate an Ed25519 DID (did:key:z...) + UUID7 and return with the hex private key.
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

        // Generate UUID v7 (server-side with Node crypto for stronger randomness)
        const uuid7 = generateUUID7Server();

        return NextResponse.json({ did, secret, uuid7 });
    } catch (err) {
        console.error('[generate-identity]', err);
        return NextResponse.json({ error: 'Failed to generate identity' }, { status: 500 });
    }
}
