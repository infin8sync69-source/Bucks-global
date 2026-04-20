"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    FaCopy, FaCheck, FaUserMinus, FaArrowRightFromBracket,
    FaPen, FaCamera, FaShare, FaLocationDot,
    FaImage, FaFileLines, FaRss, FaFeather,
} from 'react-icons/fa6';
import { G, Iris, Specular, PurpleButton } from '@/components/ui/Glass';
import {
    getIdentity, getConnections, removeConnection, clearIdentity,
    updateIdentity, type Identity, type Connection,
} from '@/lib/identity';
import { shortUUID } from '@/lib/uuid7';
import { compressAvatar } from '@/lib/imageUtils';
import { useToast } from '@/components/Toast';
import { ensureRegistered, restoreConnectionsFromBackend } from '@/lib/sync';
import PostCard from '@/components/PostCard';
import { fetchUserFeed, fetchAllInteractions, LibraryItem, getIPFSUrl } from '@/lib/api';
import Link from 'next/link';

const D = {
    bright: 'rgba(255,255,255,0.92)',
    mid: 'rgba(255,255,255,0.58)',
    dim: 'rgba(255,255,255,0.32)',
    accent: 'rgba(255,255,255,0.80)',
};

type ProfileTab = 'feed' | 'media' | 'files' | 'tweets';

const TABS: { id: ProfileTab; label: string; icon: React.ReactNode }[] = [
    { id: 'feed',   label: 'Feed',   icon: <FaRss      className="text-[10px]" /> },
    { id: 'media',  label: 'Media',  icon: <FaImage    className="text-[10px]" /> },
    { id: 'files',  label: 'Files',  icon: <FaFileLines className="text-[10px]" /> },
    { id: 'tweets', label: 'Tweets', icon: <FaFeather  className="text-[10px]" /> },
];

function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function EmptyState({ icon, text, sub }: { icon: string; text: string; sub: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-14 gap-2">
            <span style={{ fontSize: 36 }}>{icon}</span>
            <p className="font-semibold text-sm" style={{ color: 'rgba(255,255,255,0.40)' }}>{text}</p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.22)' }}>{sub}</p>
        </div>
    );
}

