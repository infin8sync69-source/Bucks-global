import axios from 'axios';

const normalizeBaseUrl = (url: string) => url.replace(/\/+$/, '');

/**
 * Returns the API base URL.
 *
 * In the browser we ALWAYS use the Next.js server-side proxy (/api/proxy).
 * This eliminates CORS entirely and makes the app work when accessed from
 * another device (phone, another laptop) because the Next.js server — not
 * the browser — makes the actual request to the backend.
 *
 * On the server side (SSR / API routes) we call the backend directly using
 * NEXT_PUBLIC_API_URL (falls back to localhost:8000 for local dev).
 */
export const getApiBaseUrl = () => {
    if (typeof window !== 'undefined') {
        // Browser: always go through the Next.js proxy — no CORS, cross-device safe
        return '/api/proxy';
    }
    // Server-side: direct connection to backend
    const configured = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const base = normalizeBaseUrl(configured);
    return base.endsWith('/api') ? base : `${base}/api`;
};

// API Client — 20 s timeout (backend can be slow on first cold start)
export const api = axios.create({
    baseURL: getApiBaseUrl(),
    timeout: 20000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Global response error interceptor — normalize network/timeout errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
            error.message = 'Request timed out. Check your connection.';
        }
        return Promise.reject(error);
    },
);

// Helper to compute HMAC-SHA256 signature
const signRequest = async (
    secret: string,
    method: string,
    path: string,
    timestamp: string,
): Promise<string> => {
    try {
        const encoder = new TextEncoder();
        const key = await window.crypto.subtle.importKey(
            'raw',
            encoder.encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign'],
        );
        const payload = `${method.toUpperCase()}${path}${timestamp}`;
        const signature = await window.crypto.subtle.sign('HMAC', key, encoder.encode(payload));
        return Array.from(new Uint8Array(signature))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    } catch (e) {
        console.error('Signing failed', e);
        return '';
    }
};

// Inject X-DID, X-UUID7 headers and signature for every request
api.interceptors.request.use(async (config) => {
    if (typeof window !== 'undefined') {
        const did = localStorage.getItem('bucks_peer_id');
        const secret = localStorage.getItem('bucks_identity_secret');

        if (did) {
            config.headers['X-DID'] = did;

            if (secret && config.url) {
                const timestamp = Date.now().toString();
                // config.url is relative when using axios baseURL
                const path = config.url.startsWith('http')
                    ? new URL(config.url).pathname
                    : config.url;

                const signature = await signRequest(secret, config.method || 'GET', path, timestamp);
                if (signature) {
                    config.headers['X-Signature'] = signature;
                    config.headers['X-Timestamp'] = timestamp;
                }
            }
        }

        // Inject UUID7 from identity store
        try {
            const raw = localStorage.getItem('bucks_identity_v2');
            if (raw) {
                const identity = JSON.parse(raw);
                if (identity?.uuid7) {
                    config.headers['X-UUID7'] = identity.uuid7;
                }
            }
        } catch {
            // ignore parse errors
        }
    }
    return config;
});

// ─── Type Definitions ────────────────────────────────────────────────────────

export interface LibraryItem {
    cid: string;
    thumbnail_cid?: string;
    name: string;
    description: string;
    filename: string;
    type: string;
    author: string;
    avatar: string;
    timestamp: string;
    peer_id?: string;
    recommended_by?: string[];
    _is_social_discovery?: boolean;
}

export interface Interaction {
    recommended: boolean;
    not_recommended: boolean;
    comments: string[];
    views: number;
    likes_count: number;
    dislikes_count: number;
}

export interface CommentItem {
    id?: number;
    text: string;
    user_peer_id: string;
    username?: string;
    timestamp: string;
}

export interface UserProfile {
    username: string;
    handle?: string;
    avatar: string;
    banner?: string;
    bio: string;
    location?: string;
    tags?: string[];
    peer_id?: string;
    did?: string;
    stats: {
        syncs: number;
        contacts: number;
        posts?: number;
        likes?: number;
    };
    onboarding?: boolean;
}

export interface Notification {
    id: number;
    user_peer_id: string;
    type: 'message' | 'connection' | 'mention' | 'follow';
    title: string;
    message: string;
    link: string;
    timestamp: string;
    is_read: boolean;
}

// ─── Library / Posts ─────────────────────────────────────────────────────────

export const fetchLibrary = async () => {
    const response = await api.get<{ library: LibraryItem[] }>('/library');
    return response.data.library;
};

export const fetchPost = async (cid: string) => {
    const response = await api.get<LibraryItem>(`/library/${cid}`);
    return response.data;
};

