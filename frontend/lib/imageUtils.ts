/**
 * Resize + compress an image File to a square JPEG data-URL.
 * maxPx: max width/height in pixels (default 300)
 * quality: JPEG quality 0–1 (default 0.82)
 */
export async function compressAvatar(file: File, maxPx = 300, quality = 0.82): Promise<string> {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            reject(new Error('Not an image file'));
            return;
        }
        const objectUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            const canvas = document.createElement('canvas');
            canvas.width = maxPx;
            canvas.height = maxPx;
            const ctx = canvas.getContext('2d');
            if (!ctx) { reject(new Error('Canvas not supported')); return; }

            // Centre-crop to square
            const side = Math.min(img.naturalWidth, img.naturalHeight);
            const sx = (img.naturalWidth - side) / 2;
            const sy = (img.naturalHeight - side) / 2;
            ctx.drawImage(img, sx, sy, side, side, 0, 0, maxPx, maxPx);

            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Failed to load image')); };
        img.src = objectUrl;
    });
}
