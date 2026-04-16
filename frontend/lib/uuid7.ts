/**
 * UUID v7 generator (RFC draft — time-ordered, random-sufficient)
 *
 * 128-bit layout:
 *  [0:48]   unix_ts_ms  — 48-bit big-endian millisecond timestamp
 *  [48:52]  version     — 0b0111  (7)
 *  [52:64]  rand_a      — 12 random bits
 *  [64:66]  variant     — 0b10
 *  [66:128] rand_b      — 62 random bits
 *
 * Output: xxxxxxxx-xxxx-7xxx-[89ab]xxx-xxxxxxxxxxxx
 */
export function generateUUID7(): string {
    const ms = Date.now();

    // 48-bit timestamp → 12 hex chars
    const tsHex = ms.toString(16).padStart(12, '0');

    // 12-bit rand_a
    const rnd = typeof window !== 'undefined'
        ? window.crypto.getRandomValues(new Uint8Array(8))
        : new Uint8Array(8).map(() => Math.floor(Math.random() * 256));

    const randA = ((rnd[0] & 0x0f) * 256 + rnd[1]).toString(16).padStart(3, '0');

    // variant 10xx (bits 64-65) + 14-bit rand
    const variantOctet = (rnd[2] & 0x3f) | 0x80; // 10xxxxxx
    const part4 = variantOctet.toString(16).padStart(2, '0')
        + rnd[3].toString(16).padStart(2, '0');

    // 48-bit rand_b (6 bytes)
    const part5 = Array.from(rnd.slice(4))
        .map(b => b.toString(16).padStart(2, '0')).join('');

    return `${tsHex.slice(0, 8)}-${tsHex.slice(8, 12)}-7${randA}-${part4}-${part5}`;
}

/** Extract the creation timestamp (ms) embedded in a UUID7 string. */
export function uuid7ToTimestamp(uuid: string): number {
    const hex = uuid.replace(/-/g, '').slice(0, 12);
    return parseInt(hex, 16);
}

/** Short display form: first 8 chars before first dash */
export function shortUUID(uuid: string): string {
    return uuid.split('-')[0];
}
