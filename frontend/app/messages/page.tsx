"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FaMessage, FaRotate } from 'react-icons/fa6';
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
            className="rounded-2xl flex items-center justify-center shrink-0 text-xl font-bold text-primary/60"
            style={{
                width: size,
                height: size,
                background: 'linear-gradient(135deg,#ede9fe,#ddd6fe)',
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

    // Contacts not already in conversations
    const conversationPeers = new Set(conversations.map(c => c.peer_uuid7));
    const freshContacts = contacts.filter(c => !conversationPeers.has(c.uuid7));

    return (
        <div className="min-h-screen p-4 pb-24 max-w-lg mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 pt-2">
                <div>
                    <h1 className="text-2xl font-black text-gray-900">Messages</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Encrypted · Peer-to-peer</p>
                </div>
                <button
                    onClick={load}
                    className="w-9 h-9 flex items-center justify-center rounded-xl text-primary/70 hover:bg-primary/10 transition-colors"
                >
                    <FaRotate className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Tab bar */}
            <div
                style={{ ...G.light, borderRadius: 16 }}
                className="flex p-1 mb-5 gap-1"
            >
                {(['chats', 'contacts'] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className="flex-1 py-2 rounded-xl text-sm font-bold capitalize transition-all"
                        style={
                            tab === t
                                ? {
                                    background: 'linear-gradient(135deg, #9B3FFF 0%, #6A00FF 100%)',
                                    color: '#fff',
                                    boxShadow: '0 4px 14px rgba(106,0,255,0.35)',
                                }
                                : { color: 'rgba(100,0,200,0.5)' }
                        }
                    >
                        {t === 'chats' ? `Chats${conversations.length ? ` (${conversations.length})` : ''}` : 'New Chat'}
                    </button>
                ))}
            </div>

            {loading && (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                </div>
            )}

            {/* ── Chats tab ── */}
            {!loading && tab === 'chats' && (
                <>
                    {conversations.length === 0 ? (
                        <div
                            style={{ ...G.medium, borderRadius: 24, position: 'relative', overflow: 'hidden' }}
                            className="p-10 text-center space-y-3"
                        >
                            <Iris />
                            <div className="text-4xl">💬</div>
                            <p className="font-bold text-gray-800">No messages yet</p>
                            <p className="text-sm text-gray-500">
                                Switch to <strong>New Chat</strong> to start a conversation with someone you've mutually synced.
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
                                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full text-white text-[10px] font-bold flex items-center justify-center shadow">
                                                    {conv.unread_count > 9 ? '9+' : conv.unread_count}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <p className={`font-bold truncate ${hasUnread ? 'text-gray-900' : 'text-gray-700'}`}>
                                                    {conv.username}
                                                </p>
                                                <span className="text-[10px] text-gray-400 shrink-0 ml-2">
                                                    {timeAgo(conv.timestamp)}
                                                </span>
                                            </div>
                                            <p className={`text-sm truncate mt-0.5 ${hasUnread ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
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
                        <div
                            style={{ ...G.medium, borderRadius: 24, position: 'relative', overflow: 'hidden' }}
                            className="p-10 text-center space-y-3"
                        >
                            <Iris />
                            <div className="text-4xl">🔗</div>
                            <p className="font-bold text-gray-800">No mutual syncs yet</p>
                            <p className="text-sm text-gray-500">
                                Find people on the <strong>Search</strong> page and sync with each other — then you can message.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {/* Existing conversations at top */}
                            {conversations.length > 0 && (
                                <>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-1">
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
                                                <p className="font-bold text-gray-800 truncate">{conv.username}</p>
                                                <p className="text-xs text-gray-400 truncate">{conv.last_message}</p>
                                            </div>
                                            <span className="text-xs text-primary font-bold">Open →</span>
                                        </div>
                                    ))}
                                </>
                            )}

                            {/* New contacts */}
                            {freshContacts.length > 0 && (
                                <>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-1 mt-4">
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
                                                <p className="font-bold text-gray-800 truncate">{c.username}</p>
                                                {c.bio && <p className="text-xs text-gray-400 truncate">{c.bio}</p>}
                                            </div>
                                            <span className="text-xs text-primary font-bold">Message →</span>
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
