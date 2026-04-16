"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaCopy, FaCheck, FaUserMinus, FaArrowRightFromBracket, FaPen } from 'react-icons/fa6';
import { G, Iris, Specular, PurpleButton } from '@/components/ui/Glass';
import { getIdentity, getConnections, removeConnection, clearIdentity, updateIdentity, type Identity, type Connection } from '@/lib/identity';
import { shortUUID } from '@/lib/uuid7';
import { useToast } from '@/components/Toast';

const AVATARS = [
    { emoji: '🦊', bg: '#FFE4CC' }, { emoji: '🐺', bg: '#E8E8F0' },
    { emoji: '🦁', bg: '#FFF3CC' }, { emoji: '🐯', bg: '#FFE8CC' },
    { emoji: '🦋', bg: '#F0E8FF' }, { emoji: '🌙', bg: '#E8F0FF' },
    { emoji: '⚡', bg: '#FFF8CC' }, { emoji: '🔮', bg: '#EDE0FF' },
    { emoji: '🌸', bg: '#FFE8F0' }, { emoji: '🎭', bg: '#E8F8FF' },
    { emoji: '🚀', bg: '#E0EEFF' }, { emoji: '💎', bg: '#E0F8FF' },
];

function avatarBg(emoji: string): string {
    return AVATARS.find(a => a.emoji === emoji)?.bg ?? '#F0E8FF';
}

