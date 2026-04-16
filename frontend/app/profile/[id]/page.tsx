"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FaArrowLeft, FaRotate, FaCheck, FaUserMinus, FaLink, FaMessage } from 'react-icons/fa6';
import { G, Iris, Specular, PurpleButton } from '@/components/ui/Glass';
import { getIdentity, addConnection, removeConnection, isSynced, type Connection } from '@/lib/identity';
import { shortUUID } from '@/lib/uuid7';
import { useToast } from '@/components/Toast';
import api from '@/lib/api';
import { pushSyncToBackend } from '@/lib/sync';

const D = {
    bright: 'rgba(255,255,255,0.88)',
    mid:    'rgba(255,255,255,0.55)',
    dim:    'rgba(255,255,255,0.32)',
};

function AvatarImg({ src, size = 96 }: { src: string; size?: number }) {
    if (src) {
        return (
            <img src={src} alt="avatar"
                className="rounded-3xl object-cover shadow-lg"
                style={{ width: size, height: size }} />
        );
    }
    return (
        <div
            className="rounded-3xl flex items-center justify-center font-bold"
            style={{
                width: size,
                height: size,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.09)',
                color: D.dim,
                fontSize: size * 0.35,
            }}
        >
            ◈
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
    const [theySync, setTheySync] = useState(false);

    useEffect(() => {
        if (!uuid7Param) return;

        const myIdentity = getIdentity();

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

        const allConns: Connection[] = JSON.parse(
            typeof window !== 'undefined' ? (localStorage.getItem('bucks_connections_v2') ?? '[]') : '[]'
        );
        const cached = allConns.find((c) => c.uuid7 === uuid7Param);
        if (cached) {
            setUser({ uuid7: cached.uuid7, did: cached.did, username: cached.username, avatar: cached.avatar, bio: cached.bio });
            setLoadState('found');
        }

        api.get<UserData>(`/users/${uuid7Param}`)
            .then(res => {
                setUser(res.data);
                setLoadState('found');
            })
            .catch(() => {
                if (!cached) setLoadState('not_found');
            });

        {
            const me = getIdentity();
            if (me?.uuid7) {
                const meUuid7 = me.uuid7;
                api.get<{ connections: any[] }>(`/users/${uuid7Param}/connections`)
                    .then(res => {
                        const mutual = (res.data.connections ?? []).some(
                            (c: any) => c.uuid7 === meUuid7,
                        );
                        setTheySync(mutual);
                    })
                    .catch(() => {});
            }
        }
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
                showToast(`Synced with ${user.username}`, 'success');
                if (myIdentity?.uuid7) {
                    pushSyncToBackend(myIdentity.uuid7, user.uuid7);
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
                className="flex items-center gap-2 text-sm transition-opacity hover:opacity-70 mb-4"
                style={{ color: D.dim }}
            >
                <FaArrowLeft className="text-xs" /> Back
            </button>

            {loadState === 'loading' && (
                <div className="flex items-center justify-center py-32">
                    <div className="w-10 h-10 border-2 border-white/10 border-t-white/30 rounded-full animate-spin" />
                </div>
            )}

            {loadState === 'not_found' && (
                <div style={{ ...G.medium, borderRadius: 28, position: 'relative', overflow: 'hidden' }} className="p-10 text-center space-y-3">
                    <Iris />
                    <Specular />
                    <h2 className="text-lg font-bold" style={{ color: D.bright }}>Profile not found</h2>
                    <p className="text-sm" style={{ color: D.dim }}>
                        This UUID isn't registered yet or the backend is offline.<br />
                        Ask the person to share their profile link directly.
                    </p>
                    <p className="font-mono text-xs break-all" style={{ color: 'rgba(255,255,255,0.20)' }}>{uuid7Param}</p>
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
                                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all group"
                                            style={{
                                                background: 'rgba(255,255,255,0.06)',
                                                border: '1px solid rgba(255,255,255,0.12)',
                                                color: D.mid,
                                            }}
                                        >
                                            <FaCheck className="group-hover:hidden" />
                                            <FaUserMinus className="hidden group-hover:block" />
                                            <span className="group-hover:hidden">Synced</span>
                                            <span className="hidden group-hover:block">Remove</span>
                                        </button>
                                    ) : (
                                        <PurpleButton
                                            onClick={handleSync}
                                            disabled={syncing}
                                            style={{ padding: '10px 20px', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}
                                        >
                                            {syncing
                                                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white/70 rounded-full animate-spin" />
                                                : <FaRotate />
                                            }
                                            Sync
                                        </PurpleButton>
                                    )}
                                </div>
                            )}
                        </div>

                        <h1 className="text-2xl font-bold" style={{ color: D.bright }}>{user.username}</h1>
                        {user.bio && <p className="text-sm mt-1" style={{ color: D.mid }}>{user.bio}</p>}

                        <div className="mt-3 flex items-center gap-2 flex-wrap">
                            <div
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg"
                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                            >
                                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: D.dim }}>UUID</span>
                                <span className="font-mono text-xs" style={{ color: D.mid }}>{user.uuid7}</span>
                            </div>

                            <button
                                onClick={copyProfileLink}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all"
                                style={{ border: '1px solid rgba(255,255,255,0.08)', color: D.dim }}
                            >
                                <FaLink className="text-[10px]" /> Share
                            </button>

                            {/* Message button — only for mutual syncs */}
                            {!isOwnProfile && synced && theySync && (
                                <button
                                    onClick={() => router.push(`/messages/${user.uuid7}`)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                                    style={{
                                        background: 'linear-gradient(145deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.06) 100%)',
                                        border: '1px solid rgba(255,255,255,0.18)',
                                        boxShadow: '0 4px 16px rgba(0,0,0,0.30), inset 0 1.5px 0 rgba(255,255,255,0.20)',
                                        color: D.bright,
                                    }}
                                >
                                    <FaMessage className="text-[10px]" /> Message
                                </button>
                            )}
                        </div>

                        {isOwnProfile && (
                            <div
                                className="mt-4 p-3 rounded-xl text-center"
                                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                            >
                                <p className="text-xs" style={{ color: D.dim }}>This is your profile.</p>
                                <button
                                    onClick={() => router.push('/profile')}
                                    className="text-xs font-semibold underline mt-1 transition-opacity hover:opacity-70"
                                    style={{ color: D.mid }}
                                >
                                    Go to profile settings →
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ── DID ── */}
                    <div style={{ ...G.light, borderRadius: 20 }} className="p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: D.dim }}>
                            Cryptographic Identity (DID)
                        </p>
                        <p className="font-mono text-xs break-all leading-relaxed" style={{ color: 'rgba(255,255,255,0.40)' }}>{user.did}</p>
                    </div>

                    {/* ── Short ID ── */}
                    <div style={{ ...G.light, borderRadius: 20 }} className="p-4 text-center">
                        <p className="text-xs mb-1" style={{ color: D.dim }}>Short ID</p>
                        <p className="font-mono text-2xl font-bold tracking-wider" style={{ color: D.bright }}>{shortUUID(user.uuid7)}</p>
                        <p className="text-xs mt-1" style={{ color: D.dim }}>Share this 8-char ID for quick lookup</p>
                    </div>
                </div>
            )}
        </div>
    );
}
