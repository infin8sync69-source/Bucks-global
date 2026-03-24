
import { writable, get } from 'svelte/store';
import { dbStore, type DbStore } from './db';

// A basic placeholder type for a post
export interface Post {
    id: string; // uuidv7
    author: string; // author's DID
    content: string;
    timestamp: number;
    media?: {
        cid: string;
        type: string; // e.g., 'image/png'
    };
    signature: string;
}

export interface FeedStore {
    loading: boolean;
    posts: Post[];
    error: string | null;
}

function createFeedStore() {
    const { subscribe, set, update } = writable<FeedStore>({
        loading: false,
        posts: [],
        error: null
    });

    async function loadFeed(limit = 50) {
        update(s => ({ ...s, loading: true, error: null }));

        const db = get(dbStore).db;
        if (!db) {
            const err = 'Database not available.';
            set({ loading: false, posts: [], error: err });
            return;
        }

        try {
            const entries = await db.posts.all();
            const allPosts: Post[] = entries
                .map((entry: any) => (entry?.value ?? entry) as Post)
                .filter((post: Post) => post && typeof post.id === 'string');
            const sorted = allPosts.sort((a, b) => b.timestamp - a.timestamp);
            set({ loading: false, posts: sorted.slice(0, limit), error: null });
        } catch (e: any) {
            set({ loading: false, posts: [], error: e.message || 'Failed to load feed.'});
        }
    }

    function setupListeners() {
        const db = get(dbStore).db;
        if (!db) return;

        (db.posts as any).events?.on?.('update', async () => {
            console.log('Feed updated, reloading...');
            await loadFeed();
        });
    }

    dbStore.subscribe(store => {
        if (store.db) {
            setupListeners();
            loadFeed();
        }
    });

    return {
        subscribe,
        loadFeed
    };
}

export const feedStore = createFeedStore();

// Note: Filtering logic will be implemented in the component for now
// as per the prompt. e.g. filterPosts(posts, filters)