export default function OwnProfilePage() {
    const router = useRouter();
    const { showToast } = useToast();

    const [identity, setIdentity] = useState<Identity | null>(null);
    const [connections, setConnections] = useState<Connection[]>([]);
    const [copied, setCopied] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [editBio, setEditBio] = useState('');
    const [editAvatar, setEditAvatar] = useState('🦊');

    useEffect(() => {
        const id = getIdentity();
        if (!id) { router.replace('/login'); return; }
        setIdentity(id);
        setConnections(getConnections());
        setEditName(id.username);
        setEditBio(id.bio);
        setEditAvatar(id.avatar);
    }, [router]);

    if (!identity) return null;

    const profileUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/profile/${identity.uuid7}`;

    const copyLink = async () => {
        await navigator.clipboard.writeText(profileUrl).catch(() => { });
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
        showToast('Profile link copied!', 'success');
    };

    const saveEdit = () => {
        updateIdentity({ username: editName.trim() || identity.username, bio: editBio.trim(), avatar: editAvatar });
        setIdentity({ ...identity, username: editName.trim() || identity.username, bio: editBio.trim(), avatar: editAvatar });
        setEditing(false);
        showToast('Profile updated!', 'success');
    };

    const handleLogout = () => {
        clearIdentity();
        router.push('/login');
    };

    const removeSync = (uuid7: string) => {
        removeConnection(uuid7);
        setConnections(getConnections());
        showToast('Removed sync.', 'info');
    };

    return (
        <div className="min-h-screen p-4 pb-24 max-w-lg mx-auto space-y-4">

            {/* ── Identity card ── */}
            <div style={{ ...G.heavy, borderRadius: 28, position: 'relative', overflow: 'hidden' }} className="p-6">
                <Iris />
                <Specular />

                <div className="flex items-start justify-between mb-4">
                    <div
                        className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl shadow-md"
                        style={{ background: avatarBg(identity.avatar) }}
                    >
                        {identity.avatar}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setEditing(e => !e)}
                            className="p-2.5 rounded-xl text-gray-500 hover:text-primary transition-colors"
                            style={G.btn}
                            title="Edit profile"
                        >
                            <FaPen className="text-sm" />
                        </button>
                        <button
                            onClick={handleLogout}
                            className="p-2.5 rounded-xl text-gray-500 hover:text-red-500 transition-colors"
                            style={G.btn}
                            title="Sign out"
                        >
                            <FaArrowRightFromBracket className="text-sm" />
                        </button>
                    </div>
                </div>

                <h1 className="text-2xl font-bold text-gray-900">{identity.username}</h1>
                {identity.bio && <p className="text-sm text-gray-600 mt-1">{identity.bio}</p>}

                {/* UUID7 pill */}
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/8 border border-primary/15">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary/60">UUID</span>
                    <span className="font-mono text-xs text-primary">{identity.uuid7}</span>
                </div>

                {/* Share link */}
                <div className="mt-4 flex items-center gap-2 p-3 rounded-xl border border-gray-100 bg-white/60">
                    <span className="text-xs text-gray-500 truncate flex-1">{profileUrl}</span>
                    <button
                        onClick={copyLink}
                        className="flex items-center gap-1.5 text-xs font-semibold text-primary shrink-0 hover:opacity-70 transition-opacity"
                    >
                        {copied ? <><FaCheck className="text-green-500" /> Copied!</> : <><FaCopy /> Copy Link</>}
                    </button>
                </div>

                {/* Stats */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                    {[
                        { label: 'Synced', value: connections.length },
                        { label: 'Since', value: new Date(identity.createdAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) },
                    ].map(s => (
                        <div key={s.label} className="text-center p-3 rounded-xl bg-white/50 border border-white/70">
                            <p className="text-xl font-bold text-gray-900">{s.value}</p>
                            <p className="text-xs text-gray-500">{s.label}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Edit panel ── */}
            {editing && (
                <div style={{ ...G.card, borderRadius: 24, position: 'relative', overflow: 'hidden' }} className="p-5 space-y-4">
                    <h2 className="font-bold text-gray-900">Edit Profile</h2>

                    {/* Avatar picker */}
                    <div className="grid grid-cols-6 gap-2">
                        {AVATARS.map(av => (
                            <button
                                key={av.emoji}
                                onClick={() => setEditAvatar(av.emoji)}
                                className="aspect-square rounded-xl flex items-center justify-center text-xl transition-all hover:scale-110"
                                style={{
                                    background: av.bg,
                                    boxShadow: editAvatar === av.emoji ? '0 0 0 3px #6A00FF' : 'none',
                                }}
                            >
                                {av.emoji}
                            </button>
                        ))}
                    </div>

                    <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        placeholder="Username"
                        maxLength={32}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/70 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                    />
                    <textarea
                        value={editBio}
                        onChange={e => setEditBio(e.target.value)}
                        placeholder="Bio (optional)"
                        maxLength={160}
                        rows={2}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/70 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all resize-none"
                    />

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

            {/* ── Connections ── */}
            <div style={{ ...G.medium, borderRadius: 24 }} className="p-5">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-gray-900">Synced Users</h2>
                    <span className="text-xs text-gray-500 px-2 py-1 rounded-full bg-gray-100">{connections.length}</span>
                </div>

                {connections.length === 0 ? (
                    <div className="text-center py-8 space-y-2">
                        <p className="text-3xl">🔗</p>
                        <p className="text-sm text-gray-500">No synced users yet.</p>
                        <p className="text-xs text-gray-400">Share your profile link so others can sync with you,<br />or visit someone's profile to sync.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {connections.map(conn => (
                            <div
                                key={conn.uuid7}
                                className="flex items-center gap-3 p-3 rounded-2xl bg-white/60 border border-white/80 cursor-pointer hover:bg-white/80 transition-all group"
                                onClick={() => router.push(`/profile/${conn.uuid7}`)}
                            >
                                <div
                                    className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0"
                                    style={{ background: avatarBg(conn.avatar) }}
                                >
                                    {conn.avatar}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-gray-900 truncate">{conn.username}</p>
                                    <p className="text-xs text-gray-400 font-mono">{shortUUID(conn.uuid7)}</p>
                                </div>
                                <button
                                    onClick={e => { e.stopPropagation(); removeSync(conn.uuid7); }}
                                    className="opacity-0 group-hover:opacity-100 p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-all"
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
