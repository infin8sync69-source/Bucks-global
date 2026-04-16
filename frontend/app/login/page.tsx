"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    FaFingerprint, FaArrowRight, FaFileImport, FaDownload,
    FaCircleCheck, FaArrowLeft, FaCopy, FaCheck
} from 'react-icons/fa6';
import { G, Iris, Specular, PurpleButton } from '@/components/ui/Glass';
import { saveIdentity } from '@/lib/identity';
import { shortUUID } from '@/lib/uuid7';
import { useToast } from '@/components/Toast';
import api from '@/lib/api';

// Avatar options — emoji + background colour pairs
const AVATARS = [
    { emoji: '🦊', bg: '#FFE4CC' }, { emoji: '🐺', bg: '#E8E8F0' },
    { emoji: '🦁', bg: '#FFF3CC' }, { emoji: '🐯', bg: '#FFE8CC' },
    { emoji: '🦋', bg: '#F0E8FF' }, { emoji: '🌙', bg: '#E8F0FF' },
    { emoji: '⚡', bg: '#FFF8CC' }, { emoji: '🔮', bg: '#EDE0FF' },
    { emoji: '🌸', bg: '#FFE8F0' }, { emoji: '🎭', bg: '#E8F8FF' },
    { emoji: '🚀', bg: '#E0EEFF' }, { emoji: '💎', bg: '#E0F8FF' },
];

type Step = 'choose' | 'generated' | 'profile';

interface GeneratedIdentity {
    did: string;
    uuid7: string;
    secret: string;
}

