// src/lib/social.ts

// This is a placeholder. In a real app, this would interact with OrbitDB.
export async function toggleLike(postId: string): Promise<boolean> {
    console.log(`Toggling like for post ${postId}`);
    // Simulate API call
    await new Promise(res => setTimeout(res, 300));
    // Return the new "liked" state
    return Math.random() > 0.5;
}

export async function addComment(postId: string, commentText: string) {
    console.log(`Adding comment to post ${postId}: ${commentText}`);
    await new Promise(res => setTimeout(res, 500));
}

export function copyCIDToClipboard(cid: string) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(cid).then(() => {
            console.log('CID copied to clipboard');
        }).catch(err => {
            console.error('Failed to copy CID: ', err);
        });
    }
}
