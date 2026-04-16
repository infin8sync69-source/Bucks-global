"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FaArrowLeft, FaRotate, FaCheck, FaUserMinus, FaLink } from 'react-icons/fa6';
import { G, Iris, Specular, PurpleButton } from '@/components/ui/Glass';
import { getIdentity, addConnection, removeConnection, isSynced, type Connection } from '@/lib/identity';
import { shortUUID } from '@/lib/uuid7';
import { useToast } from '@/components/Toast';
import api from '@/lib/api';

function AvatarImg({ src, size = 96 }: { src: string; size?: number }) {
    if (src) {
        return (
            <img src={src} alt="avatar"
                className="rounded-3xl object-cover shadow-lg"
                style={{ width: size, height: size }} />
        );
    }
    return (
        <div className="rounded-3xl flex items-center justify-center shadow-lg"
            style={{ width: size, height: size, background: 'linear-gradient(135deg,#ede9fe,#ddd6fe)', fontSize: size * 0.4 }}>
            👤
        </div>
    );
}

interface UserData {
    uuid7: string;
    did: string;
    username: string;
    avatar: string;
    bio: string;
}

type LoadState = 'loading' | 'found' | 'not_found';

export default function UserProfilePage() {
    const params = useParams();
    const uuid7Param = Array.isArray(params.id) ? params.id[0] : params.id ?? '';
    const router = useRouter();
    const { showToast } = useToast();

    const [loadState, setLoadState] = useState<LoadState>('loading');
    const [user, setUser] = useState<UserData | null>(null);
    const [synced, setSynced] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [isOwnProfile, setIsOwnProfile] = useState(false);

    useEffect(() => {
        if (!uuid7Param) return;

        const myIdentity = getIdentity();

        // Own profile?
        if (myIdentity?.uuid7 === uuid7Param) {
            setIsOwnProfile(true);
            setUser({
                uuid7: myIdentity.uuid7,
                did: myIdentity.did,
                username: myIdentity.username,
                avatar: myIdentity.avatar,
                bio: myIdentity.bio,
            });
            setLoadState('found');
            return;
        }

        setSynced(isSynced(uuid7Param));

        // 1. Try local connections cache first (instant load)
        const allConns: Connection[] = JSON.parse(
            typeof window !== 'undefined' ? (localStorage.getItem('bucks_connections_v2') ?? '[]') : '[]'
        );
        const cached = allConns.find((c) => c.uuid7 === uuid7Param);
        if (cached) {
            setUser({ uuid7: cached.uuid7, did: cached.did, username: cached.username, avatar: cached.avatar, bio: cached.bio });
            setLoadState('found');
        }

        // 2. Fetch fresh from backend
        api.get<UserData>(`/users/${uuid7Param}`)
            .then(res => {
                setUser(res.data);
                setLoadState('found');
            })
            .catch(() => {
                if (!cached) setLoadState('not_found');
            });
    }, [uuid7Param]);

    const handleSync = async () => {
        if (!user) return;
        setSyncing(true);
        try {
            const myIdentity = getIdentity();

            if (synced) {
                removeConnection(user.uuid7);
                setSynced(false);
                showToast(`Removed sync with ${user.username}.`, 'info');
                api.delete(`/users/${user.uuid7}/sync`).catch(() => { });
            } else {
                const conn: Connection = {
                    uuid7: user.uuid7,
                    did: user.did,
                    username: user.username,
                    avatar: user.avatar,
                    bio: user.bio,
                    syncedAt: new Date().toISOString(),
                };
                addConnection(conn);
                setSynced(true);
                showToast(`Synced with ${user.username}! 🔗`, 'success');
                if (myIdentity) {
                    api.post(`/users/${user.uuid7}/sync`, { from_uuid7: myIdentity.uuid7 }).catch(() => { });
                }
            }
        } finally {
            setSyncing(false);
        }
    };

    const copyProfileLink = () => {
        navigator.clipboard.writeText(`${window.location.origin}/profile/${uuid7Param}`).catch(() => { });
        showToast('Profile link copied!', 'success');
    };

    return (
        <div className="min-h-screen p-4 pb-24 max-w-lg mx-auto">
            <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary transition-colors mb-4"
            >
                <FaArrowLeft className="text-xs" /> Back
            </button>

            {loadState === 'loading' && (
                <div className="flex items-center justify-center py-32">
                    <div className="w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                </div>
            )}

            {loadState === 'not_found' && (
                <div style={{ ...G.medium, borderRadius: 28, position: 'relative', overflow: 'hidden' }} className="p-10 text-center space-y-3">
                    <Iris />
                    <p className="text-4xl">🌐</p>
                    <h2 className="text-lg font-bold text-gray-900">Profile not found</h2>
                    <p className="text-sm text-gray-500">
                        This UUID isn't registered yet or the backend is offline.<br />
                        Ask the person to share their profile link directly.
                    </p>
                    <p className="font-mono text-xs text-gray-400 break-all">{uuid7Param}</p>
                </div>
            )}

            {loadState === 'found' && user && (
                <div className="space-y-4">

                    {/* ── Profile card ── */}
                    <div style={{ ...G.heavy, borderRadius: 28, position: 'relative', overflow: 'hidden' }} className="p-6">
                        <Iris />
                        <Specular />

                        <div className="flex items-end gap-4 mb-4">
                            <AvatarImg src={user.avatar} size={96} />
                            {!isOwnProfile && (
                                <div className="ml-auto">
                                    {synced ? (
                                        <button
                                            onClick={handleSync}
                                            disabled={syncing}
                                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-green-300 bg-green-50 text-green-700 font-semibold text-sm hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-all group"
                                        >
                                            <FaCheck className="group-hover:hidden" />
                                            <FaUserMinus className="hidden group-hover:block" />
                                            <span className="group-hover:hidden">Synced ✓</span>
                                            <span className="hidden group-hover:block">Remove</span>
                                        </button>
                                    ) : (
                                        <PurpleButton
                                            onClick={handleSync}
                                            disabled={syncing}
                                            style={{ padding: '10px 20px', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}
                                        >
                                            {syncing
                                                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                : <FaRotate />
                                            }
                                            Sync
                                        </PurpleButton>
                                    )}
                                </div>
                            )}
                        </div>

                        <h1 className="text-2xl font-bold text-gray-900">{user.username}</h1>
                        {user.bio && <p className="text-sm text-gray-600 mt-1">{user.bio}</p>}

                        <div className="mt-3 flex items-center gap-2 flex-wrap">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/8 border border-primary/15">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-primary/60">UUID</span>
                                <span className="font-mono text-xs text-primary">{user.uuid7}</span>
                            </div>
                            <button
                                onClick={copyProfileLink}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-primary border border-gray-200 hover:border-primary/30 transition-all"
                            >
                                <FaLink className="text-[10px]" /> Share
                            </button>
                        </div>

                        {isOwnProfile && (
                            <div className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/15 text-center">
                                <p className="text-xs text-primary">This is your profile.</p>
                                <button onClick={() => router.push('/profile')} className="text-xs font-semibold text-primary underline mt-1">
                                    Go to profile settings →
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ── DID ── */}
                    <div style={{ ...G.light, borderRadius: 20 }} className="p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Cryptographic Identity (DID)</p>
                        <p className="font-mono text-xs text-gray-600 break-all leading-relaxed">{user.did}</p>
                    </div>

                    {/* ── Short ID ── */}
                    <div style={{ ...G.light, borderRadius: 20 }} className="p-4 text-center">
                        <p className="text-xs text-gray-400 mb-1">Short ID</p>
                        <p className="font-mono text-2xl font-bold text-gray-700 tracking-wider">{shortUUID(user.uuid7)}</p>
                        <p className="text-xs text-gray-400 mt-1">Share this 8-char ID for quick lookup</p>
                    </div>
                </div>
            )}
        </div>
    );
}
