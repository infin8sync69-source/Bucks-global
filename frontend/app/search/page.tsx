"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FaMagnifyingGlass, FaXmark, FaRotate, FaCheck } from 'react-icons/fa6';
import { G, Iris, Specular, PurpleButton } from '@/components/ui/Glass';
import { getIdentity, getConnections, addConnection, isSynced, type Connection } from '@/lib/identity';
import { shortUUID } from '@/lib/uuid7';
import { useToast } from '@/components/Toast';
import api from '@/lib/api';
import { pushSyncToBackend } from '@/lib/sync';

interface UserResult {
    uuid7: string;
    did: string;
    username: string;
    avatar: string;
    bio: string;
}

function UserCard({ user, onSync }: { user: UserResult; onSync: (u: UserResult) => void }) {
    const router = useRouter();
    const synced = isSynced(user.uuid7);
    const myIdentity = getIdentity();
    const isMe = myIdentity?.uuid7 === user.uuid7;

    return (
        <div
            style={{ ...G.card, borderRadius: 20, position: 'relative', overflow: 'hidden' }}
            className="p-4 flex items-center gap-4 cursor-pointer hover:scale-[1.01] transition-transform active:scale-[0.99]"
            onClick={() => router.push(`/profile/${user.uuid7}`)}
        >
            {/* Avatar */}
            <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 shadow-md"
                style={{ background: 'linear-gradient(135deg,#ede9fe,#ddd6fe)' }}>
                {user.avatar
                    ? <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-2xl">👤</div>
                }
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 truncate">{user.username}</p>
                {user.bio && <p className="text-xs text-gray-500 truncate mt-0.5">{user.bio}</p>}
                <p className="text-[10px] text-primary/60 font-mono mt-1">{user.uuid7}</p>
            </div>

            {/* Action */}
            {!isMe && (
                <button
                    onClick={e => { e.stopPropagation(); onSync(user); }}
                    className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        synced
                            ? 'bg-green-50 text-green-600 border border-green-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200'
                            : 'bg-primary text-white hover:bg-primary/80'
                    }`}
                >
                    {synced ? '✓ Synced' : '+ Sync'}
                </button>
            )}
            {isMe && (
                <span className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-100 text-gray-400">You</span>
            )}
        </div>
    );
}

export default function SearchPage() {
    const { showToast } = useToast();
    const inputRef = useRef<HTMLInputElement>(null);

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<UserResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [backendOk, setBackendOk] = useState(true);
    const [, forceUpdate] = useState(0); // re-render after sync

    // Auto-focus on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Debounced search
    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            setSearched(false);
            return;
        }

        const timer = setTimeout(() => performSearch(query.trim()), 350);
        return () => clearTimeout(timer);
    }, [query]);

    const performSearch = useCallback(async (q: string) => {
        setLoading(true);
        setSearched(true);

        const localResults: UserResult[] = [];

        // 1. Check own identity
        const me = getIdentity();
        if (me && (me.username.toLowerCase().includes(q.toLowerCase()) || me.uuid7.includes(q))) {
            localResults.push({ uuid7: me.uuid7, did: me.did, username: me.username, avatar: me.avatar, bio: me.bio });
        }

        // 2. Search local connections
        const conns = getConnections();
        conns.forEach((c: Connection) => {
            if (c.username.toLowerCase().includes(q.toLowerCase()) || c.uuid7.includes(q)) {
                if (!localResults.find(r => r.uuid7 === c.uuid7)) {
                    localResults.push({ uuid7: c.uuid7, did: c.did, username: c.username, avatar: c.avatar, bio: c.bio });
                }
            }
        });

        setResults(localResults);

        // 3. Fetch from backend — also try exact uuid7 lookup for full-UUID paste
        try {
            const res = await api.get<{ users: UserResult[] }>(`/users?q=${encodeURIComponent(q)}&limit=30`);
            const remote = res.data.users ?? [];
            setBackendOk(true);

            // Also try direct lookup by uuid7 (handles exact paste of full UUID)
            let directHit: UserResult | null = null;
            const looksLikeUuid = /^[0-9a-f-]{8,}/i.test(q.trim());
            if (looksLikeUuid && !remote.find(r => r.uuid7 === q.trim())) {
                try {
                    const direct = await api.get<UserResult>(`/users/${q.trim()}`);
                    directHit = direct.data;
                } catch { /* not found — ignore */ }
            }

            // Merge: remote takes precedence, deduplicate by uuid7
            const merged = [...localResults];
            [...remote, ...(directHit ? [directHit] : [])].forEach(r => {
                if (r.uuid7 && !merged.find(m => m.uuid7 === r.uuid7)) merged.push(r);
            });
            setResults(merged);
        } catch {
            setBackendOk(false);
            // Backend offline — local results already set above
        } finally {
            setLoading(false);
        }
    }, []);

    const handleSync = (user: UserResult) => {
        const me = getIdentity();
        if (isSynced(user.uuid7)) return;

        const conn: Connection = {
            uuid7: user.uuid7, did: user.did,
            username: user.username, avatar: user.avatar, bio: user.bio,
            syncedAt: new Date().toISOString(),
        };
        addConnection(conn);
        showToast(`Synced with ${user.username}! 🔗`, 'success');

        // Push to backend with retry so the other device can see it
        if (me?.uuid7) {
            pushSyncToBackend(me.uuid7, user.uuid7);
        }

        forceUpdate(n => n + 1);
    };

    const clearSearch = () => {
        setQuery('');
        setResults([]);
        setSearched(false);
        inputRef.current?.focus();
    };

    return (
        <div className="min-h-screen p-4 pb-24 max-w-lg mx-auto">

            {/* ── Header ── */}
            <div className="mb-6 pt-2">
                <h1 className="text-2xl font-black text-gray-900">Find People</h1>
                <p className="text-sm text-gray-500 mt-1">Search by name or paste a UUID</p>
            </div>

            {/* ── Backend offline warning ── */}
            {searched && !backendOk && (
                <div className="mb-4 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700">
                    <span className="text-base shrink-0">⚠️</span>
                    <span>
                        <strong>Showing local results only.</strong> The server is unreachable — other users won't appear until the connection is restored. Make sure your device is connected to the internet and the backend is running.
                    </span>
                </div>
            )}

            {/* ── Search bar ── */}
            <div
                style={{ ...G.heavy, borderRadius: 20, position: 'relative', overflow: 'hidden' }}
                className="mb-6"
            >
                <Iris />
                <div className="flex items-center gap-3 px-4 py-3">
                    {loading
                        ? <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin shrink-0" />
                        : <FaMagnifyingGlass className="text-primary/60 text-lg shrink-0" />
                    }
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Name or UUID (e.g. 0195f2a3…)"
                        className="flex-1 bg-transparent text-gray-900 placeholder-gray-400 text-base focus:outline-none"
                        spellCheck={false}
                        autoComplete="off"
                    />
                    {query && (
                        <button onClick={clearSearch} className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">
                            <FaXmark />
                        </button>
                    )}
                </div>
            </div>

            {/* ── Results ── */}
            {!searched && !query && (
                <div className="text-center py-16 space-y-3">
                    <div
                        className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mx-auto shadow-lg"
                        style={G.medium}
                    >
                        🔍
                    </div>
                    <p className="text-base font-semibold text-gray-700">Search for anyone</p>
                    <p className="text-sm text-gray-400 max-w-xs mx-auto">
                        Type a name or paste their full UUID to find their profile and sync with them.
                    </p>
                </div>
            )}

            {searched && results.length === 0 && !loading && (
                <div
                    style={{ ...G.medium, borderRadius: 24, position: 'relative', overflow: 'hidden' }}
                    className="p-10 text-center space-y-3"
                >
                    <Iris />
                    <p className="text-3xl">🌐</p>
                    <p className="font-semibold text-gray-800">No results for "{query}"</p>
                    <p className="text-sm text-gray-500">
                        Try the exact UUID, or ask the person to share their profile link.
                    </p>
                </div>
            )}

            {results.length > 0 && (
                <div className="space-y-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400 px-1">
                        {results.length} result{results.length !== 1 ? 's' : ''}
                    </p>
                    {results.map(user => (
                        <UserCard key={user.uuid7} user={user} onSync={handleSync} />
                    ))}
                </div>
            )}
        </div>
    );
}
