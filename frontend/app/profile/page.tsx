"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaCopy, FaCheck, FaUserMinus, FaArrowRightFromBracket, FaPen, FaCamera } from 'react-icons/fa6';
import { G, Iris, Specular, PurpleButton } from '@/components/ui/Glass';
import { getIdentity, getConnections, removeConnection, clearIdentity, updateIdentity, type Identity, type Connection } from '@/lib/identity';
import { shortUUID } from '@/lib/uuid7';
import { compressAvatar } from '@/lib/imageUtils';
import { useToast } from '@/components/Toast';
import api from '@/lib/api';
import { ensureRegistered, restoreConnectionsFromBackend } from '@/lib/sync';

function AvatarDisplay({ src, size = 80 }: { src: string; size?: number }) {
    if (src) {
        return (
            <img
                src={src}
                alt="avatar"
                className="rounded-2xl object-cover shadow-md"
                style={{ width: size, height: size }}
            />
        );
    }
    return (
        <div
            className="rounded-2xl flex items-center justify-center shadow-md text-3xl select-none"
            style={{ width: size, height: size, background: 'linear-gradient(135deg,#ede9fe,#ddd6fe)', fontSize: size * 0.4 }}
        >
            👤
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

    // Edit state
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

        // Restore any connections recorded on other devices
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

        // Sync to backend with retry
        const ok = await ensureRegistered({ ...identity, ...patch });
        if (!ok) {
            showToast('Changes saved locally. Backend sync failed — will retry next time.', 'info');
        }
    };

    const handleLogout = () => {
        clearIdentity();
        router.push('/login');
    };

    const removeSync = (uuid7: string) => {
        removeConnection(uuid7);
        setConnections(getConnections());
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
                        <button onClick={() => setEditing(e => !e)} style={G.btn}
                            className="p-2.5 rounded-xl text-gray-500 hover:text-primary transition-colors" title="Edit">
                            <FaPen className="text-sm" />
                        </button>
                        <button onClick={handleLogout} style={G.btn}
                            className="p-2.5 rounded-xl text-gray-500 hover:text-red-500 transition-colors" title="Sign out">
                            <FaArrowRightFromBracket className="text-sm" />
                        </button>
                    </div>
                </div>

                <h1 className="text-2xl font-bold text-gray-900">{identity.username}</h1>
                {identity.bio && <p className="text-sm text-gray-600 mt-1">{identity.bio}</p>}

                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/8 border border-primary/15">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary/60">UUID</span>
                    <span className="font-mono text-xs text-primary">{identity.uuid7}</span>
                </div>

                <div className="mt-4 flex items-center gap-2 p-3 rounded-xl border border-gray-100 bg-white/60">
                    <span className="text-xs text-gray-500 truncate flex-1">{profileUrl}</span>
                    <button onClick={copyLink} className="flex items-center gap-1.5 text-xs font-semibold text-primary shrink-0 hover:opacity-70 transition-opacity">
                        {copied ? <><FaCheck className="text-green-500" /> Copied!</> : <><FaCopy /> Copy Link</>}
                    </button>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="text-center p-3 rounded-xl bg-white/50 border border-white/70">
                        <p className="text-xl font-bold text-gray-900">{connections.length}</p>
                        <p className="text-xs text-gray-500">Synced</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-white/50 border border-white/70">
                        <p className="text-xl font-bold text-gray-900">
                            {new Date(identity.createdAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                        </p>
                        <p className="text-xs text-gray-500">Joined</p>
                    </div>
                </div>
            </div>

            {/* ── Edit panel ── */}
            {editing && (
                <div style={{ ...G.card, borderRadius: 24, position: 'relative', overflow: 'hidden' }} className="p-5 space-y-4">
                    <h2 className="font-bold text-gray-900">Edit Profile</h2>

                    {/* Photo upload */}
                    <div className="flex items-center gap-4">
                        <button type="button" onClick={() => photoInputRef.current?.click()}
                            className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-dashed border-primary/30 hover:border-primary transition-colors group"
                            style={{ background: editPhoto ? 'transparent' : 'linear-gradient(135deg,#ede9fe,#ddd6fe)' }}>
                            {editPhoto
                                ? <img src={editPhoto} alt="preview" className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center">
                                    {photoLoading
                                        ? <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                                        : <FaCamera className="text-primary/50 text-xl" />
                                    }
                                </div>
                            }
                            {editPhoto && (
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <FaCamera className="text-white text-lg" />
                                </div>
                            )}
                        </button>
                        <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                        <div>
                            <p className="text-sm font-medium text-gray-700">Profile Photo</p>
                            <p className="text-xs text-gray-400 mt-0.5">Tap to change · cropped square</p>
                        </div>
                    </div>

                    <input value={editName} onChange={e => setEditName(e.target.value)}
                        placeholder="Username" maxLength={32}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/70 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />

                    <textarea value={editBio} onChange={e => setEditBio(e.target.value)}
                        placeholder="Bio (optional)" maxLength={160} rows={2}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/70 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all resize-none" />

                    <div className="flex gap-3">
                        <button onClick={() => setEditing(false)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-all">
                            Cancel
                        </button>
                        <PurpleButton onClick={saveEdit} style={{ flex: 1, padding: '12px', borderRadius: 12, fontSize: 14 }}>
                            Save
                        </PurpleButton>
                    </div>
                </div>
            )}

            {/* ── Synced users ── */}
            <div style={{ ...G.medium, borderRadius: 24 }} className="p-5">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-gray-900">Synced Users</h2>
                    <span className="text-xs text-gray-500 px-2 py-1 rounded-full bg-gray-100">{connections.length}</span>
                </div>

                {connections.length === 0 ? (
                    <div className="text-center py-8 space-y-2">
                        <p className="text-3xl">🔗</p>
                        <p className="text-sm text-gray-500">No synced users yet.</p>
                        <p className="text-xs text-gray-400">Use Search to find people and sync with them.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {connections.map(conn => (
                            <div key={conn.uuid7}
                                className="flex items-center gap-3 p-3 rounded-2xl bg-white/60 border border-white/80 cursor-pointer hover:bg-white/80 transition-all group"
                                onClick={() => router.push(`/profile/${conn.uuid7}`)}>
                                <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0"
                                    style={{ background: 'linear-gradient(135deg,#ede9fe,#ddd6fe)' }}>
                                    {conn.avatar
                                        ? <img src={conn.avatar} alt={conn.username} className="w-full h-full object-cover" />
                                        : <div className="w-full h-full flex items-center justify-center text-xl">👤</div>
                                    }
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-gray-900 truncate">{conn.username}</p>
                                    <p className="text-xs text-gray-400 font-mono">{shortUUID(conn.uuid7)}</p>
                                </div>
                                <button onClick={e => { e.stopPropagation(); removeSync(conn.uuid7); }}
                                    className="opacity-0 group-hover:opacity-100 p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-all"
                                    title="Remove sync">
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
