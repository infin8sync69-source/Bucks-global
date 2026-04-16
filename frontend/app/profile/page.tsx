"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaCopy, FaCheck, FaUserMinus, FaArrowRightFromBracket, FaPen, FaCamera } from 'react-icons/fa6';
import { G, Iris, Specular, PurpleButton } from '@/components/ui/Glass';
import { getIdentity, getConnections, removeConnection, clearIdentity, updateIdentity, type Identity, type Connection } from '@/lib/identity';
import { shortUUID } from '@/lib/uuid7';
import { compressAvatar } from '@/lib/imageUtils';
import { useToast } from '@/components/Toast';
import { ensureRegistered, restoreConnectionsFromBackend } from '@/lib/sync';

const D = {
    bright: 'rgba(255,255,255,0.88)',
    mid:    'rgba(255,255,255,0.55)',
    dim:    'rgba(255,255,255,0.32)',
};

function AvatarDisplay({ src, size = 80 }: { src: string; size?: number }) {
    if (src) {
        return (
            <img src={src} alt="avatar" className="rounded-2xl object-cover" style={{ width: size, height: size }} />
        );
    }
    return (
        <div
            className="rounded-2xl flex items-center justify-center select-none font-bold"
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

export default function OwnProfilePage() {
    const router = useRouter();
    const { showToast } = useToast();
    const photoInputRef = useRef<HTMLInputElement>(null);

    const [identity, setIdentity] = useState<Identity | null>(null);
    const [connections, setConnections] = useState<Connection[]>([]);
    const [copied, setCopied] = useState(false);
    const [editing, setEditing] = useState(false);

    const [editName, setEditName] = useState('');
    const [editBio, setEditBio] = useState('');
    const [editPhoto, setEditPhoto] = useState('');
    const [photoLoading, setPhotoLoading] = useState(false);

    useEffect(() => {
        const id = getIdentity();
        if (!id) { router.replace('/login'); return; }
        setIdentity(id);
        setConnections(getConnections());
        setEditName(id.username);
        setEditBio(id.bio);
        setEditPhoto(id.avatar);

        restoreConnectionsFromBackend(id.uuid7)
            .then(() => setConnections(getConnections()))
            .catch(() => {});
    }, [router]);

    if (!identity) return null;

    const profileUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/profile/${identity.uuid7}`;

    const copyLink = async () => {
        await navigator.clipboard.writeText(profileUrl).catch(() => { });
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
        showToast('Profile link copied!', 'success');
    };

    const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setPhotoLoading(true);
        try {
            const dataUrl = await compressAvatar(file, 300, 0.85);
            setEditPhoto(dataUrl);
        } catch {
            showToast('Could not process image.', 'error');
        } finally {
            setPhotoLoading(false);
            e.target.value = '';
        }
    };

    const saveEdit = async () => {
        const patch = { username: editName.trim() || identity.username, bio: editBio.trim(), avatar: editPhoto };
        updateIdentity(patch);
        const updated = { ...identity, ...patch };
        setIdentity(updated);
        setEditing(false);
        showToast('Profile updated!', 'success');

        const ok = await ensureRegistered({ ...identity, ...patch });
        if (!ok) showToast('Saved locally. Backend sync failed — will retry.', 'info');
    };

    const handleLogout = () => {
        clearIdentity();
        router.push('/login');
    };

    const removeSync = (uuid7: string) => {
        removeConnection(uuid7);
        setConnections(getConnections());
    };

    const inputStyle: React.CSSProperties = {
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.09)',
        color: D.bright,
        caretColor: 'rgba(255,255,255,0.70)',
        borderRadius: 12,
        width: '100%',
        padding: '12px 16px',
        fontSize: 14,
        outline: 'none',
    };

    return (
        <div className="min-h-screen p-4 pb-24 max-w-lg mx-auto space-y-4">

            {/* ── Identity card ── */}
            <div style={{ ...G.heavy, borderRadius: 28, position: 'relative', overflow: 'hidden' }} className="p-6">
                <Iris />
                <Specular />

                <div className="flex items-start justify-between mb-4">
                    <AvatarDisplay src={identity.avatar} size={80} />
                    <div className="flex gap-2">
                        <button
                            onClick={() => setEditing(e => !e)}
                            className="p-2.5 rounded-xl transition-colors"
                            style={{ ...G.btn, color: D.mid }}
                            title="Edit"
                        >
                            <FaPen className="text-sm" />
                        </button>
                        <button
                            onClick={handleLogout}
                            className="p-2.5 rounded-xl transition-colors"
                            style={{ ...G.btn, color: 'rgba(255,120,120,0.60)' }}
                            title="Sign out"
                        >
                            <FaArrowRightFromBracket className="text-sm" />
                        </button>
                    </div>
                </div>

                <h1 className="text-2xl font-bold" style={{ color: D.bright }}>{identity.username}</h1>
                {identity.bio && <p className="text-sm mt-1" style={{ color: D.mid }}>{identity.bio}</p>}

                <div
                    className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: D.dim }}>UUID</span>
                    <span className="font-mono text-xs" style={{ color: D.mid }}>{identity.uuid7}</span>
                </div>

                <div
                    className="mt-4 flex items-center gap-2 p-3 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                    <span className="text-xs truncate flex-1" style={{ color: D.dim }}>{profileUrl}</span>
                    <button
                        onClick={copyLink}
                        className="flex items-center gap-1.5 text-xs font-semibold shrink-0 transition-opacity hover:opacity-70"
                        style={{ color: D.mid }}
                    >
                        {copied
                            ? <><FaCheck style={{ color: 'rgba(120,255,120,0.80)' }} /> Copied!</>
                            : <><FaCopy /> Copy Link</>
                        }
                    </button>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                    <div
                        className="text-center p-3 rounded-xl"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                    >
                        <p className="text-xl font-bold" style={{ color: D.bright }}>{connections.length}</p>
                        <p className="text-xs" style={{ color: D.dim }}>Synced</p>
                    </div>
                    <div
                        className="text-center p-3 rounded-xl"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                    >
                        <p className="text-xl font-bold" style={{ color: D.bright }}>
                            {new Date(identity.createdAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                        </p>
                        <p className="text-xs" style={{ color: D.dim }}>Joined</p>
                    </div>
                </div>
            </div>

            {/* ── Edit panel ── */}
            {editing && (
                <div style={{ ...G.card, borderRadius: 24, position: 'relative', overflow: 'hidden' }} className="p-5 space-y-4">
                    <Specular />
                    <h2 className="font-bold" style={{ color: D.bright }}>Edit Profile</h2>

                    {/* Photo upload */}
                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            onClick={() => photoInputRef.current?.click()}
                            className="relative w-20 h-20 rounded-2xl overflow-hidden group"
                            style={{
                                background: editPhoto ? 'transparent' : 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.12)',
                            }}
                        >
                            {editPhoto
                                ? <img src={editPhoto} alt="preview" className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center">
                                    {photoLoading
                                        ? <div className="w-5 h-5 border-2 border-white/20 border-t-white/50 rounded-full animate-spin" />
                                        : <FaCamera style={{ color: D.dim, fontSize: 20 }} />
                                    }
                                </div>
                            }
                            {editPhoto && (
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <FaCamera className="text-white text-lg" />
                                </div>
                            )}
                        </button>
                        <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                        <div>
                            <p className="text-sm font-medium" style={{ color: D.mid }}>Profile Photo</p>
                            <p className="text-xs mt-0.5" style={{ color: D.dim }}>Tap to change</p>
                        </div>
                    </div>

                    <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        placeholder="Username"
                        maxLength={32}
                        style={{ ...inputStyle }}
                    />

                    <textarea
                        value={editBio}
                        onChange={e => setEditBio(e.target.value)}
                        placeholder="Bio (optional)"
                        maxLength={160}
                        rows={2}
                        style={{ ...inputStyle, resize: 'none' }}
                    />

                    <div className="flex gap-3">
                        <button
                            onClick={() => setEditing(false)}
                            className="flex-1 py-3 rounded-xl font-medium transition-all"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: D.mid }}
                        >
                            Cancel
                        </button>
                        <PurpleButton onClick={saveEdit} style={{ flex: 1, padding: '12px', borderRadius: 12, fontSize: 14 }}>
                            Save
                        </PurpleButton>
                    </div>
                </div>
            )}

            {/* ── Synced users ── */}
            <div style={{ ...G.medium, borderRadius: 24, position: 'relative', overflow: 'hidden' }} className="p-5">
                <Specular />
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold" style={{ color: D.bright }}>Synced Users</h2>
                    <span
                        className="text-xs px-2 py-1 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.05)', color: D.dim }}
                    >
                        {connections.length}
                    </span>
                </div>

                {connections.length === 0 ? (
                    <div className="text-center py-8 space-y-2">
                        <p className="text-sm" style={{ color: D.dim }}>No synced users yet.</p>
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.20)' }}>Use Search to find people.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {connections.map(conn => (
                            <div
                                key={conn.uuid7}
                                className="flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all group"
                                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                                onClick={() => router.push(`/profile/${conn.uuid7}`)}
                            >
                                <div
                                    className="w-11 h-11 rounded-xl overflow-hidden shrink-0"
                                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                                >
                                    {conn.avatar
                                        ? <img src={conn.avatar} alt={conn.username} className="w-full h-full object-cover" />
                                        : <div className="w-full h-full flex items-center justify-center font-bold text-lg" style={{ color: D.dim }}>
                                            {conn.username.charAt(0).toUpperCase()}
                                        </div>
                                    }
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold truncate" style={{ color: D.bright }}>{conn.username}</p>
                                    <p className="text-xs font-mono" style={{ color: D.dim }}>{shortUUID(conn.uuid7)}</p>
                                </div>
                                <button
                                    onClick={e => { e.stopPropagation(); removeSync(conn.uuid7); }}
                                    className="opacity-0 group-hover:opacity-100 p-2 rounded-lg transition-all"
                                    style={{ color: 'rgba(255,100,100,0.55)' }}
                                    title="Remove sync"
                                >
                                    <FaUserMinus className="text-sm" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
