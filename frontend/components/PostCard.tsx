"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
    FaEllipsis, FaTrash, FaPen, FaXmark, FaCheck, FaShare,
    FaFilePdf, FaFileZipper, FaFileLines, FaFileCode,
} from 'react-icons/fa6';
import { LibraryItem, getIPFSUrl, fetchInteractions, Interaction, deletePost, updatePost } from '../lib/api';
import EngagementBar from './EngagementBar';
import Comments from './Comments';
import { useToast } from './Toast';
import Avatar from './Avatar';
import FormattedDate from './FormattedDate';
import { G, Iris, Specular } from '@/components/ui/Glass';

const D = {
    bright: 'rgba(255,255,255,0.92)',
    mid:    'rgba(255,255,255,0.55)',
    dim:    'rgba(255,255,255,0.32)',
    purpleSoft: 'rgba(155,63,255,0.80)',
};

interface PostCardProps {
    item: LibraryItem;
    interactions?: Interaction;
    onPostDeleted?: (cid: string) => void;
    onPostUpdated?: (cid: string, newTitle: string, newDescription: string) => void;
    onInteraction?: () => void;
}

const PostCard = ({ item, interactions: initialInteractions, onPostDeleted, onPostUpdated }: PostCardProps) => {
    const post = item;
    const { showToast } = useToast();
    const [showComments, setShowComments] = useState(false);
    const [showMenu,     setShowMenu]     = useState(false);
    const [isEditing,    setIsEditing]    = useState(false);
    const [editTitle,    setEditTitle]    = useState(item.name);
    const [editDesc,     setEditDesc]     = useState(item.description);
    const [isDeleting,   setIsDeleting]   = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const [interactions, setInteractions] = useState(initialInteractions || {
        recommended: false, not_recommended: false,
        comments: [] as string[], views: 0, likes_count: 0, dislikes_count: 0,
    });

    const loadInteractions = async () => {
        try { setInteractions(await fetchInteractions(item.cid)); } catch { /* offline ok */ }
    };

    useEffect(() => { loadInteractions(); }, [item.cid]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleDelete = async () => {
        if (!confirm('Delete this post?')) return;
        setIsDeleting(true);
        try { await deletePost(item.cid); onPostDeleted?.(item.cid); }
        catch { showToast('Failed to delete post.', 'error'); }
        finally { setIsDeleting(false); setShowMenu(false); }
    };

    const handleSaveEdit = async () => {
        try {
            await updatePost(item.cid, editTitle, editDesc);
            onPostUpdated?.(item.cid, editTitle, editDesc);
            setIsEditing(false);
        } catch { showToast('Failed to update post.', 'error'); }
    };

    const isOwner = typeof window !== 'undefined' &&
        localStorage.getItem('bucks_peer_id') === (item.peer_id || item.author);

    const [authorName,   setAuthorName]   = useState(item.author);
    const [authorAvatar, setAuthorAvatar] = useState(item.avatar);

    useEffect(() => {
        const sync = () => {
            if (typeof window === 'undefined') return;
            const myId = localStorage.getItem('bucks_peer_id');
            if (myId && item.peer_id === myId) {
                try {
                    const p = JSON.parse(localStorage.getItem('bucks_user_profile') || '{}');
                    if (p.username) setAuthorName(p.username);
                    if (p.avatar)   setAuthorAvatar(p.avatar);
                } catch { /* ignore */ }
            }
        };
        sync();
        const id = setInterval(sync, 3000);
        return () => clearInterval(id);
    }, [item.peer_id]);

    const filename = item.filename || '';
    const isImage  = !!filename.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    const isVideo  = !!filename.match(/\.(mp4|webm|mov)$/i);
    const ipfsUrl  = getIPFSUrl(item.cid);

    if (isDeleting) {
        return (
            <div className="mb-3 p-8 text-center" style={{ ...G.card, borderRadius: 20 }}>
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-400 mx-auto mb-2" />
                <p className="text-sm" style={{ color: D.dim }}>Deleting…</p>
            </div>
        );
    }

    const inputCls: React.CSSProperties = {
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.10)',
        color: D.bright,
        borderRadius: 10,
        width: '100%',
        padding: '10px 14px',
        fontSize: 13,
        outline: 'none',
    };

    return (
        <div
            className="mb-3 overflow-hidden group"
            style={{ ...G.card, borderRadius: 20, position: 'relative' }}
        >
            <Iris opacity={0.4} />
            <Specular />

            {/* ── Recommended-by banner ── */}
            {item.recommended_by && item.recommended_by.length > 0 && (
                <div
                    className="flex items-center gap-2 px-4 py-2"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(155,63,255,0.06)' }}
                >
                    <div className="flex -space-x-1.5">
                        {item.recommended_by.slice(0, 3).map((name: string, i: number) => (
                            <div
                                key={i}
                                className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold border border-black/30"
                                style={{ background: 'rgba(155,63,255,0.30)', color: D.purpleSoft }}
                            >
                                {name[0].toUpperCase()}
                            </div>
                        ))}
                    </div>
                    <span className="text-[10px]" style={{ color: D.dim }}>
                        Recommended by{' '}
                        <span style={{ color: D.mid, fontWeight: 600 }}>{item.recommended_by[0]}</span>
                        {item.recommended_by.length > 1 && ` +${item.recommended_by.length - 1}`}
                    </span>
                </div>
            )}

            {/* ── Header ── */}
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <div className="flex items-center gap-3">
                    <Link href={`/profile/${post.peer_id || post.author}`}>
                        <Avatar src={authorAvatar} seed={post.peer_id || post.author} size="sm"
                            className="ring-1 ring-white/10 rounded-full" />
                    </Link>
                    <div>
                        <Link
                            href={`/profile/${post.peer_id || post.author}`}
                            className="font-semibold text-sm hover:opacity-80 transition-opacity"
                            style={{ color: D.bright }}
                        >
                            {authorName || 'User'}
                        </Link>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <FormattedDate date={post.timestamp} relative className="text-[10px]" />
                        </div>
                    </div>
                </div>

                {/* Menu */}
                <div className="relative" ref={menuRef}>
                    <button
                        onClick={() => setShowMenu(s => !s)}
                        className="p-2 rounded-lg transition-all active:scale-90"
                        style={{ color: D.dim }}
                    >
                        <FaEllipsis />
                    </button>
                    {showMenu && (
                        <div
                            className="absolute right-0 top-9 min-w-[160px] rounded-2xl py-1.5 z-30"
                            style={{ ...G.sheet, borderRadius: 16 }}
                        >
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(`${window.location.origin}/feed?cid=${post.cid}`);
                                    showToast('Post link copied!', 'success');
                                    setShowMenu(false);
                                }}
                                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-white/5 transition-colors"
                                style={{ color: D.mid }}
                            >
                                <FaShare className="text-xs" /> Share Post
                            </button>
                            {isOwner && (
                                <>
                                    <button
                                        onClick={() => { setIsEditing(true); setShowMenu(false); }}
                                        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-white/5 transition-colors"
                                        style={{ color: D.mid }}
                                    >
                                        <FaPen className="text-xs" /> Edit Post
                                    </button>
                                    <button
                                        onClick={handleDelete}
                                        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-red-500/10 transition-colors"
                                        style={{ color: 'rgba(252,165,165,0.80)' }}
                                    >
                                        <FaTrash className="text-xs" /> Delete Post
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Caption ── */}
            <div className="px-4 pb-3">
                {isEditing ? (
                    <div className="space-y-2">
                        <input value={editTitle} onChange={e => setEditTitle(e.target.value)} style={inputCls} placeholder="Title" />
                        <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} style={{ ...inputCls, resize: 'none' }} rows={2} placeholder="Description" />
                        <div className="flex gap-2 pt-1">
                            <button
                                onClick={handleSaveEdit}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                                style={{ background: 'rgba(155,63,255,0.20)', border: '1px solid rgba(155,63,255,0.35)', color: D.purpleSoft }}
                            >
                                <FaCheck className="text-[10px]" /> Save
                            </button>
                            <button
                                onClick={() => { setEditTitle(item.name); setEditDesc(item.description); setIsEditing(false); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: D.dim }}
                            >
                                <FaXmark className="text-[10px]" /> Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {post.name && <p className="text-sm font-medium" style={{ color: D.bright }}>{post.name}</p>}
                        {post.description && <p className="text-sm mt-0.5 leading-relaxed" style={{ color: D.mid }}>{post.description}</p>}
                    </>
                )}
            </div>

            {/* ── Media ── */}
            {(isImage || isVideo || post.thumbnail_cid || filename) && (
                <div className="w-full bg-black/60 flex items-center justify-center overflow-hidden" style={{ minHeight: isImage || isVideo ? 240 : 140 }}>
                    {isImage ? (
                        <img src={ipfsUrl} alt={post.name} className="w-full h-auto max-h-[500px] object-contain" loading="lazy" />
                    ) : isVideo ? (
                        <video src={ipfsUrl} controls className="w-full h-auto max-h-[500px]" />
                    ) : post.thumbnail_cid ? (
                        <div className="relative w-full">
                            <img src={getIPFSUrl(post.thumbnail_cid)} alt={post.name} className="w-full h-auto max-h-[500px] object-contain" />
                            <div className="absolute top-3 right-3 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg">PDF</div>
                            <a href={ipfsUrl} target="_blank" rel="noopener noreferrer" className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white text-gray-900 px-4 py-2 rounded-full text-xs font-bold shadow-xl">
                                Open Document
                            </a>
                        </div>
                    ) : filename ? (
                        <div className="p-10 text-center w-full">
                            <div className="mb-3 inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/5 border border-white/10 shadow-xl">
                                {filename.match(/\.pdf$/i)    ? <FaFilePdf   className="text-red-400 text-2xl" />
                                : filename.match(/\.(zip|rar|7z|tar)$/i) ? <FaFileZipper className="text-yellow-400 text-2xl" />
                                : filename.match(/\.(js|py|html|css|json)$/i) ? <FaFileCode  className="text-blue-400 text-2xl" />
                                : <FaFileLines className="text-purple-400 text-2xl" />}
                            </div>
                            <p className="text-sm font-semibold mb-2" style={{ color: D.bright }}>{filename}</p>
                            <a href={ipfsUrl} target="_blank" rel="noopener noreferrer"
                                className="inline-block text-xs font-semibold px-4 py-1.5 rounded-full"
                                style={{ background: 'rgba(155,63,255,0.18)', border: '1px solid rgba(155,63,255,0.30)', color: D.purpleSoft }}>
                                Download
                            </a>
                        </div>
                    ) : null}
                </div>
            )}

            {/* ── Engagement ── */}
            <EngagementBar
                cid={post.cid}
                initialRecommended={interactions.recommended}
                initialNotRecommended={interactions.not_recommended}
                commentsCount={interactions.comments.length}
                onCommentClick={() => setShowComments(s => !s)}
                likes_count={interactions.likes_count}
                dislikes_count={interactions.dislikes_count}
                onInteractionUpdate={u => setInteractions(p => ({ ...p, ...u }))}
            />

            {/* ── Comments ── */}
            {showComments && (
                <Comments cid={item.cid} comments={interactions.comments} onCommentAdded={loadInteractions} />
            )}
        </div>
    );
};

export default PostCard;
