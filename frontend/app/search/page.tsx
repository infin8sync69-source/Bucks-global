"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FaMagnifyingGlass, FaXmark } from 'react-icons/fa6';
import { G, Iris, Specular } from '@/components/ui/Glass';
import { getIdentity, getConnections, addConnection, isSynced, type Connection } from '@/lib/identity';
import { useToast } from '@/components/Toast';
import api from '@/lib/api';
import { pushSyncToBackend } from '@/lib/sync';

const D = {
    bright: 'rgba(255,255,255,0.88)',
    mid:    'rgba(255,255,255,0.55)',
    dim:    'rgba(255,255,255,0.32)',
};

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
            <Specular />

            {/* Avatar */}
            <div
                className="w-14 h-14 rounded-2xl overflow-hidden shrink-0"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}
            >
                {user.avatar
                    ? <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-xl font-bold" style={{ color: D.dim }}>
                        {user.username.charAt(0).toUpperCase()}
                    </div>
                }
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <p className="font-bold truncate" style={{ color: D.bright }}>{user.username}</p>
                {user.bio && <p className="text-xs truncate mt-0.5" style={{ color: D.dim }}>{user.bio}</p>}
                <p className="text-[10px] font-mono mt-1" style={{ color: 'rgba(255,255,255,0.22)' }}>{user.uuid7}</p>
            </div>

            {/* Action */}
            {!isMe && (
                <button
                    onClick={e => { e.stopPropagation(); onSync(user); }}
                    className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                    style={synced ? {
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        color: D.mid,
                    } : {
                        background: 'linear-gradient(145deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 100%)',
                        border: '1px solid rgba(255,255,255,0.16)',
                        boxShadow: 'inset 0 1.5px 0 rgba(255,255,255,0.18)',
                        color: D.bright,
                    }}
                >
                    {synced ? '✓ Synced' : '+ Sync'}
                </button>
            )}
            {isMe && (
                <span
                    className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold"
                    style={{ background: 'rgba(255,255,255,0.04)', color: D.dim }}
                >
                    You
                </span>
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
    const [backendOk, setBackendOk] = useState<boolean | null>(null); // null = not yet checked
    const [, forceUpdate] = useState(0);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            setSearched(false);
            setBackendOk(null);
            return;
        }
        const timer = setTimeout(() => performSearch(query.trim()), 350);
        return () => clearTimeout(timer);
    }, [query]);

    const performSearch = useCallback(async (q: string) => {
        setLoading(true);
        setSearched(true);

        // ── 1. Instant local results (own identity + synced connections) ──────
        const localResults: UserResult[] = [];

        const me = getIdentity();
        if (me && (me.username.toLowerCase().includes(q.toLowerCase()) || me.uuid7.includes(q))) {
            localResults.push({ uuid7: me.uuid7, did: me.did, username: me.username, avatar: me.avatar, bio: me.bio });
        }

        const conns = getConnections();
        conns.forEach((c: Connection) => {
            if (c.username.toLowerCase().includes(q.toLowerCase()) || c.uuid7.includes(q)) {
                if (!localResults.find(r => r.uuid7 === c.uuid7)) {
                    localResults.push({ uuid7: c.uuid7, did: c.did, username: c.username, avatar: c.avatar, bio: c.bio });
                }
            }
        });

        setResults(localResults);

        // ── 2. Backend search (with 1 automatic retry on failure) ────────────
        const doBackendSearch = async (): Promise<void> => {
            const res = await api.get<{ users: UserResult[] }>(`/users?q=${encodeURIComponent(q)}&limit=30`);
            const remote = res.data.users ?? [];
            setBackendOk(true);

            // Also try direct uuid7 lookup for exact-paste scenarios
            let directHit: UserResult | null = null;
            const looksLikeUuid = /^[0-9a-f-]{8,}/i.test(q.trim());
            if (looksLikeUuid && !remote.find(r => r.uuid7 === q.trim())) {
                try {
                    const direct = await api.get<UserResult>(`/users/${q.trim()}`);
                    directHit = direct.data;
                } catch { /* 404 — not found, that's fine */ }
            }

            const merged = [...localResults];
            [...remote, ...(directHit ? [directHit] : [])].forEach(r => {
                if (r.uuid7 && !merged.find(m => m.uuid7 === r.uuid7)) merged.push(r);
            });
            setResults(merged);
        };

        try {
            await doBackendSearch();
        } catch (firstErr: any) {
            // One automatic retry after 1.5 s (handles cold-start delays)
            try {
                await new Promise(r => setTimeout(r, 1500));
                await doBackendSearch();
            } catch (err: any) {
                console.warn('[Search] Backend unreachable:', err?.message ?? err);
                setBackendOk(false);
                // Keep local results visible even when backend is offline
            }
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
        showToast(`Synced with ${user.username}`, 'success');
        if (me?.uuid7) pushSyncToBackend(me.uuid7, user.uuid7);
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

            {/* Header */}
            <div className="mb-6 pt-2">
                <h1 className="text-2xl font-black" style={{ color: 'rgba(255,255,255,0.88)' }}>Find People</h1>
                <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.32)' }}>Search by name or paste a UUID</p>
            </div>

            {/* Backend offline warning */}
            {searched && !backendOk && (
                <div
                    className="mb-4 flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs"
                    style={{
                        background: 'rgba(255,200,80,0.06)',
                        border: '1px solid rgba(255,200,80,0.15)',
                        color: 'rgba(255,200,100,0.70)',
                    }}
                >
                    <span className="text-base shrink-0">⚠</span>
                    <span>
                        <strong>Showing local results only.</strong> Server unreachable — other users won't appear until the connection is restored.
                    </span>
                </div>
            )}

            {/* Search bar */}
            <div
                style={{ ...G.heavy, borderRadius: 20, position: 'relative', overflow: 'hidden' }}
                className="mb-6"
            >
                <Iris />
                <Specular />
                <div className="flex items-center gap-3 px-4 py-3">
                    {loading
                        ? <div className="w-5 h-5 border-2 border-white/20 border-t-white/50 rounded-full animate-spin shrink-0" />
                        : <FaMagnifyingGlass className="text-lg shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }} />
                    }
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Name or UUID"
                        className="flex-1 bg-transparent text-base focus:outline-none"
                        style={{ color: 'rgba(255,255,255,0.85)', caretColor: 'rgba(255,255,255,0.70)' }}
                        spellCheck={false}
                        autoComplete="off"
                    />
                    {query && (
                        <button onClick={clearSearch} className="transition-opacity hover:opacity-80 shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }}>
                            <FaXmark />
                        </button>
                    )}
                </div>
            </div>

            {/* Empty state */}
            {!searched && !query && (
                <div className="text-center py-16 space-y-3">
                    <div
                        className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto"
                        style={{ ...G.medium, fontSize: 32 }}
                    >
                        ◈
                    </div>
                    <p className="text-base font-semibold" style={{ color: D.mid }}>Search for anyone</p>
                    <p className="text-sm max-w-xs mx-auto" style={{ color: D.dim }}>
                        Type a name or paste a UUID to find and sync with people.
                    </p>
                </div>
            )}

            {searched && results.length === 0 && !loading && (
                <div
                    style={{ ...G.medium, borderRadius: 24, position: 'relative', overflow: 'hidden' }}
                    className="p-10 text-center space-y-3"
                >
                    <Iris />
                    <Specular />
                    <p className="font-semibold" style={{ color: D.mid }}>No results for "{query}"</p>
                    <p className="text-sm" style={{ color: D.dim }}>
                        Try the exact UUID, or ask the person to share their profile link.
                    </p>
                </div>
            )}

            {results.length > 0 && (
                <div className="space-y-3">
                    <p className="text-xs font-bold uppercase tracking-widest px-1" style={{ color: D.dim }}>
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
