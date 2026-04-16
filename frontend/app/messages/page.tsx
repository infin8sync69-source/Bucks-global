"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FaRotate } from 'react-icons/fa6';
import { G, Iris, Specular } from '@/components/ui/Glass';
import {
    fetchChatConversations,
    fetchChatContacts,
    type ChatConversation,
    type ChatContact,
} from '@/lib/api';
import { getIdentity } from '@/lib/identity';

function timeAgo(iso: string): string {
    try {
        const diff = Date.now() - new Date(iso).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins}m`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h`;
        return `${Math.floor(hrs / 24)}d`;
    } catch {
        return '';
    }
}

function AvatarBubble({ src, name, size = 48 }: { src?: string; name: string; size?: number }) {
    if (src) {
        return (
            <img
                src={src}
                alt={name}
                className="rounded-2xl object-cover shrink-0"
                style={{ width: size, height: size }}
            />
        );
    }
    return (
        <div
            className="rounded-2xl flex items-center justify-center shrink-0 font-bold"
            style={{
                width: size,
                height: size,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: 'rgba(255,255,255,0.50)',
                fontSize: size * 0.38,
            }}
        >
            {name.charAt(0).toUpperCase()}
        </div>
    );
}

export default function MessagesPage() {
    const router = useRouter();
    const identity = getIdentity();

    const [conversations, setConversations] = useState<ChatConversation[]>([]);
    const [contacts, setContacts] = useState<ChatContact[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'chats' | 'contacts'>('chats');

    const load = useCallback(async () => {
        if (!identity) return;
        try {
            const [convs, conts] = await Promise.all([
                fetchChatConversations(),
                fetchChatContacts(),
            ]);
            setConversations(convs);
            setContacts(conts);
        } catch (e) {
            console.error('Messages load error', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    if (!identity) {
        router.replace('/login');
        return null;
    }

    const conversationPeers = new Set(conversations.map(c => c.peer_uuid7));
    const freshContacts = contacts.filter(c => !conversationPeers.has(c.uuid7));

    const dimText   = 'rgba(255,255,255,0.35)';
    const midText   = 'rgba(255,255,255,0.55)';
    const brightText = 'rgba(255,255,255,0.88)';

    return (
        <div className="min-h-screen p-4 pb-24 max-w-lg mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 pt-2">
                <div>
                    <h1 className="text-2xl font-black" style={{ color: brightText }}>Messages</h1>
                    <p className="text-sm mt-0.5" style={{ color: dimText }}>Encrypted · Peer-to-peer</p>
                </div>
                <button
                    onClick={load}
                    className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors"
                    style={{ color: midText }}
                >
                    <FaRotate className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Tab bar */}
            <div style={{ ...G.light, borderRadius: 16 }} className="flex p-1 mb-5 gap-1">
                {(['chats', 'contacts'] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className="flex-1 py-2 rounded-xl text-sm font-bold capitalize transition-all"
                        style={
                            tab === t
                                ? {
                                    background: 'linear-gradient(145deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.07) 100%)',
                                    border: '1px solid rgba(255,255,255,0.18)',
                                    boxShadow: '0 4px 16px rgba(0,0,0,0.30), inset 0 1.5px 0 rgba(255,255,255,0.20)',
                                    color: brightText,
                                }
                                : { color: dimText }
                        }
                    >
                        {t === 'chats' ? `Chats${conversations.length ? ` (${conversations.length})` : ''}` : 'New Chat'}
                    </button>
                ))}
            </div>

            {loading && (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-t-white/40 border-white/10 rounded-full animate-spin" />
                </div>
            )}

            {/* ── Chats tab ── */}
            {!loading && tab === 'chats' && (
                <>
                    {conversations.length === 0 ? (
                        <div style={{ ...G.medium, borderRadius: 24, position: 'relative', overflow: 'hidden' }} className="p-10 text-center space-y-3">
                            <Iris />
                            <Specular />
                            <p className="font-bold" style={{ color: brightText }}>No messages yet</p>
                            <p className="text-sm" style={{ color: dimText }}>
                                Switch to <strong style={{ color: midText }}>New Chat</strong> to start a conversation with someone you've mutually synced.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {conversations.map(conv => {
                                const hasUnread = conv.unread_count > 0;
                                return (
                                    <div
                                        key={conv.peer_uuid7}
                                        onClick={() => router.push(`/messages/${conv.peer_uuid7}`)}
                                        style={{ ...G.card, borderRadius: 20, position: 'relative', overflow: 'hidden' }}
                                        className="flex items-center gap-3 p-3 cursor-pointer hover:scale-[1.01] transition-transform active:scale-[0.99]"
                                    >
                                        <div className="relative">
                                            <AvatarBubble src={conv.avatar} name={conv.username} size={48} />
                                            {hasUnread && (
                                                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center"
                                                    style={{ background: 'rgba(255,255,255,0.22)', color: 'rgba(255,255,255,0.95)', border: '1px solid rgba(255,255,255,0.28)' }}>
                                                    {conv.unread_count > 9 ? '9+' : conv.unread_count}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <p className="font-bold truncate" style={{ color: hasUnread ? brightText : midText }}>
                                                    {conv.username}
                                                </p>
                                                <span className="text-[10px] shrink-0 ml-2" style={{ color: dimText }}>
                                                    {timeAgo(conv.timestamp)}
                                                </span>
                                            </div>
                                            <p className="text-sm truncate mt-0.5" style={{ color: hasUnread ? midText : dimText, fontWeight: hasUnread ? 500 : 400 }}>
                                                {conv.last_message || 'No messages yet'}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {/* ── New Chat tab ── */}
            {!loading && tab === 'contacts' && (
                <>
                    {contacts.length === 0 ? (
                        <div style={{ ...G.medium, borderRadius: 24, position: 'relative', overflow: 'hidden' }} className="p-10 text-center space-y-3">
                            <Iris />
                            <Specular />
                            <p className="font-bold" style={{ color: brightText }}>No mutual syncs yet</p>
                            <p className="text-sm" style={{ color: dimText }}>
                                Find people on the <strong style={{ color: midText }}>Search</strong> page and sync with each other — then you can message.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {conversations.length > 0 && (
                                <>
                                    <p className="text-[10px] font-bold uppercase tracking-widest px-1" style={{ color: dimText }}>
                                        Continue conversation
                                    </p>
                                    {conversations.map(conv => (
                                        <div
                                            key={conv.peer_uuid7}
                                            onClick={() => router.push(`/messages/${conv.peer_uuid7}`)}
                                            style={{ ...G.card, borderRadius: 20 }}
                                            className="flex items-center gap-3 p-3 cursor-pointer hover:scale-[1.01] transition-transform active:scale-[0.99]"
                                        >
                                            <AvatarBubble src={conv.avatar} name={conv.username} size={44} />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold truncate" style={{ color: brightText }}>{conv.username}</p>
                                                <p className="text-xs truncate" style={{ color: dimText }}>{conv.last_message}</p>
                                            </div>
                                            <span className="text-xs font-bold" style={{ color: midText }}>Open →</span>
                                        </div>
                                    ))}
                                </>
                            )}

                            {freshContacts.length > 0 && (
                                <>
                                    <p className="text-[10px] font-bold uppercase tracking-widest px-1 mt-4" style={{ color: dimText }}>
                                        Start a new chat
                                    </p>
                                    {freshContacts.map(c => (
                                        <div
                                            key={c.uuid7}
                                            onClick={() => router.push(`/messages/${c.uuid7}`)}
                                            style={{ ...G.card, borderRadius: 20 }}
                                            className="flex items-center gap-3 p-3 cursor-pointer hover:scale-[1.01] transition-transform active:scale-[0.99]"
                                        >
                                            <AvatarBubble src={c.avatar} name={c.username} size={44} />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold truncate" style={{ color: brightText }}>{c.username}</p>
                                                {c.bio && <p className="text-xs truncate" style={{ color: dimText }}>{c.bio}</p>}
                                            </div>
                                            <span className="text-xs font-bold" style={{ color: midText }}>Message →</span>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