export default function OwnProfilePage() {
    const router = useRouter();
    const { showToast } = useToast();
    const photoInputRef = useRef<HTMLInputElement>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);

    const [identity, setIdentity]       = useState<Identity | null>(null);
    const [connections, setConnections] = useState<Connection[]>([]);
    const [copied, setCopied]           = useState(false);
    const [editing, setEditing]         = useState(false);
    const [activeTab, setActiveTab]     = useState<ProfileTab>('feed');

    // Edit state
    const [editName, setEditName]         = useState('');
    const [editBio, setEditBio]           = useState('');
    const [editLocation, setEditLocation] = useState('');
    const [editPhoto, setEditPhoto]       = useState('');
    const [editCover, setEditCover]       = useState('');
    const [photoLoading, setPhotoLoading] = useState(false);

    // Content
    const [library, setLibrary]           = useState<LibraryItem[]>([]);
    const [interactions, setInteractions] = useState<any>({});
    const [contentLoading, setContentLoading] = useState(true);

    useEffect(() => {
        const id = getIdentity();
        if (!id) { router.replace('/login'); return; }
        setIdentity(id);
        setConnections(getConnections());
        setEditName(id.username);
        setEditBio(id.bio);
        setEditLocation((id as any).location || '');
        setEditPhoto(id.avatar);
        setEditCover((id as any).coverPhoto || '');

        restoreConnectionsFromBackend(id.uuid7)
            .then(() => setConnections(getConnections()))
            .catch(() => {});

        const loadContent = async () => {
            try {
                const [feedData, interactionsRes] = await Promise.all([
                    fetchUserFeed(id.did),
                    fetchAllInteractions(),
                ]);
                setLibrary(feedData || []);
                setInteractions(interactionsRes || {});
            } catch { /* offline ok */ }
            finally { setContentLoading(false); }
        };
        loadContent();
    }, [router]);

    if (!identity) return null;

    const coverPhoto = (identity as any).coverPhoto || '';
    const location   = (identity as any).location || '';
    const profileUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/profile/${identity.uuid7}`;

    const bioText  = identity.bio?.replace(/#\w+/g, '').trim();
    const hashtags = (identity.bio?.match(/#\w+/g) || []);

    const mediaItems = library.filter(item =>
        item.filename?.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|mp4|webm)$/i)
    );
    const fileItems  = library.filter(item =>
        !item.filename?.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|mp4|webm)$/i)
    );
    const tweetItems = library.filter(item => !item.filename && item.description);

    const copyLink = async () => {
        await navigator.clipboard.writeText(profileUrl).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
        showToast('Profile link copied!', 'success');
    };

    const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return;
        setPhotoLoading(true);
        try {
            const dataUrl = await compressAvatar(file, 300, 0.85);
            setEditPhoto(dataUrl);
        } catch { showToast('Could not process image.', 'error'); }
        finally { setPhotoLoading(false); e.target.value = ''; }
    };

    const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return;
        setPhotoLoading(true);
        try {
            const dataUrl = await compressAvatar(file, 1200, 0.80);
            setEditCover(dataUrl);
        } catch { showToast('Could not process image.', 'error'); }
        finally { setPhotoLoading(false); e.target.value = ''; }
    };

    const saveEdit = async () => {
        const patch: any = {
            username: editName.trim() || identity.username,
            bio: editBio.trim(),
            avatar: editPhoto,
            location: editLocation.trim(),
            coverPhoto: editCover,
        };
        updateIdentity(patch);
        setIdentity({ ...identity, ...patch });
        setEditing(false);
        showToast('Profile updated!', 'success');
        const ok = await ensureRegistered({ ...identity, ...patch });
        if (!ok) showToast('Saved locally. Backend sync failed — will retry.', 'info');
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
        <div className="min-h-screen pb-28 max-w-lg mx-auto">

            {/* ── Cover + Header ── */}
            <div className="relative">
                <div
                    className="w-full h-52 relative overflow-hidden"
                    style={{
                        background: coverPhoto
                            ? undefined
                            : 'linear-gradient(160deg, #0d0d1f 0%, #1a0a2e 50%, #0a0a1a 100%)',
                    }}
                >
                    {coverPhoto && (
                        <img src={coverPhoto} alt="Cover" className="w-full h-full object-cover" />
                    )}
                    <div
                        className="absolute inset-0"
                        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.60) 100%)' }}
                    />
                    <button
                        onClick={() => coverInputRef.current?.click()}
                        className="absolute top-3 right-3 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                        style={{ ...G.btn, color: D.mid }}
                    >
                        <FaCamera className="text-[10px]" /> Cover
                    </button>
                    <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
                </div>

                {/* Circular avatar overlapping cover */}
                <div className="absolute left-5" style={{ bottom: -44 }}>
                    <div
                        className="w-24 h-24 rounded-full p-[3px]"
                        style={{
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.50) 0%, rgba(255,255,255,0.20) 100%)',
                            boxShadow: '0 0 0 3px rgba(8,8,16,0.90), 0 8px 32px rgba(255,255,255,0.12)',
                        }}
                    >
                        <div className="w-full h-full rounded-full overflow-hidden bg-gray-900 flex items-center justify-center">
                            {identity.avatar
                                ? <img src={identity.avatar} alt={identity.username} className="w-full h-full object-cover" />
                                : <span style={{ fontSize: 36, lineHeight: 1, color: D.dim }}>{identity.username.charAt(0).toUpperCase()}</span>
                            }
                        </div>
                    </div>
                </div>

                {/* Action buttons */}
                <div className="absolute right-4" style={{ bottom: -38 }}>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setEditing(e => !e)}
                            className="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
                            style={{ ...G.btn, color: D.mid }}
                        >
                            <FaPen className="text-[10px]" /> Edit profile
                        </button>
                        <button
                            onClick={copyLink}
                            className="px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
                            style={{ ...G.btn, color: D.mid }}
                        >
                            {copied
                                ? <FaCheck style={{ color: 'rgba(120,255,120,0.90)' }} />
                                : <FaShare className="text-[10px]" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Identity Info ── */}
            <div className="px-5 pt-14 pb-4">
                <h1 className="text-xl font-bold" style={{ color: D.bright }}>{identity.username}</h1>
                {location && (
                    <div className="flex items-center gap-1.5 mt-1">
                        <FaLocationDot className="text-[10px]" style={{ color: D.dim }} />
                        <span className="text-xs" style={{ color: D.dim }}>{location}</span>
                    </div>
                )}

                {/* Stats */}
                <div className="flex items-center gap-5 mt-3">
                    {[
                        { count: connections.length, label: 'syncs' },
                        { count: connections.length, label: 'contacts' },
                        { count: library.length,     label: 'posts' },
                    ].map((stat, i) => (
                        <React.Fragment key={stat.label}>
                            {i > 0 && <div className="w-px h-4" style={{ background: 'rgba(255,255,255,0.12)' }} />}
                            <div>
                                <span className="text-base font-bold" style={{ color: D.bright }}>{stat.count}</span>
                                <span className="text-xs ml-1.5" style={{ color: D.dim }}>{stat.label}</span>
                            </div>
                        </React.Fragment>
                    ))}
                </div>

                {bioText && (
                    <p className="text-sm mt-3 leading-relaxed" style={{ color: D.mid }}>{bioText}</p>
                )}
                {hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        {hashtags.map((tag: string) => (
                            <span
                                key={tag}
                                className="text-xs px-2 py-0.5 rounded-full font-medium"
                                style={{
                                    background: 'rgba(255,255,255,0.08)',
                                    border: '1px solid rgba(255,255,255,0.15)',
                                    color: D.mid,
                                }}
                            >{tag}</span>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Edit Panel ── */}
            {editing && (
                <div className="mx-4 mb-4" style={{ ...G.card, borderRadius: 24, position: 'relative', overflow: 'hidden' }}>
                    <Specular />
                    <div className="p-5 space-y-4">
                        <h2 className="font-bold" style={{ color: D.bright }}>Edit Profile</h2>
                        <div className="flex items-center gap-4">
                            <button
                                type="button"
                                onClick={() => photoInputRef.current?.click()}
                                className="relative w-20 h-20 rounded-2xl overflow-hidden group shrink-0"
                                style={{ background: editPhoto ? 'transparent' : 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)' }}
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
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <FaCamera className="text-white text-base" />
                                </div>
                            </button>
                            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                            <div>
                                <p className="text-sm font-medium" style={{ color: D.mid }}>Profile Photo</p>
                                <p className="text-xs mt-0.5" style={{ color: D.dim }}>Tap to change</p>
                            </div>
                        </div>
                        <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Username" maxLength={32} style={inputStyle} />
                        <input value={editLocation} onChange={e => setEditLocation(e.target.value)} placeholder="Location (e.g. Bengaluru, KA)" maxLength={40} style={inputStyle} />
                        <textarea
                            value={editBio}
                            onChange={e => setEditBio(e.target.value)}
                            placeholder="Bio + hashtags (e.g. Coffee enthusiast #AppDev)"
                            maxLength={200} rows={3}
                            style={{ ...inputStyle, resize: 'none' }}
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => setEditing(false)}
                                className="flex-1 py-3 rounded-xl font-medium transition-all"
                                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: D.mid }}
                            >Cancel</button>
                            <PurpleButton onClick={saveEdit} style={{ flex: 1, padding: '12px', borderRadius: 12, fontSize: 14 }}>Save</PurpleButton>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Moments Strip ── */}
            {mediaItems.length > 0 && (
                <div className="px-5 mb-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: D.dim }}>Moments</p>
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                        {mediaItems.slice(0, 6).map(item => (
                            <div key={item.cid} className="shrink-0 w-20 h-20 rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                                <img src={getIPFSUrl(item.cid)} alt={item.name} className="w-full h-full object-cover" />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Tabs ── */}
            <div
                className="sticky top-0 z-20 flex px-4 py-2 gap-1"
                style={{ ...G.nav, borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all"
                        style={{
                            background: activeTab === tab.id ? 'rgba(255,255,255,0.10)' : 'transparent',
                            color: activeTab === tab.id ? D.bright : D.dim,
                            border: activeTab === tab.id ? '1px solid rgba(255,255,255,0.18)' : '1px solid transparent',
                        }}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* ── Tab Content ── */}
            <div className="pt-2">

                {activeTab === 'feed' && (
                    <div>
                        {contentLoading ? (
                            <div className="flex items-center justify-center py-16">
                                <div className="w-8 h-8 border-2 border-white/10 border-t-white/50 rounded-full animate-spin" />
                            </div>
                        ) : library.length === 0 ? (
                            <EmptyState icon="📡" text="No posts yet" sub="Share something with your network" />
                        ) : library.map(item => (
                            <PostCard key={item.cid} item={item} interactions={interactions[item.cid]} onInteraction={() => {}} />
                        ))}
                    </div>
                )}

                {activeTab === 'media' && (
                    <div className="px-4">
                        {mediaItems.length === 0 ? (
                            <EmptyState icon="🖼️" text="No media yet" sub="Photos and videos will appear here" />
                        ) : (
                            <div className="grid grid-cols-3 gap-1.5">
                                {mediaItems.map(item => (
                                    <div key={item.cid} className="aspect-square rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                                        {item.filename?.toLowerCase().match(/\.(mp4|webm|ogg)$/i)
                                            ? <video src={getIPFSUrl(item.cid)} className="w-full h-full object-cover" />
                                            : <img src={getIPFSUrl(item.cid)} alt={item.name} className="w-full h-full object-cover" />
                                        }
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'files' && (
                    <div className="px-4 space-y-2">
                        {fileItems.length === 0 ? (
                            <EmptyState icon="📁" text="No files yet" sub="Documents will appear here" />
                        ) : (
                            <>
                                {fileItems.map(item => (
                                    <a
                                        key={item.cid}
                                        href={getIPFSUrl(item.cid)}
                                        target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-3 p-3.5 rounded-2xl transition-all active:scale-[0.98]"
                                        style={{ ...G.card }}
                                    >
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)' }}>
                                            <FaFileLines style={{ color: D.mid }} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold truncate" style={{ color: D.bright }}>{item.name}</p>
                                            <p className="text-xs mt-0.5 truncate" style={{ color: D.dim }}>{item.filename}</p>
                                        </div>
                                    </a>
                                ))}
                                <div className="mt-2 p-4 rounded-2xl flex items-center justify-between" style={{ ...G.light }}>
                                    <div>
                                        <p className="text-xs" style={{ color: D.dim }}>Total files</p>
                                        <p className="text-lg font-bold" style={{ color: D.bright }}>{fileItems.length}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs" style={{ color: D.dim }}>Total size</p>
                                        <p className="text-lg font-bold" style={{ color: D.bright }}>
                                            {formatBytes(fileItems.reduce((acc, f) => acc + ((f as any).size || 0), 0))}
                                        </p>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'tweets' && (
                    <div className="px-4">
                        <Link
                            href="/create"
                            className="flex items-center gap-3 p-3.5 rounded-2xl mb-3"
                            style={{ ...G.card }}
                        >
                            <div className="w-9 h-9 rounded-full overflow-hidden shrink-0" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}>
                                {identity.avatar
                                    ? <img src={identity.avatar} alt="" className="w-full h-full object-cover" />
                                    : <div className="w-full h-full flex items-center justify-center text-sm" style={{ color: D.dim }}>{identity.username.charAt(0)}</div>
                                }
                            </div>
                            <span className="text-sm flex-1" style={{ color: D.dim }}>What&apos;s happening?</span>
                            <div className="px-4 py-1.5 rounded-full text-xs font-bold shrink-0" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)', color: 'rgba(255,255,255,0.90)' }}>
                                Tweet
                            </div>
                        </Link>
                        {tweetItems.length === 0
                            ? <EmptyState icon="🐦" text="No tweets yet" sub="Post short thoughts and updates" />
                            : tweetItems.map(item => (
                                <PostCard key={item.cid} item={item} interactions={interactions[item.cid]} onInteraction={() => {}} />
                            ))
                        }
                    </div>
                )}
            </div>

            {/* ── Synced Users ── */}
            {connections.length > 0 && (
                <div className="mx-4 mt-6" style={{ ...G.medium, borderRadius: 24, position: 'relative', overflow: 'hidden' }}>
                    <Specular />
                    <div className="p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-bold" style={{ color: D.bright }}>Synced Users</h2>
                            <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.05)', color: D.dim }}>{connections.length}</span>
                        </div>
                        <div className="space-y-2">
                            {connections.map(conn => (
                                <div
                                    key={conn.uuid7}
                                    className="flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all group"
                                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                                    onClick={() => router.push(`/profile/${conn.uuid7}`)}
                                >
                                    <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                        {conn.avatar
                                            ? <img src={conn.avatar} alt={conn.username} className="w-full h-full object-cover" />
                                            : <div className="w-full h-full flex items-center justify-center font-bold text-lg" style={{ color: D.dim }}>{conn.username.charAt(0).toUpperCase()}</div>
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
                                    ><FaUserMinus className="text-sm" /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Logout */}
            <div className="px-4 mt-4">
                <button
                    onClick={() => { clearIdentity(); router.push('/login'); }}
                    className="w-full py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                    style={{ background: 'rgba(255,60,60,0.08)', border: '1px solid rgba(255,60,60,0.18)', color: 'rgba(255,100,100,0.70)' }}
                >
                    <FaArrowRightFromBracket /> Sign out
                </button>
            </div>
        </div>
    );
}
