"use client";

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import StoryCircles from '@/components/StoryCircles';
import PostCard from '@/components/PostCard';
import { LibraryItem, fetchAllInteractions, fetchAggregatedFeed, fetchFollowing } from '@/lib/api';
import {
  FaFilter, FaListUl, FaImage, FaVideo, FaFileLines,
  FaCheck, FaChevronDown, FaArrowDownShortWide,
  FaPlus,
  FaEarthAmericas, FaUsers, FaArrowUpWideShort
} from 'react-icons/fa6';
import Link from 'next/link';
import { G } from '@/components/ui/Glass';

function FeedContent() {
  const searchParams = useSearchParams();
  const filterCid = searchParams.get('cid');
  const filterAuthor = searchParams.get('author');

  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterType, setFilterType] = useState<'all' | 'images' | 'videos' | 'files'>('all');
  const [source, setSource] = useState<'global' | 'following'>('global');
  const [sortBy, setSortBy] = useState<'newest' | 'popular'>('newest');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [interactions, setInteractions] = useState<any>({});
  const [backendOffline, setBackendOffline] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [feedData, followingData, interactionsRes] = await Promise.all([
          fetchAggregatedFeed(),
          fetchFollowing(),
          fetchAllInteractions()
        ]);

        setLibrary(feedData.library || []);
        setFollowing((followingData || []).map((f: any) => f.following_peer_id || f));
        setInteractions(interactionsRes || {});
      } catch (error: any) {
        if (error?.code === 'ERR_NETWORK' || error?.message === 'Network Error') {
          setBackendOffline(true);
        } else {
          console.error('Failed to load feed data', error);
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const filteredLibrary = library
    .filter(item => {
      if (filterCid && item.cid !== filterCid) return false;
      if (filterAuthor && item.author !== filterAuthor) return false;

      if (filterType === 'images') {
        if (!item.filename?.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/i)) return false;
      }
      if (filterType === 'videos') {
        if (!item.filename?.toLowerCase().match(/\.(mp4|webm|mov)$/i)) return false;
      }
      if (filterType === 'files') {
        const isMedia = item.filename?.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|mp4|webm|mov)$/i);
        if (isMedia) return false;
      }

      if (source === 'following') {
        if (!following.includes(item.author)) return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      }
      if (sortBy === 'popular') {
        const engA = (interactions[a.cid]?.likes_count || 0) + (interactions[a.cid]?.comments?.length || 0);
        const engB = (interactions[b.cid]?.likes_count || 0) + (interactions[b.cid]?.comments?.length || 0);
        return engB - engA;
      }
      return 0;
    });

  const handlePostDeleted = (cid: string) => {
    setLibrary(prev => prev.filter(item => item.cid !== cid));
  };

  const handlePostUpdated = (cid: string, newTitle: string, newDescription: string) => {
    setLibrary(prev => prev.map(item =>
      item.cid === cid ? { ...item, name: newTitle, description: newDescription } : item
    ));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      <StoryCircles library={library} />

      {/* Filter Bar */}
      <div
        className="flex items-center justify-between px-4 py-2 sticky top-0 z-30"
        style={{ ...G.nav, borderBottom: "1px solid rgba(255,255,255,0.38)" }}
      >
        <div className="flex items-center space-x-1">
          {[
            { id: 'all', icon: <FaListUl />, label: 'All' },
            { id: 'images', icon: <FaImage />, label: 'Images' },
            { id: 'videos', icon: <FaVideo />, label: 'Videos' },
            { id: 'files', icon: <FaFileLines />, label: 'Files' },
          ].map(type => (
            <button
              key={type.id}
              onClick={() => setFilterType(type.id as any)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all"
              style={filterType === type.id ? {
                background: "linear-gradient(135deg, #9B3FFF 0%, #6A00FF 100%)",
                color: "#fff",
                boxShadow: "0 4px 16px rgba(106,0,255,0.35)",
                transform: "scale(1.05)",
              } : {
                ...G.btn,
                color: "rgba(100,0,200,0.55)",
                borderRadius: 9999,
              }}
            >
              {type.icon}
              <span className="hidden sm:inline">{type.label}</span>
            </button>
          ))}
        </div>

        <div className="relative">
          <button
            onClick={() => setShowFilterMenu(!showFilterMenu)}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all"
          style={showFilterMenu || source !== 'global' || sortBy !== 'newest' ? {
            background: 'rgba(155,63,255,0.18)',
            border: '1px solid rgba(155,63,255,0.35)',
            color: 'rgba(155,63,255,0.90)',
          } : { ...G.btn, color: 'rgba(255,255,255,0.38)' }}
          >
            <FaFilter className="text-[10px]" />
            <span>Filter</span>
            <FaChevronDown className={`text-[8px] transition-transform ${showFilterMenu ? 'rotate-180' : ''}`} />
          </button>

          {showFilterMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowFilterMenu(false)}></div>
              <div
                className="absolute right-0 mt-2 w-56 rounded-2xl py-2 z-50"
                style={{ ...G.sheet, borderRadius: 16 }}
              >
                <div className="px-4 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.30)' }}>Feed Source</span>
                  <div className="flex flex-col mt-2 space-y-1">
                    {[
                      { id: 'global', icon: <FaEarthAmericas />, label: 'Global Swarm' },
                      { id: 'following', icon: <FaUsers />, label: 'Following Only' },
                    ].map(s => (
                      <button
                        key={s.id}
                        onClick={() => { setSource(s.id as any); setShowFilterMenu(false); }}
                        className="flex items-center justify-between px-2 py-1.5 rounded-lg text-sm transition-colors"
                        style={{ color: source === s.id ? 'rgba(155,63,255,0.90)' : 'rgba(255,255,255,0.55)' }}
                      >
                        <div className="flex items-center space-x-2">
                          <span>{s.icon}</span>
                          <span className={source === s.id ? 'font-bold' : ''}>{s.label}</span>
                        </div>
                        {source === s.id && <FaCheck className="text-[10px]" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="px-4 py-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.30)' }}>Sort By</span>
                  <div className="flex flex-col mt-2 space-y-1">
                    {[
                      { id: 'newest', icon: <FaArrowDownShortWide />, label: 'Latest First' },
                      { id: 'popular', icon: <FaArrowUpWideShort />, label: 'Top Engagement' },
                    ].map(s => (
                      <button
                        key={s.id}
                        onClick={() => { setSortBy(s.id as any); setShowFilterMenu(false); }}
                        className="flex items-center justify-between px-2 py-1.5 rounded-lg text-sm transition-colors"
                        style={{ color: sortBy === s.id ? 'rgba(155,63,255,0.90)' : 'rgba(255,255,255,0.55)' }}
                      >
                        <div className="flex items-center space-x-2">
                          <span>{s.icon}</span>
                          <span className={sortBy === s.id ? 'font-bold' : ''}>{s.label}</span>
                        </div>
                        {sortBy === s.id && <FaCheck className="text-[10px]" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex-1">
        {(filterCid || filterAuthor) && (
          <div className="px-4 py-2 flex items-center justify-between" style={{ background: 'rgba(155,63,255,0.08)', borderBottom: '1px solid rgba(155,63,255,0.15)' }}>
            <span className="text-xs font-medium" style={{ color: 'rgba(155,63,255,0.80)' }}>
              Showing {filterCid ? 'selected post' : `posts by ${filterAuthor}`}
            </span>
            <button
              onClick={() => { window.history.replaceState(null, '', '/feed'); window.location.reload(); }}
              className="text-[10px] font-bold uppercase"
              style={{ color: 'rgba(155,63,255,0.80)' }}
            >
              Clear Filter
            </button>
          </div>
        )}

        {backendOffline && (
          <div
            className="mx-4 mt-4 p-4 rounded-2xl flex items-start space-x-3"
            style={{ ...G.medium, borderRadius: 16 }}
          >
            <span className="text-xl">📡</span>
            <div>
              <p className="text-sm font-bold text-amber-800">Backend node is offline</p>
              <p className="text-xs text-amber-600 mt-0.5">Content will appear once your node is running. You can still create an identity and browse local content.</p>
            </div>
          </div>
        )}

        {filteredLibrary.length === 0 && !backendOffline ? (
          <div className="text-center py-20 mx-4 rounded-3xl" style={{ border: '1px dashed rgba(255,255,255,0.10)' }}>
            <div className="text-4xl mb-4">🛸</div>
            <h3 className="font-bold" style={{ color: 'rgba(255,255,255,0.60)' }}>No content found</h3>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.30)' }}>Try adjusting your filters or source.</p>
            <button
              onClick={() => { setFilterType('all'); setSource('global'); setSortBy('newest'); }}
              className="mt-6 text-xs font-bold uppercase tracking-widest"
              style={{ color: 'rgba(155,63,255,0.75)' }}
            >
              Reset all filters
            </button>
          </div>
        ) : (
          filteredLibrary.map((item) => (
            <PostCard
              key={item.cid}
              item={item}
              onPostDeleted={handlePostDeleted}
              onPostUpdated={handlePostUpdated}
            />
          ))
        )}
      </div>

      {/* Floating Action Button */}
      <Link
        href="/create"
        className="fixed bottom-24 right-6 w-14 h-14 bg-primary text-white rounded-full shadow-2xl shadow-primary/40 flex items-center justify-center text-2xl hover:scale-110 hover:bg-primary/90 active:scale-95 transition-all z-40 md:bottom-10"
      >
        <FaPlus />
      </Link>
    </div>
  );
}

export default function Feed() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    }>
      <FeedContent />
    </Suspense>
  );
}