export default function LoginPage() {
    const router = useRouter();
    const { showToast } = useToast();

    const [step, setStep] = useState<Step>('choose');
    const [identity, setIdentity] = useState<GeneratedIdentity | null>(null);
    const [isBusy, setIsBusy] = useState(false);
    const [didCopied, setDidCopied] = useState(false);
    const [uuidCopied, setUuidCopied] = useState(false);

    // Profile setup state
    const [username, setUsername] = useState('');
    const [bio, setBio] = useState('');
    const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);

    // ── Step 1 → Step 2: generate DID + UUID7 ────────────────────────────────
    const handleCreate = async () => {
        setIsBusy(true);
        try {
            const res = await fetch('/api/auth/generate-identity', { method: 'POST' });
            if (!res.ok) throw new Error('Generation failed');
            const data: GeneratedIdentity = await res.json();
            setIdentity(data);
            setStep('generated');
        } catch {
            showToast('Failed to generate identity. Please try again.', 'error');
        } finally {
            setIsBusy(false);
        }
    };

    // Download the key file
    const handleDownload = () => {
        if (!identity) return;
        const blob = new Blob(
            [JSON.stringify({ did: identity.did, uuid7: identity.uuid7, secret: identity.secret }, null, 2)],
            { type: 'application/json' }
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bucks_identity_${shortUUID(identity.uuid7)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ── Step 3: save profile + enter app ─────────────────────────────────────
    const handleEnter = async () => {
        if (!identity || !username.trim()) {
            showToast('Please enter a username.', 'error');
            return;
        }
        setIsBusy(true);
        try {
            const profile = {
                did: identity.did,
                uuid7: identity.uuid7,
                secret: identity.secret,
                username: username.trim(),
                avatar: selectedAvatar.emoji,
                bio: bio.trim(),
                createdAt: new Date().toISOString(),
            };

            // Persist locally first — always works
            saveIdentity(profile);

            // Register with backend (fire-and-forget — works offline too)
            api.post('/users', {
                did: profile.did,
                uuid7: profile.uuid7,
                username: profile.username,
                avatar: profile.avatar,
                bio: profile.bio,
            }).catch(() => { /* backend offline is fine */ });

            router.push('/profile');
        } finally {
            setIsBusy(false);
        }
    };

    // ── Import existing identity ──────────────────────────────────────────────
    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const parsed = JSON.parse(ev.target?.result as string);
                if (!parsed.did || !parsed.secret) {
                    showToast('Invalid identity file.', 'error');
                    return;
                }
                // Restore — if uuid7 missing generate one client-side
                const uuid7 = parsed.uuid7 || ((): string => {
                    const { generateUUID7 } = require('@/lib/uuid7');
                    return generateUUID7();
                })();
                saveIdentity({
                    did: parsed.did,
                    uuid7,
                    secret: parsed.secret,
                    username: parsed.username || `User_${shortUUID(uuid7)}`,
                    avatar: parsed.avatar || '🦊',
                    bio: parsed.bio || '',
                    createdAt: parsed.createdAt || new Date().toISOString(),
                });
                showToast('Identity restored!', 'success');
                router.push('/profile');
            } catch {
                showToast('Could not read identity file.', 'error');
            }
        };
        reader.readAsText(file);
    };

    const copyText = async (text: string, which: 'did' | 'uuid') => {
        await navigator.clipboard.writeText(text).catch(() => { });
        if (which === 'did') { setDidCopied(true); setTimeout(() => setDidCopied(false), 2000); }
        else { setUuidCopied(true); setTimeout(() => setUuidCopied(false), 2000); }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6">
            <div
                style={{ ...G.heavy, borderRadius: 32, position: 'relative', overflow: 'hidden', width: '100%', maxWidth: 440 }}
                className="p-8"
            >
                <Iris />
                <Specular />

                {/* ── STEP 1: CHOOSE ── */}
                {step === 'choose' && (
                    <div className="space-y-6">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white text-3xl mx-auto mb-4 shadow-lg shadow-primary/30">
                                <FaFingerprint />
                            </div>
                            <h1 className="text-2xl font-bold">Bucks Global</h1>
                            <p className="text-sm text-gray-500 mt-1">Decentralised identity · No passwords</p>
                        </div>

                        <button
                            onClick={handleCreate}
                            disabled={isBusy}
                            className="w-full p-4 rounded-2xl flex items-center gap-4 text-left group transition-all hover:bg-primary/5 border border-gray-100 hover:border-primary/30"
                        >
                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform text-xl">
                                🔑
                            </div>
                            <div className="flex-1">
                                <p className="font-bold text-gray-900">Create New Identity</p>
                                <p className="text-xs text-gray-500">Generate your DID + unique UUID</p>
                            </div>
                            {isBusy
                                ? <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                                : <FaArrowRight className="text-gray-300 group-hover:text-primary transition-colors" />
                            }
                        </button>

                        <label className="w-full p-4 rounded-2xl flex items-center gap-4 text-left group transition-all hover:bg-purple-50 border border-gray-100 hover:border-purple-200 cursor-pointer">
                            <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-500 group-hover:scale-110 transition-transform text-xl">
                                <FaFileImport />
                            </div>
                            <div className="flex-1">
                                <p className="font-bold text-gray-900">Import Identity</p>
                                <p className="text-xs text-gray-500">Restore from your identity.json file</p>
                            </div>
                            <FaArrowRight className="text-gray-300 group-hover:text-purple-400 transition-colors" />
                            <input type="file" accept=".json" className="hidden" onChange={handleImport} />
                        </label>
                    </div>
                )}

                {/* ── STEP 2: GENERATED ── */}
                {step === 'generated' && identity && (
                    <div className="space-y-5">
                        <button onClick={() => setStep('choose')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary transition-colors">
                            <FaArrowLeft className="text-xs" /> Back
                        </button>

                        <div className="flex items-center gap-3 p-4 rounded-2xl bg-green-50 border border-green-100">
                            <FaCircleCheck className="text-2xl text-green-500 shrink-0" />
                            <div>
                                <p className="font-bold text-green-700">Identity Created!</p>
                                <p className="text-xs text-green-600">Save your key file — it cannot be recovered.</p>
                            </div>
                        </div>

                        {/* UUID7 */}
                        <div style={{ ...G.medium, borderRadius: 16, padding: 16 }}>
                            <div className="flex items-center justify-between mb-1">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Your UUID</p>
                                <button
                                    onClick={() => copyText(identity.uuid7, 'uuid')}
                                    className="text-xs text-primary flex items-center gap-1"
                                >
                                    {uuidCopied ? <><FaCheck className="text-green-500" /> Copied</> : <><FaCopy /> Copy</>}
                                </button>
                            </div>
                            <p className="font-mono text-sm font-bold text-gray-800 break-all">{identity.uuid7}</p>
                        </div>

                        {/* DID */}
                        <div style={{ ...G.light, borderRadius: 16, padding: 16 }}>
                            <div className="flex items-center justify-between mb-1">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">DID (cryptographic key)</p>
                                <button
                                    onClick={() => copyText(identity.did, 'did')}
                                    className="text-xs text-primary flex items-center gap-1"
                                >
                                    {didCopied ? <><FaCheck className="text-green-500" /> Copied</> : <><FaCopy /> Copy</>}
                                </button>
                            </div>
                            <p className="font-mono text-xs text-gray-600 break-all leading-relaxed">{identity.did}</p>
                        </div>

                        <button
                            onClick={handleDownload}
                            className="w-full py-3 rounded-xl border-2 border-primary/30 text-primary font-semibold flex items-center justify-center gap-2 hover:bg-primary hover:text-white hover:border-primary transition-all"
                        >
                            <FaDownload /> Download Key File
                        </button>

                        <PurpleButton
                            onClick={() => setStep('profile')}
                            style={{ width: '100%', padding: '14px', borderRadius: 12, fontSize: 15 }}
                        >
                            Set Up Profile →
                        </PurpleButton>
                    </div>
                )}

                {/* ── STEP 3: PROFILE SETUP ── */}
                {step === 'profile' && identity && (
                    <div className="space-y-5">
                        <button onClick={() => setStep('generated')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary transition-colors">
                            <FaArrowLeft className="text-xs" /> Back
                        </button>

                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Who are you?</h2>
                            <p className="text-sm text-gray-500 mt-1">Choose an avatar and set your display name.</p>
                        </div>

                        {/* Avatar picker */}
                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Pick an avatar</p>
                            <div className="grid grid-cols-6 gap-2">
                                {AVATARS.map((av) => (
                                    <button
                                        key={av.emoji}
                                        onClick={() => setSelectedAvatar(av)}
                                        className="relative w-full aspect-square rounded-xl flex items-center justify-center text-2xl transition-all hover:scale-110 active:scale-95"
                                        style={{
                                            background: av.bg,
                                            boxShadow: selectedAvatar.emoji === av.emoji
                                                ? '0 0 0 3px #6A00FF, 0 4px 12px rgba(106,0,255,0.25)'
                                                : 'none',
                                            transform: selectedAvatar.emoji === av.emoji ? 'scale(1.12)' : undefined,
                                        }}
                                    >
                                        {av.emoji}
                                        {selectedAvatar.emoji === av.emoji && (
                                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                                                <FaCheck className="text-white text-[8px]" />
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Preview */}
                        <div className="flex items-center gap-3">
                            <div
                                className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-md shrink-0"
                                style={{ background: selectedAvatar.bg }}
                            >
                                {selectedAvatar.emoji}
                            </div>
                            <div>
                                <p className="font-bold text-gray-900">{username || 'Your name'}</p>
                                <p className="text-xs text-gray-400 font-mono">{shortUUID(identity.uuid7)}</p>
                            </div>
                        </div>

                        {/* Username */}
                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">
                                Username <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                placeholder="Enter your display name"
                                maxLength={32}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/70 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                            />
                        </div>

                        {/* Bio */}
                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">
                                Bio <span className="text-gray-300">(optional)</span>
                            </label>
                            <textarea
                                value={bio}
                                onChange={e => setBio(e.target.value)}
                                placeholder="Tell others a bit about yourself…"
                                maxLength={160}
                                rows={3}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/70 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all resize-none"
                            />
                        </div>

                        <PurpleButton
                            onClick={handleEnter}
                            disabled={!username.trim() || isBusy}
                            style={{ width: '100%', padding: '14px', borderRadius: 12, fontSize: 15, opacity: !username.trim() || isBusy ? 0.5 : 1 }}
                        >
                            {isBusy ? 'Saving…' : 'Enter App →'}
                        </PurpleButton>
                    </div>
                )}
            </div>

            <p className="mt-6 text-xs text-gray-400">Bucks Global · Decentralised Identity v2</p>
        </div>
    );
}
