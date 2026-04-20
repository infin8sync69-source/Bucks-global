"use client";

import React, { useState } from 'react';
import { FaArrowUp, FaArrowDown, FaRegComment, FaArrowUpFromBracket } from 'react-icons/fa6';
import { toggleLike, toggleDislike } from '../lib/api';

interface EngagementBarProps {
    cid: string;
    initialRecommended: boolean;
    initialNotRecommended: boolean;
    commentsCount: number;
    onCommentClick: () => void;
    likes_count?: number;
    dislikes_count?: number;
    onInteractionUpdate?: (updates: any) => void;
}

const D = {
    dim: 'rgba(255,255,255,0.35)',
    mid: 'rgba(255,255,255,0.55)',
    up:  'rgba(110,231,183,0.90)',   // emerald
    upBg: 'rgba(52,211,153,0.12)',
    down: 'rgba(252,165,165,0.90)',  // rose
    downBg: 'rgba(248,113,113,0.12)',
    purple: 'rgba(155,63,255,0.80)',
};

const EngagementBar = ({
    cid,
    initialRecommended,
    initialNotRecommended,
    commentsCount,
    onCommentClick,
    onInteractionUpdate,
    likes_count    = 0,
    dislikes_count = 0,
}: EngagementBarProps) => {
    const [recommended,    setRecommended]    = useState(initialRecommended);
    const [notRecommended, setNotRecommended] = useState(initialNotRecommended);
    const [likesCount,     setLikesCount]     = useState(likes_count);
    const [dislikesCount,  setDislikesCount]  = useState(dislikes_count);

    const handleLike = async () => {
        const prev = { recommended, notRecommended, likesCount, dislikesCount };
        const next = !recommended;
        setRecommended(next);
        setLikesCount(c => next ? c + 1 : c - 1);
        if (next && notRecommended) { setNotRecommended(false); setDislikesCount(c => c - 1); }
        try {
            await toggleLike(cid);
            onInteractionUpdate?.({
                recommended: next,
                not_recommended: next && prev.notRecommended ? false : prev.notRecommended,
                likes_count: next ? prev.likesCount + 1 : prev.likesCount - 1,
                dislikes_count: next && prev.notRecommended ? prev.dislikesCount - 1 : prev.dislikesCount,
            });
        } catch {
            setRecommended(prev.recommended); setNotRecommended(prev.notRecommended);
            setLikesCount(prev.likesCount);   setDislikesCount(prev.dislikesCount);
        }
    };

    const handleDislike = async () => {
        const prev = { recommended, notRecommended, likesCount, dislikesCount };
        const next = !notRecommended;
        setNotRecommended(next);
        setDislikesCount(c => next ? c + 1 : c - 1);
        if (next && recommended) { setRecommended(false); setLikesCount(c => c - 1); }
        try {
            await toggleDislike(cid);
            onInteractionUpdate?.({
                recommended: next && prev.recommended ? false : prev.recommended,
                not_recommended: next,
                likes_count: next && prev.recommended ? prev.likesCount - 1 : prev.likesCount,
                dislikes_count: next ? prev.dislikesCount + 1 : prev.dislikesCount - 1,
            });
        } catch {
            setRecommended(prev.recommended); setNotRecommended(prev.notRecommended);
            setLikesCount(prev.likesCount);   setDislikesCount(prev.dislikesCount);
        }
    };

    const handleShare = () => {
        const shareUrl = `${window.location.origin}/feed?cid=${cid}`;
        navigator.clipboard.writeText(shareUrl).catch(() => {});
    };

    return (
        <div className="flex items-center justify-between px-4 py-3">
            {/* Vote cluster */}
            <div className="flex items-center gap-1">
                {/* Up */}
                <button
                    onClick={handleLike}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-all active:scale-90"
                    style={{
                        background: recommended ? D.upBg : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${recommended ? 'rgba(52,211,153,0.30)' : 'rgba(255,255,255,0.08)'}`,
                    }}
                >
                    <FaArrowUp className="text-xs" style={{ color: recommended ? D.up : D.dim }} />
                    {likesCount > 0 && (
                        <span className="text-[11px] font-bold" style={{ color: recommended ? D.up : D.dim }}>
                            {likesCount}
                        </span>
                    )}
                </button>

                {/* Down */}
                <button
                    onClick={handleDislike}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-all active:scale-90"
                    style={{
                        background: notRecommended ? D.downBg : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${notRecommended ? 'rgba(248,113,113,0.30)' : 'rgba(255,255,255,0.08)'}`,
                    }}
                >
                    <FaArrowDown className="text-xs" style={{ color: notRecommended ? D.down : D.dim }} />
                    {dislikesCount > 0 && (
                        <span className="text-[11px] font-bold" style={{ color: notRecommended ? D.down : D.dim }}>
                            {dislikesCount}
                        </span>
                    )}
                </button>
            </div>

            {/* Comments + Share */}
            <div className="flex items-center gap-2">
                <button
                    onClick={onCommentClick}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-all active:scale-90"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                    <FaRegComment className="text-xs" style={{ color: D.dim }} />
                    {commentsCount > 0 && (
                        <span className="text-[11px] font-bold" style={{ color: D.dim }}>{commentsCount}</span>
                    )}
                </button>

                <button
                    onClick={handleShare}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-all active:scale-90"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                    <FaArrowUpFromBracket className="text-xs" style={{ color: D.dim }} />
                </button>
            </div>
        </div>
    );
};

export default EngagementBar;
