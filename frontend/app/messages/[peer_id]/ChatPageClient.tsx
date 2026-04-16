"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FaArrowLeft, FaPaperPlane, FaLock } from 'react-icons/fa6';
import { G, Iris } from '@/components/ui/Glass';
import { fetchChatHistory, sendChatMessage, type ChatMessage } from '@/lib/api';
import { getIdentity } from '@/lib/identity';
import api from '@/lib/api';

function AvatarBubble({ src, name, size = 40 }: { src?: string; name: string; size?: number }) {
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
            className="rounded-2xl flex items-center justify-center shrink-0 font-bold text-primary/60"
            style={{
                width: size,
                height: size,
                fontSize: size * 0.38,
                background: 'linear-gradient(135deg,#ede9fe,#ddd6fe)',
            }}
        >
            {name.charAt(0).toUpperCase()}
        </div>
    );
}

function formatTime(iso: string) {
    try {
        return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '';
    }
}

export default function ChatPageClient() {
    const params = useParams();
    const router = useRouter();
    const peerUuid7 = params.peer_id as string;

    const identity = getIdentity();
    const myUuid7 = identity?.uuid7 ?? '';

    const [peerName, setPeerName] = useState('');
    const [peerAvatar, setPeerAvatar] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [notAllowed, setNotAllowed] = useState(false);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    // optimistic message ids
    const [optimisticMsgs, setOptimisticMsgs] = useState<ChatMessage[]>([]);

    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const scrollToBottom = () => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Load peer info
    useEffect(() => {
        api.get(`/users/${peerUuid7}`)
            .then(res => {
                setPeerName(res.data.username || `User ${peerUuid7.slice(0, 8)}`);
                setPeerAvatar(res.data.avatar || '');
            })
            .catch(() => {
                setPeerName(`User ${peerUuid7.slice(0, 8)}`);
            });
    }, [peerUuid7]);

    const loadMessages = useCallback(async () => {
        try {
            const history = await fetchChatHistory(peerUuid7);
            setMessages(history);
            setOptimisticMsgs([]); // real data supersedes
            setNotAllowed(false);
        } catch (err: any) {
            if (err?.response?.status === 403) {
                setNotAllowed(true);
            }
        } finally {
            setLoading(false);
        }
    }, [peerUuid7]);

    useEffect(() => {
        loadMessages();
        // Poll every 3 seconds for new messages
        pollRef.current = setInterval(loadMessages, 3000);
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [loadMessages]);

    useEffect(() => {
        scrollToBottom();
    }, [messages, optimisticMsgs]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = text.trim();
        if (!trimmed || sending) return;

        setText('');
        setSending(true);

        // Optimistic message
        const optimistic: ChatMessage = {
            sender: myUuid7,
            receiver: peerUuid7,
            text: trimmed,
            timestamp: new Date().toISOString(),
            is_read: 1,
        };
        setOptimisticMsgs(prev => [...prev, optimistic]);

        try {
            await sendChatMessage(peerUuid7, trimmed);
            // Next poll will reconcile
        } catch (err) {
            console.error('Send failed', err);
            // Remove optimistic on failure
            setOptimisticMsgs(prev => prev.filter(m => m !== optimistic));
            setText(trimmed); // restore text
        } finally {
            setSending(false);
            inputRef.current?.focus();
        }
    };

    if (!identity) {
        router.replace('/login');
        return null;
    }

    // All visible messages = confirmed + optimistic (de-dupe by timestamp+text)
    const allMessages = [
        ...messages,
        ...optimisticMsgs.filter(
            o => !messages.some(m => m.timestamp === o.timestamp && m.text === o.text),
        ),
    ].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    return (
        <div className="flex flex-col h-screen max-w-lg mx-auto" style={{ background: '#f8f6ff' }}>

            {/* ── Header ── */}
            <header
                className="flex items-center gap-3 px-4 py-3 sticky top-0 z-10"
                style={{ ...G.nav, borderBottom: '1px solid rgba(255,255,255,0.5)' }}
            >
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-xl text-primary/70 hover:bg-primary/10 transition-colors shrink-0"
                >
                    <FaArrowLeft />
                </button>

                <AvatarBubble src={peerAvatar} name={peerName || '?'} size={40} />

                <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 truncate leading-tight">{peerName || '…'}</p>
                    <div className="flex items-center gap-1 text-[10px] text-primary/60 font-medium">
                        <FaLock className="text-[8px]" />
                        <span>Mutual sync · encrypted</span>
                    </div>
                </div>
            </header>

            {/* ── Body ── */}
            <main className="flex-1 overflow-y-auto px-4 py-4 space-y-3">

                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                    </div>
                )}

                {!loading && notAllowed && (
                    <div
                        style={{ ...G.medium, borderRadius: 24, position: 'relative', overflow: 'hidden' }}
                        className="p-10 text-center space-y-3 mt-10"
                    >
                        <Iris />
                        <div className="text-4xl">🔒</div>
                        <p className="font-bold text-gray-800">Not mutually synced</p>
                        <p className="text-sm text-gray-500">
                            Both you and this person need to sync each other before you can message.
                        </p>
                        <button
                            onClick={() => router.push(`/profile/${peerUuid7}`)}
                            className="mt-2 text-sm font-bold text-primary hover:underline"
                        >
                            Go to their profile →
                        </button>
                    </div>
                )}

                {!loading && !notAllowed && allMessages.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400 space-y-2">
                        <span className="text-4xl">👋</span>
                        <p className="text-sm font-medium">Say hello!</p>
                    </div>
                )}

                {!loading && !notAllowed && allMessages.map((msg, i) => {
                    const isMine = msg.sender === myUuid7;
                    const isOptimistic = optimisticMsgs.some(
                        o => o.timestamp === msg.timestamp && o.text === msg.text,
                    );
                    return (
                        <div key={i} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                            <div
                                className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                                    isMine
                                        ? 'rounded-br-sm text-white'
                                        : 'rounded-bl-sm bg-white text-gray-800'
                                } ${isOptimistic ? 'opacity-70' : ''}`}
                                style={
                                    isMine
                                        ? {
                                            background: 'linear-gradient(135deg, #9B3FFF 0%, #6A00FF 100%)',
                                            boxShadow: '0 4px 14px rgba(106,0,255,0.25)',
                                        }
                                        : {}
                                }
                            >
                                <p>{msg.text}</p>
                                <p
                                    className={`text-[9px] mt-1 text-right ${isMine ? 'text-white/60' : 'text-gray-400'}`}
                                >
                                    {formatTime(msg.timestamp)}
                                    {isOptimistic && ' ·sending'}
                                </p>
                            </div>
                        </div>
                    );
                })}

                <div ref={bottomRef} />
            </main>

            {/* ── Input ── */}
            {!notAllowed && (
                <footer
                    className="px-4 py-3 pb-8 md:pb-4"
                    style={{ ...G.nav, borderTop: '1px solid rgba(255,255,255,0.5)' }}
                >
                    <form onSubmit={handleSend} className="flex items-center gap-2">
                        <input
                            ref={inputRef}
                            type="text"
                            value={text}
                            onChange={e => setText(e.target.value)}
                            placeholder="Type a message…"
                            className="flex-1 px-4 py-2.5 rounded-2xl text-sm bg-white/70 border border-white/80 focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder-gray-400"
                            autoComplete="off"
                        />
                        <button
                            type="submit"
                            disabled={!text.trim() || sending}
                            className="w-10 h-10 rounded-2xl flex items-center justify-center text-white disabled:opacity-40 transition-all shrink-0"
                            style={{
                                background: 'linear-gradient(135deg, #9B3FFF 0%, #6A00FF 100%)',
                                boxShadow: '0 4px 14px rgba(106,0,255,0.35)',
                            }}
                        >
                            <FaPaperPlane className="text-sm -rotate-12 translate-x-0.5" />
                        </button>
                    </form>
                </footer>
            )}
        </div>
    );
}
