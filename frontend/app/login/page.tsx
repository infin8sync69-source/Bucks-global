"use client";

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
    FaFingerprint, FaArrowRight, FaFileImport, FaDownload,
    FaCircleCheck, FaArrowLeft, FaCopy, FaCheck, FaCamera,
} from 'react-icons/fa6';
import { G, Iris, Specular, PurpleButton } from '@/components/ui/Glass';
import { saveIdentity } from '@/lib/identity';
import { shortUUID } from '@/lib/uuid7';
import { compressAvatar } from '@/lib/imageUtils';
import { useToast } from '@/components/Toast';
import api from '@/lib/api';

type Step = 'choose' | 'generated' | 'profile';

interface GeneratedIdentity { did: string; uuid7: string; secret: string; }

export default function LoginPage() {
    const router = useRouter();
    const { showToast } = useToast();
    const photoInputRef = useRef<HTMLInputElement>(null);

    const [step, setStep] = useState<Step>('choose');
    const [identity, setIdentity] = useState<GeneratedIdentity | null>(null);
    const [isBusy, setIsBusy] = useState(false);
    const [didCopied, setDidCopied] = useState(false);
    const [uuidCopied, setUuidCopied] = useState(false);

    // Profile setup
    const [username, setUsername] = useState('');
    const [bio, setBio] = useState('');
    const [photoDataUrl, setPhotoDataUrl] = useState<string>('');
    const [photoLoading, setPhotoLoading] = useState(false);

    // ── Generate DID + UUID7 ──────────────────────────────────────────────────
    const handleCreate = async () => {
        setIsBusy(true);
        try {
            const res = await fetch('/api/auth/generate-identity', { method: 'POST' });
            if (!res.ok) throw new Error('Failed');
            const data: GeneratedIdentity = await res.json();
            setIdentity(data);
            setStep('generated');
        } catch {
            showToast('Failed to generate identity. Please try again.', 'error');
        } finally {
            setIsBusy(false);
        }
    };

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

    // ── Photo selection ───────────────────────────────────────────────────────
    const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setPhotoLoading(true);
        try {
            const dataUrl = await compressAvatar(file, 300, 0.85);
            setPhotoDataUrl(dataUrl);
        } catch {
            showToast('Could not process image. Try another file.', 'error');
        } finally {
            setPhotoLoading(false);
            e.target.value = '';
        }
    };

    // ── Enter app ─────────────────────────────────────────────────────────────
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
                avatar: photoDataUrl,
                bio: bio.trim(),
                createdAt: new Date().toISOString(),
            };
            saveIdentity(profile);

            // Register with backend (fire-and-forget)
            api.post('/users', {
                did: profile.did,
                uuid7: profile.uuid7,
                username: profile.username,
                avatar: profile.avatar,
                bio: profile.bio,
            }).catch(() => { });

            router.push('/profile');
        } finally {
            setIsBusy(false);
        }
    };

    // ── Import existing ───────────────────────────────────────────────────────
    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const parsed = JSON.parse(ev.target?.result as string);
                if (!parsed.did || !parsed.secret) { showToast('Invalid identity file.', 'error'); return; }
                const uuid7 = parsed.uuid7 || (() => {
                    const ms = Date.now();
                    const tsHex = ms.toString(16).padStart(12, '0');
                    return `${tsHex.slice(0, 8)}-${tsHex.slice(8, 12)}-7000-8000-000000000000`;
                })();
                saveIdentity({
                    did: parsed.did, uuid7,
                    secret: parsed.secret,
                    username: parsed.username || `User_${shortUUID(uuid7)}`,
                    avatar: parsed.avatar || '',
                    bio: parsed.bio || '',
                    createdAt: parsed.createdAt || new Date().toISOString(),
                });
                showToast('Identity restored!', 'success');
                router.push('/profile');
            } catch { showToast('Could not read file.', 'error'); }
        };
        reader.readAsText(file);
    };

    const copyText = async (text: string, which: 'did' | 'uuid') => {
        await navigator.clipboard.writeText(text).catch(() => { });
        if (which === 'did') { setDidCopied(true); setTimeout(() => setDidCopied(false), 2000); }
        else { setUuidCopied(true); setTimeout(() => setUuidCopied(false), 2000); }
    };

    // ── UI ────────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6">
            <div
                style={{ ...G.heavy, borderRadius: 32, position: 'relative', overflow: 'hidden', width: '100%', maxWidth: 440 }}
                className="p-8"
            >
                <Iris />
                <Specular />

                {/* STEP 1 — CHOOSE */}
                {step === 'choose' && (
                    <div className="space-y-6">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white text-3xl mx-auto mb-4 shadow-lg shadow-primary/30">
                                <FaFingerprint />
                            </div>
                            <h1 className="text-2xl font-bold">Bucks Global</h1>
                            <p className="text-sm text-gray-500 mt-1">Decentralised identity · No passwords</p>
                        </div>

                        <button onClick={handleCreate} disabled={isBusy}
                            className="w-full p-4 rounded-2xl flex items-center gap-4 text-left group transition-all hover:bg-primary/5 border border-gray-100 hover:border-primary/30">
                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform text-xl">🔑</div>
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
                            <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-500 group-hover:scale-110 transition-transform text-xl"><FaFileImport /></div>
                            <div className="flex-1">
                                <p className="font-bold text-gray-900">Import Identity</p>
                                <p className="text-xs text-gray-500">Restore from your identity.json file</p>
                            </div>
                            <FaArrowRight className="text-gray-300 group-hover:text-purple-400 transition-colors" />
                            <input type="file" accept=".json" className="hidden" onChange={handleImport} />
                        </label>
                    </div>
                )}

                {/* STEP 2 — GENERATED */}
                {step === 'generated' && identity && (
                    <div className="space-y-5">
                        <button onClick={() => setStep('choose')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary transition-colors">
                            <FaArrowLeft className="text-xs" /> Back
                        </button>
                        <div className="flex items-center gap-3 p-4 rounded-2xl bg-green-50 border border-green-100">
                            <FaCircleCheck className="text-2xl text-green-500 shrink-0" />
                            <div>
                                <p className="font-bold text-green-700">Identity Created!</p>
                                <p className="text-xs text-green-600">Save your key file — it can't be recovered if lost.</p>
                            </div>
                        </div>

                        <div style={{ ...G.medium, borderRadius: 16, padding: 16 }}>
                            <div className="flex items-center justify-between mb-1">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Your UUID</p>
                                <button onClick={() => copyText(identity.uuid7, 'uuid')} className="text-xs text-primary flex items-center gap-1">
                                    {uuidCopied ? <><FaCheck className="text-green-500" /> Copied</> : <><FaCopy /> Copy</>}
                                </button>
                            </div>
                            <p className="font-mono text-sm font-bold text-gray-800 break-all">{identity.uuid7}</p>
                        </div>

                        <div style={{ ...G.light, borderRadius: 16, padding: 16 }}>
                            <div className="flex items-center justify-between mb-1">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">DID (cryptographic key)</p>
                                <button onClick={() => copyText(identity.did, 'did')} className="text-xs text-primary flex items-center gap-1">
                                    {didCopied ? <><FaCheck className="text-green-500" /> Copied</> : <><FaCopy /> Copy</>}
                                </button>
                            </div>
                            <p className="font-mono text-xs text-gray-600 break-all leading-relaxed">{identity.did}</p>
                        </div>

                        <button onClick={handleDownload}
                            className="w-full py-3 rounded-xl border-2 border-primary/30 text-primary font-semibold flex items-center justify-center gap-2 hover:bg-primary hover:text-white hover:border-primary transition-all">
                            <FaDownload /> Download Key File
                        </button>
                        <PurpleButton onClick={() => setStep('profile')} style={{ width: '100%', padding: '14px', borderRadius: 12, fontSize: 15 }}>
                            Set Up Profile →
                        </PurpleButton>
                    </div>
                )}

                {/* STEP 3 — PROFILE SETUP */}
                {step === 'profile' && identity && (
                    <div className="space-y-5">
                        <button onClick={() => setStep('generated')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary transition-colors">
                            <FaArrowLeft className="text-xs" /> Back
                        </button>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Set up your profile</h2>
                            <p className="text-sm text-gray-500 mt-1">Add a photo and tell people who you are.</p>
                        </div>

                        {/* Photo upload */}
                        <div className="flex flex-col items-center gap-3">
                            <button
                                type="button"
                                onClick={() => photoInputRef.current?.click()}
                                className="relative w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-xl hover:opacity-90 transition-opacity group"
                                style={{ background: photoDataUrl ? 'transparent' : 'linear-gradient(135deg,#ede9fe,#ddd6fe)' }}
                            >
                                {photoDataUrl
                                    ? <img src={photoDataUrl} alt="avatar" className="w-full h-full object-cover" />
                                    : <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                                        {photoLoading
                                            ? <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                                            : <>
                                                <FaCamera className="text-2xl text-primary/60" />
                                                <span className="text-[10px] font-semibold text-primary/60">Add Photo</span>
                                            </>
                                        }
                                    </div>
                                }
                                {/* Overlay on hover */}
                                {photoDataUrl && (
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <FaCamera className="text-white text-xl" />
                                    </div>
                                )}
                            </button>
                            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                            <p className="text-xs text-gray-400">Tap to upload · will be cropped square</p>
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
                                placeholder="Your display name"
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
