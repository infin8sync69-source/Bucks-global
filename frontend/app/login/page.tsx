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
import { ensureRegistered } from '@/lib/sync';

const D = {
    bright: 'rgba(255,255,255,0.88)',
    mid:    'rgba(255,255,255,0.55)',
    dim:    'rgba(255,255,255,0.32)',
};

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

    const [username, setUsername] = useState('');
    const [bio, setBio] = useState('');
    const [photoDataUrl, setPhotoDataUrl] = useState<string>('');
    const [photoLoading, setPhotoLoading] = useState(false);

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
            const ok = await ensureRegistered(profile);
            if (!ok) {
                showToast('Saved locally. Server unreachable — you may not appear in search until reconnected.', 'info');
            }
            router.push('/profile');
        } finally {
            setIsBusy(false);
        }
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const parsed = JSON.parse(ev.target?.result as string);
                if (!parsed.did || !parsed.secret) { showToast('Invalid identity file.', 'error'); return; }
                const uuid7 = parsed.uuid7 || (() => {
                    const ms = Date.now();
                    const tsHex = ms.toString(16).padStart(12, '0');
                    return `${tsHex.slice(0, 8)}-${tsHex.slice(8, 12)}-7000-8000-000000000000`;
                })();
                const imported = {
                    did: parsed.did, uuid7,
                    secret: parsed.secret,
                    username: parsed.username || `User_${shortUUID(uuid7)}`,
                    avatar: parsed.avatar || '',
                    bio: parsed.bio || '',
                    createdAt: parsed.createdAt || new Date().toISOString(),
                };
                saveIdentity(imported);
                ensureRegistered(imported).catch(() => {});
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

    const inputStyle: React.CSSProperties = {
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.09)',
        color: D.bright,
        caretColor: 'rgba(255,255,255,0.70)',
        borderRadius: 12,
        width: '100%',
        padding: '12px 16px',
        fontSize: 14,
        outline: 'none',
    };

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
                            <div
                                className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4"
                                style={{
                                    background: 'rgba(255,255,255,0.07)',
                                    border: '1px solid rgba(255,255,255,0.14)',
                                    boxShadow: '0 4px 24px rgba(0,0,0,0.40), inset 0 1.5px 0 rgba(255,255,255,0.20)',
                                    color: D.mid,
                                }}
                            >
                                <FaFingerprint />
                            </div>
                            <h1 className="text-2xl font-bold" style={{ color: D.bright }}>Bucks Global</h1>
                            <p className="text-sm mt-1" style={{ color: D.dim }}>Decentralised identity · No passwords</p>
                        </div>

                        <button
                            onClick={handleCreate}
                            disabled={isBusy}
                            className="w-full p-4 rounded-2xl flex items-center gap-4 text-left group transition-all"
                            style={{
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.08)',
                            }}
                        >
                            <div
                                className="w-12 h-12 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform"
                                style={{ background: 'rgba(255,255,255,0.06)', color: D.mid }}
                            >
                                ◈
                            </div>
                            <div className="flex-1">
                                <p className="font-bold" style={{ color: D.bright }}>Create New Identity</p>
                                <p className="text-xs" style={{ color: D.dim }}>Generate your DID + unique UUID</p>
                            </div>
                            {isBusy
                                ? <div className="w-5 h-5 border-2 border-white/20 border-t-white/50 rounded-full animate-spin" />
                                : <FaArrowRight style={{ color: D.dim }} className="group-hover:opacity-80 transition-opacity" />
                            }
                        </button>

                        <label
                            className="w-full p-4 rounded-2xl flex items-center gap-4 text-left group transition-all cursor-pointer"
                            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                        >
                            <div
                                className="w-12 h-12 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform"
                                style={{ background: 'rgba(255,255,255,0.04)', color: D.dim }}
                            >
                                <FaFileImport />
                            </div>
                            <div className="flex-1">
                                <p className="font-bold" style={{ color: D.bright }}>Import Identity</p>
                                <p className="text-xs" style={{ color: D.dim }}>Restore from your identity.json file</p>
                            </div>
                            <FaArrowRight style={{ color: D.dim }} className="group-hover:opacity-80 transition-opacity" />
                            <input type="file" accept=".json" className="hidden" onChange={handleImport} />
                        </label>
                    </div>
                )}

                {/* STEP 2 — GENERATED */}
                {step === 'generated' && identity && (
                    <div className="space-y-5">
                        <button
                            onClick={() => setStep('choose')}
                            className="flex items-center gap-2 text-sm transition-opacity hover:opacity-70"
                            style={{ color: D.dim }}
                        >
                            <FaArrowLeft className="text-xs" /> Back
                        </button>

                        <div
                            className="flex items-center gap-3 p-4 rounded-2xl"
                            style={{ background: 'rgba(120,255,120,0.06)', border: '1px solid rgba(120,255,120,0.14)' }}
                        >
                            <FaCircleCheck className="text-2xl shrink-0" style={{ color: 'rgba(120,255,120,0.80)' }} />
                            <div>
                                <p className="font-bold" style={{ color: 'rgba(180,255,180,0.90)' }}>Identity Created!</p>
                                <p className="text-xs" style={{ color: 'rgba(120,255,120,0.55)' }}>Save your key file — it can't be recovered if lost.</p>
                            </div>
                        </div>

                        <div style={{ ...G.medium, borderRadius: 16, padding: 16 }}>
                            <div className="flex items-center justify-between mb-1">
                                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: D.dim }}>Your UUID</p>
                                <button
                                    onClick={() => copyText(identity.uuid7, 'uuid')}
                                    className="text-xs flex items-center gap-1 transition-opacity hover:opacity-70"
                                    style={{ color: D.mid }}
                                >
                                    {uuidCopied ? <><FaCheck style={{ color: 'rgba(120,255,120,0.80)' }} /> Copied</> : <><FaCopy /> Copy</>}
                                </button>
                            </div>
                            <p className="font-mono text-sm font-bold break-all" style={{ color: D.bright }}>{identity.uuid7}</p>
                        </div>

                        <div style={{ ...G.light, borderRadius: 16, padding: 16 }}>
                            <div className="flex items-center justify-between mb-1">
                                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: D.dim }}>DID (cryptographic key)</p>
                                <button
                                    onClick={() => copyText(identity.did, 'did')}
                                    className="text-xs flex items-center gap-1 transition-opacity hover:opacity-70"
                                    style={{ color: D.mid }}
                                >
                                    {didCopied ? <><FaCheck style={{ color: 'rgba(120,255,120,0.80)' }} /> Copied</> : <><FaCopy /> Copy</>}
                                </button>
                            </div>
                            <p className="font-mono text-xs break-all leading-relaxed" style={{ color: D.mid }}>{identity.did}</p>
                        </div>

                        <button
                            onClick={handleDownload}
                            className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all"
                            style={{
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.10)',
                                color: D.mid,
                            }}
                        >
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
                        <button
                            onClick={() => setStep('generated')}
                            className="flex items-center gap-2 text-sm transition-opacity hover:opacity-70"
                            style={{ color: D.dim }}
                        >
                            <FaArrowLeft className="text-xs" /> Back
                        </button>
                        <div>
                            <h2 className="text-xl font-bold" style={{ color: D.bright }}>Set up your profile</h2>
                            <p className="text-sm mt-1" style={{ color: D.dim }}>Add a photo and tell people who you are.</p>
                        </div>

                        {/* Photo upload */}
                        <div className="flex flex-col items-center gap-3">
                            <button
                                type="button"
                                onClick={() => photoInputRef.current?.click()}
                                className="relative w-28 h-28 rounded-full overflow-hidden group transition-opacity hover:opacity-80"
                                style={{
                                    background: photoDataUrl ? 'transparent' : 'rgba(255,255,255,0.06)',
                                    border: '2px solid rgba(255,255,255,0.10)',
                                }}
                            >
                                {photoDataUrl
                                    ? <img src={photoDataUrl} alt="avatar" className="w-full h-full object-cover" />
                                    : <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                                        {photoLoading
                                            ? <div className="w-6 h-6 border-2 border-white/20 border-t-white/50 rounded-full animate-spin" />
                                            : <>
                                                <FaCamera className="text-2xl" style={{ color: D.dim }} />
                                                <span className="text-[10px] font-semibold" style={{ color: D.dim }}>Add Photo</span>
                                            </>
                                        }
                                    </div>
                                }
                                {photoDataUrl && (
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <FaCamera className="text-white text-xl" />
                                    </div>
                                )}
                            </button>
                            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                            <p className="text-xs" style={{ color: D.dim }}>Tap to upload · cropped square</p>
                        </div>

                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: D.dim }}>
                                Username <span style={{ color: 'rgba(255,120,120,0.60)' }}>*</span>
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                placeholder="Your display name"
                                maxLength={32}
                                style={{ ...inputStyle }}
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: D.dim }}>
                                Bio <span style={{ color: 'rgba(255,255,255,0.18)' }}>(optional)</span>
                            </label>
                            <textarea
                                value={bio}
                                onChange={e => setBio(e.target.value)}
                                placeholder="Tell others a bit about yourself…"
                                maxLength={160}
                                rows={3}
                                style={{ ...inputStyle, resize: 'none' }}
                            />
                        </div>

                        <PurpleButton
                            onClick={handleEnter}
                            disabled={!username.trim() || isBusy}
                            style={{ width: '100%', padding: '14px', borderRadius: 12, fontSize: 15, opacity: !username.trim() || isBusy ? 0.4 : 1 }}
                        >
                            {isBusy ? 'Saving…' : 'Enter App →'}
                        </PurpleButton>
                    </div>
                )}
            </div>

            <p className="mt-6 text-xs" style={{ color: 'rgba(255,255,255,0.20)' }}>Bucks Global · Decentralised Identity v2</p>
        </div>
    );
}