export const deletePost = async (cid: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/library/${cid}`);
    return response.data;
};

export const updatePost = async (cid: string, title: string, description: string) => {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    const response = await api.put<{ success: boolean; post: LibraryItem }>(`/library/${cid}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

// ─── Interactions ─────────────────────────────────────────────────────────────

export const fetchInteractions = async (cid: string) => {
    const response = await api.get<Interaction>(`/interactions/${cid}`);
    return response.data;
};

export const fetchAllInteractions = async () => {
    const response = await api.get<Record<string, Interaction>>('/interactions');
    return response.data;
};

export const fetchUserLikes = async (peerId: string) => {
    const response = await api.get<{ likes: string[] }>(`/profile/${peerId}/likes`);
    return response.data.likes;
};

export const toggleLike = async (cid: string) => {
    const response = await api.post<Interaction>(`/interactions/${cid}/like`);
    return response.data;
};

export const toggleDislike = async (cid: string) => {
    const response = await api.post<Interaction>(`/interactions/${cid}/dislike`);
    return response.data;
};

export const addComment = async (cid: string, text: string) => {
    const response = await api.post<{ success: boolean; comment: CommentItem }>(`/interactions/${cid}/comment`, { text });
    return response.data;
};

export const deleteComment = async (cid: string, index: number) => {
    const response = await api.delete<{ success: boolean }>(`/interactions/${cid}/comment/${index}`);
    return response.data;
};

// ─── Upload ───────────────────────────────────────────────────────────────────

export const uploadFile = async (formData: FormData) => {
    // If running inside the Bucks Electron App, intercept and use native publishing
    if (typeof window !== 'undefined' && (window as any).bucksAPI?.ipfsPublish) {
        try {
            const file = formData.get('file') as File;
            if (file) {
                const title = (formData.get('title') as string) || file.name;
                const description = (formData.get('description') as string) || '';
                const type = (formData.get('upload_type') as string) || 'post';

                const arrayBuffer = await file.arrayBuffer();
                const content = Array.from(new Uint8Array(arrayBuffer));
                const metadata = { name: title, type, description };

                const localPost = await (window as any).bucksAPI.ipfsPublish(content, metadata);

                const registerRes = await api.post('/register_content', {
                    cid: localPost.cid,
                    title,
                    description,
                    upload_type: type,
                    visibility: (formData.get('visibility') as string) || 'public',
                    thumbnail_cid: null,
                });

                return registerRes.data;
            }
        } catch (err) {
            console.error('[Native IPFS] Falling back to HTTP upload:', err);
        }
    }

    const response = await api.post<{ cid: string; filename: string; success: boolean }>('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

// ─── Profile ──────────────────────────────────────────────────────────────────

export const fetchProfile = async () => {
    const response = await api.get<UserProfile>('/profile');
    const profile = response.data;

    if (!profile.stats) {
        profile.stats = { syncs: 0, contacts: 0, posts: 0, likes: 0 };
    }

    if (typeof window !== 'undefined') {
        if (profile.peer_id) localStorage.setItem('bucks_peer_id', profile.peer_id);
        localStorage.setItem('bucks_user_profile', JSON.stringify(profile));
    }

    return profile;
};

export const fetchUserProfile = async (peer_id: string) => {
    const response = await api.get<UserProfile>(`/profile/${peer_id}`);
    return response.data;
};

export const updateProfile = async (data: {
    username?: string;
    handle?: string;
    bio?: string;
    location?: string;
    avatar?: string;
    banner?: string;
}) => {
    const formData = new FormData();
    if (data.username) formData.append('username', data.username);
    if (data.handle)   formData.append('handle',   data.handle);
    if (data.bio)      formData.append('bio',       data.bio);
    if (data.location) formData.append('location',  data.location);
    if (data.avatar)   formData.append('avatar',    data.avatar);
    if (data.banner)   formData.append('banner',    data.banner);

    const response = await api.post<{ success: boolean; profile: UserProfile }>('/profile', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });

    if (response.data.success && typeof window !== 'undefined') {
        const profile = response.data.profile;
        if (profile.peer_id) localStorage.setItem('bucks_peer_id', profile.peer_id);
        localStorage.setItem('bucks_user_profile', JSON.stringify(profile));
    }

    return response.data;
};

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const logout = () => {
    if (typeof window !== 'undefined') {
        localStorage.removeItem('bucks_peer_id');
        localStorage.removeItem('bucks_identity_secret');
        localStorage.removeItem('bucks_identity');
        localStorage.removeItem('bucks_user_profile');
        localStorage.removeItem('isAuthenticated');
        window.location.href = '/login';
    }
};

// ─── Feed ─────────────────────────────────────────────────────────────────────

export const fetchAggregatedFeed = async () => {
    const response = await api.get<{ library: LibraryItem[] }>('/feed/aggregated');
    return response.data;
};

export const fetchUserFeed = async (peer_id: string) => {
    const response = await api.get<{ library: LibraryItem[] }>(`/feed/user/${peer_id}`);
    return response.data.library;
};

// ─── Social Graph ─────────────────────────────────────────────────────────────

export const fetchFollowing = async () => {
    const response = await api.get<{ following: any[]; count: number }>('/following');
    return response.data.following;
};

export const followPeer = async (peerId: string) => {
    const response = await api.post(`/follow/${peerId}`);
    return response.data;
};

export const unfollowPeer = async (peerId: string) => {
    const response = await api.post(`/unfollow/${peerId}`);
    return response.data;
};

export const fetchConnections = async () => {
    const response = await api.get('/connections');
    return response.data;
};

export const sendConnectionRequest = async (peerId: string) => {
    const formData = new FormData();
    formData.append('peer_id', peerId);
    const response = await api.post('/connections/request', formData);
    return response.data;
};

export const acceptConnectionRequest = async (peerId: string) => {
    const formData = new FormData();
    formData.append('peer_id', peerId);
    const response = await api.post('/connections/accept', formData);
    return response.data;
};

// ─── Discovery ────────────────────────────────────────────────────────────────

export const discoverPeers = async () => {
    const response = await api.get('/peers/discover');
    return response.data;
};

// ─── Notifications ────────────────────────────────────────────────────────────

export const fetchNotifications = async () => {
    const response = await api.get<{ notifications: Notification[] }>('/notifications');
    return response.data.notifications;
};

export const markNotificationsRead = async (notificationId?: number) => {
    if (notificationId) {
        const response = await api.post(`/notifications/${notificationId}/read`);
        return response.data;
    }
    const response = await api.post('/notifications/read-all');
    return response.data;
};

// ─── IPFS ─────────────────────────────────────────────────────────────────────

export const getIPFSUrl = (cid: string) => {
    if (!cid) return '';
    const configured = process.env.NEXT_PUBLIC_IPFS_GATEWAY;
    if (configured) return `${normalizeBaseUrl(configured)}/ipfs/${cid}`;
    // Public IPFS gateway fallback for web deployments
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
        return `https://ipfs.io/ipfs/${cid}`;
    }
    return `http://localhost:8080/ipfs/${cid}`;
};

// ─── Search / Agent ───────────────────────────────────────────────────────────

export const fetchAgentResponse = async (query: string): Promise<string> => {
    try {
        const response = await api.post<{ results: any[] }>('/search', { query });
        const count = response.data.results?.length || 0;
        return `Command received: ${query}. Found ${count} relevant items in the swarm index.`;
    } catch (e) {
        console.error('Agent Error', e);
        return "I'm having trouble connecting to the swarm agent right now.";
    }
};

// ─── Users / Identity ────────────────────────────────────────────────────────

export interface UserRecord {
    did: string;
    uuid7: string;
    username: string;
    avatar: string;
    bio: string;
    peer_id?: string;
}

export const registerUser = async (user: {
    did: string;
    uuid7: string;
    username: string;
    avatar: string;
    bio: string;
}) => {
    const response = await api.post<{ success: boolean; uuid7: string }>('/users', user);
    return response.data;
};

export const listUsers = async (limit = 50, offset = 0) => {
    const response = await api.get<{ users: UserRecord[]; total: number }>(
        `/users?limit=${limit}&offset=${offset}`
    );
    return response.data;
};

export const getUserByUUID = async (uuid7: string) => {
    const response = await api.get<UserRecord>(`/users/${uuid7}`);
    return response.data;
};

export const syncUser = async (targetUuid7: string, fromUuid7: string) => {
    const response = await api.post<{ success: boolean }>(`/users/${targetUuid7}/sync`, {
        from_uuid7: fromUuid7,
    });
    return response.data;
};

export const unsyncUser = async (targetUuid7: string) => {
    const response = await api.delete<{ success: boolean }>(`/users/${targetUuid7}/sync`);
    return response.data;
};

export const getUserConnections = async (uuid7: string) => {
    const response = await api.get<{ connections: UserRecord[]; count: number }>(
        `/users/${uuid7}/connections`
    );
    return response.data;
};

// ─── Chat (UUID7-based, mutual-sync gated) ───────────────────────────────────

export interface ChatContact {
    uuid7: string;
    username: string;
    avatar: string;
    bio: string;
}

export interface ChatConversation {
    peer_uuid7: string;
    username: string;
    avatar: string;
    last_message: string;
    timestamp: string;
    unread_count: number;
}

export interface ChatMessage {
    sender: string;
    receiver: string;
    text: string;
    timestamp: string;
    is_read: number;
}

export const fetchChatUnread = async (): Promise<number> => {
    try {
        const res = await api.get<{ unread: number }>('/chat/unread');
        return res.data.unread ?? 0;
    } catch {
        return 0;
    }
};

export const fetchChatContacts = async (): Promise<ChatContact[]> => {
    const res = await api.get<{ contacts: ChatContact[] }>('/chat/contacts');
    return res.data.contacts ?? [];
};

export const fetchChatConversations = async (): Promise<ChatConversation[]> => {
    const res = await api.get<{ conversations: ChatConversation[] }>('/chat/conversations');
    return res.data.conversations ?? [];
};

export const fetchChatHistory = async (peerUuid7: string): Promise<ChatMessage[]> => {
    const res = await api.get<{ history: ChatMessage[] }>(`/chat/${peerUuid7}`);
    return res.data.history ?? [];
};

export const sendChatMessage = async (peerUuid7: string, text: string) => {
    const res = await api.post<{ success: boolean; timestamp: string }>(
        `/chat/${peerUuid7}/send`,
        { text },
    );
    return res.data;
};

export default api;
