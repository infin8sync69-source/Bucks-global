"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FaArrowLeft, FaPaperPlane, FaLock } from 'react-icons/fa6';
import { G, Iris, Specular } from '@/components/ui/Glass';
import { fetchChatHistory, sendChatMessage, type ChatMessage } from '@/lib/api';
import { getIdentity } from '@/lib/identity';
import api from '@/lib/api';

const D = {
    bright: 'rgba(255,255,255,0.88)',
    mid:    'rgba(255,255,255,0.55)',
    dim:    'rgba(255,255,255,0.32)',
};

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
            className="rounded-2xl flex items-center justify-center shrink-0 font-bold"
            style={{
                width: size,
                height: size,
                fontSize: size * 0.38,
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: D.mid,
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
    const [optimisticMsgs, setOptimisticMsgs] = useState<ChatMessage[]>([]);

    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const scrollToBottom = () => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

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
            setOptimisticMsgs([]);
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
        } catch (err) {
            console.error('Send failed', err);
            setOptimisticMsgs(prev => prev.filter(m => m !== optimistic));
            setText(trimmed);
        } finally {
            setSending(false);
            inputRef.current?.focus();
        }
    };

    if (!identity) {
        router.replace('/login');
        return null;
    }

    const allMessages = [
        ...messages,
        ...optimisticMsgs.filter(
            o => !messages.some(m => m.timestamp === o.timestamp && m.text === o.text),
        ),
    ].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    return (
        <div className="flex flex-col h-screen max-w-lg mx-auto" style={{ background: '#080810' }}>

            {/* ── Header ── */}
            <header
                className="flex items-center gap-3 px-4 py-3 sticky top-0 z-10"
                style={{ ...G.nav, borderBottom: '1px solid rgba(255,255,255,0.07)', position: 'relative', overflow: 'hidden' }}
            >
                <Specular />
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-xl transition-colors shrink-0"
                    style={{ color: D.mid }}
                >
                    <FaArrowLeft />
                </button>

                <AvatarBubble src={peerAvatar} name={peerName || '?'} size={40} />

                <div className="flex-1 min-w-0">
                    <p className="font-bold truncate leading-tight" style={{ color: D.bright }}>{peerName || '…'}</p>
                    <div className="flex items-center gap-1 text-[10px] font-medium" style={{ color: D.dim }}>
                        <FaLock className="text-[8px]" />
                        <span>Mutual sync</span>
                    </div>
                </div>
            </header>

            {/* ── Body ── */}
            <main className="flex-1 overflow-y-auto px-4 py-4 space-y-3">

                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-2 border-t-white/30 border-white/08 rounded-full animate-spin" />
                    </div>
                )}

                {!loading && notAllowed && (
                    <div
                        style={{ ...G.medium, borderRadius: 24, position: 'relative', overflow: 'hidden' }}
                        className="p-10 text-center space-y-3 mt-10"
                    >
                        <Iris />
                        <Specular />
                        <p className="font-bold" style={{ color: D.bright }}>Not mutually synced</p>
                        <p className="text-sm" style={{ color: D.dim }}>
                            Both you and this person need to sync each other before you can message.
                        </p>
                        <button
                            onClick={() => router.push(`/profile/${peerUuid7}`)}
                            className="mt-2 text-sm font-bold hover:underline"
                            style={{ color: D.mid }}
                        >
                            Go to their profile →
                        </button>
                    </div>
                )}

                {!loading && !notAllowed && allMessages.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 space-y-2" style={{ color: D.dim }}>
                        <p className="text-sm font-medium">Say hello</p>
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
                                className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                                    isMine ? 'rounded-br-sm' : 'rounded-bl-sm'
                                } ${isOptimistic ? 'opacity-60' : ''}`}
                                style={isMine ? {
                                    background: 'linear-gradient(145deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.06) 100%)',
                                    border: '1px solid rgba(255,255,255,0.16)',
                                    boxShadow: '0 4px 16px rgba(0,0,0,0.35), inset 0 1.5px 0 rgba(255,255,255,0.18)',
                                    color: D.bright,
                                    backdropFilter: 'blur(12px)',
                                } : {
                                    background: 'rgba(255,255,255,0.04)',
                                    border: '1px solid rgba(255,255,255,0.07)',
                                    boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
                                    color: D.mid,
                                }}
                            >
                                <p>{msg.text}</p>
                                <p className="text-[9px] mt-1 text-right" style={{ color: isMine ? 'rgba(255,255,255,0.40)' : D.dim }}>
                                    {formatTime(msg.timestamp)}
                                    {isOptimistic && ' · sending'}
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
                    style={{ ...G.nav, borderTop: '1px solid rgba(255,255,255,0.07)', position: 'relative', overflow: 'hidden' }}
                >
                    <Specular />
                    <form onSubmit={handleSend} className="flex items-center gap-2">
                        <input
                            ref={inputRef}
                            type="text"
                            value={text}
                            onChange={e => setText(e.target.value)}
                            placeholder="Type a message…"
                            className="flex-1 px-4 py-2.5 rounded-2xl text-sm focus:outline-none"
                            style={{
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.09)',
                                color: D.bright,
                                caretColor: 'rgba(255,255,255,0.70)',
                            }}
                            autoComplete="off"
                        />
                        <button
                            type="submit"
                            disabled={!text.trim() || sending}
                            className="w-10 h-10 rounded-2xl flex items-center justify-center transition-all shrink-0 disabled:opacity-30"
                            style={{
                                background: 'linear-gradient(145deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.07) 100%)',
                                border: '1px solid rgba(255,255,255,0.20)',
                                boxShadow: '0 4px 16px rgba(0,0,0,0.35), inset 0 1.5px 0 rgba(255,255,255,0.22)',
                                color: D.bright,
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
