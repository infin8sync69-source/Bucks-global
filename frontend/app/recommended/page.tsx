"use client";

import React, { useEffect, useState } from 'react';
import PostCard from '@/components/PostCard';
import { LibraryItem, api } from '@/lib/api';
import { FaMagnifyingGlass, FaFire, FaListUl, FaVideo, FaFileLines } from 'react-icons/fa6';
import { G, Iris, Specular } from '@/components/ui/Glass';

const D = {
    bright: 'rgba(255,255,255,0.92)',
    mid:    'rgba(255,255,255,0.55)',
    dim:    'rgba(255,255,255,0.30)',
    accent: 'rgba(255,255,255,0.90)',
    accentBg: 'rgba(255,255,255,0.13)',
    accentBorder: 'rgba(255,255,255,0.24)',
};

const FILTERS = [
    { id: 'all',      label: 'All',      icon: <FaListUl className="text-[10px]" /> },
    { id: 'trending', label: 'Trending', icon: <FaFire className="text-[10px]" /> },
    { id: 'posts',    label: 'Posts',    icon: <FaFileLines className="text-[10px]" /> },
    { id: 'videos',   label: 'Videos',   icon: <FaVideo className="text-[10px]" /> },
];

export default function Recommended() {
    const [library, setLibrary]       = useState<LibraryItem[]>([]);
    const [loading, setLoading]       = useState(true);
    const [filter, setFilter]         = useState<'all' | 'trending' | 'posts' | 'videos'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [visibleCount, setVisibleCount] = useState(10);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await api.get<{ library: LibraryItem[] }>('/feed/recommended');
                setLibrary(res.data.library || []);
            } catch { /* offline ok */ }
            finally { setLoading(false); }
        };
        load();
    }, []);

    const filteredLibrary = library.filter(item => {
        const q = searchQuery.toLowerCase();
        if (q && !item.name?.toLowerCase().includes(q) && !item.description?.toLowerCase().includes(q)) return false;
        if (filter === 'videos')  return !!item.filename?.match(/\.(mp4|webm|mov)$/i);
        if (filter === 'posts')   return !item.filename?.match(/\.(mp4|webm|mov|jpg|jpeg|png|gif|pdf)$/i);
        return true;
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-8 h-8 border-2 border-white/10 border-t-purple-500 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen pb-24">

            {/* ── Sticky header ── */}
            <div className="sticky top-0 z-30" style={{ ...G.nav, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                {/* Title */}
                <div className="px-4 pt-3 pb-1">
                    <h1 className="text-lg font-bold" style={{ color: D.bright }}>Recommended</h1>
                </div>

                {/* Search */}
                <div className="px-4 pb-2">
                    <div
                        className="flex items-center gap-2 px-3 py-2.5 rounded-2xl"
                        style={{ ...G.search }}
                    >
                        <FaMagnifyingGlass className="shrink-0" style={{ color: D.dim, fontSize: 13 }} />
                        <input
                            type="text"
                            placeholder="Search recommended…"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="flex-1 bg-transparent outline-none text-sm"
                            style={{ color: D.bright, caretColor: D.accent }}
                        />
                    </div>
                </div>

                {/* Filter pills */}
                <div className="flex items-center gap-1.5 px-4 pb-3 overflow-x-auto scrollbar-hide">
                    {FILTERS.map(f => (
                        <button
                            key={f.id}
                            onClick={() => setFilter(f.id as any)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0"
                            style={filter === f.id ? {
                                background: D.accentBg,
                                border: `1px solid ${D.accentBorder}`,
                                color: D.accent,
                                boxShadow: '0 2px 12px rgba(255,255,255,0.08)',
                            } : {
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.09)',
                                color: D.dim,
                            }}
                        >
                            {f.icon} {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Content ── */}
            <div className="flex-1 pt-2">
                {filteredLibrary.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="text-4xl mb-4">✨</div>
                        <p className="font-semibold" style={{ color: 'rgba(255,255,255,0.40)' }}>Nothing recommended yet</p>
                        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.22)' }}>
                            Sync with others to see their top picks
                        </p>
                    </div>
                ) : (
                    <>
                        {filteredLibrary.slice(0, visibleCount).map(item => (
                            <PostCard key={item.cid} item={item} onInteraction={() => {}} />
                        ))}

                        {visibleCount < filteredLibrary.length && (
                            <div className="flex justify-center py-6">
                                <button
                                    onClick={() => setVisibleCount(c => c + 10)}
                                    className="px-6 py-2.5 rounded-full text-sm font-semibold transition-all active:scale-95"
                                    style={{
                                        background: 'rgba(255,255,255,0.08)',
                                        border: '1px solid rgba(255,255,255,0.16)',
                                        color: D.accent,
                                    }}
                                >
                                    See more
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
