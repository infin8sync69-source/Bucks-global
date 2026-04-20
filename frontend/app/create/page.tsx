"use client";

import React, { useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    FaArrowLeft, FaXmark, FaGlobe, FaUserGroup,
    FaImage, FaVideo, FaPaperclip, FaPen,
    FaPaperPlane, FaHashtag,
} from 'react-icons/fa6';
import { uploadFile } from '@/lib/api';
import api from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab = 'text' | 'photo' | 'video' | 'file';

// ── Helpers ───────────────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string; icon: React.ReactNode; accept: string }[] = [
    { id: 'text',  label: 'Post',   icon: <FaPen />,       accept: '' },
    { id: 'photo', label: 'Photo',  icon: <FaImage />,     accept: 'image/*' },
    { id: 'video', label: 'Video',  icon: <FaVideo />,     accept: 'video/*' },
    { id: 'file',  label: 'File',   icon: <FaPaperclip />, accept: '*/*' },
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_TEXT_LEN  = 2000;

// ── Main component ────────────────────────────────────────────────────────────
function CreateContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [activeTab, setActiveTab]         = useState<Tab>('text');
    const [text, setText]                   = useState('');
    const [file, setFile]                   = useState<File | null>(null);
    const [previewUrl, setPreviewUrl]       = useState<string | null>(null);
    const [visibility, setVisibility]       = useState<'public' | 'connections'>('public');
    const [isUploading, setIsUploading]     = useState(false);
    const [progress, setProgress]           = useState(0);   // 0–100
    const [error, setError]                 = useState('');
    const fileInputRef                      = useRef<HTMLInputElement>(null);

    // Derived
    const charsLeft = MAX_TEXT_LEN - text.length;
    const canSubmit = activeTab === 'text'
        ? text.trim().length > 0
        : file !== null;

    // ── File handling ──────────────────────────────────────────────────────────
    const applyFile = (selected: File) => {
        if (selected.size > MAX_FILE_SIZE) {
            setError('File too large — max 50 MB.'); return;
        }
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setFile(selected);
        setError('');
        if (selected.type.startsWith('image/') || selected.type.startsWith('video/')) {
            setPreviewUrl(URL.createObjectURL(selected));
        } else {
            setPreviewUrl(null);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) applyFile(e.target.files[0]);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files?.[0]) applyFile(e.dataTransfer.files[0]);
    };

    const clearFile = () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setFile(null); setPreviewUrl(null); setError('');
    };

    const switchTab = (tab: Tab) => {
        clearFile();
        setActiveTab(tab);
        setError('');
    };

    // ── Submit ─────────────────────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!canSubmit) return;
        setIsUploading(true);
        setError('');
        setProgress(0);

        try {
            const formData = new FormData();

            if (activeTab === 'text') {
                // Text-only post — no file attached
                formData.append('title', text.slice(0, 120).trim());
                formData.append('description', text.trim());
                formData.append('upload_type', 'text');
                formData.append('visibility', visibility);
                // Parse hashtags
                const tags = [...text.matchAll(/#(\w+)/g)].map(m => m[1]).slice(0, 10);
                if (tags.length) formData.append('tags', JSON.stringify(tags));
            } else {
                formData.append('file', file!);
                formData.append('title', file!.name);
                formData.append('description', text.trim());
                formData.append('upload_type', activeTab);
                formData.append('visibility', visibility);
                const tags = [...text.matchAll(/#(\w+)/g)].map(m => m[1]).slice(0, 10);
                if (tags.length) formData.append('tags', JSON.stringify(tags));
            }

            await api.post('/upload', formData, {
                onUploadProgress: (e) => {
                    if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
                },
            });

            router.push('/feed');
        } catch (err) {
            console.error('Upload failed', err);
            setError('Failed to post. Please try again.');
            setIsUploading(false);
            setProgress(0);
        }
    };

    const BRIGHT = 'rgba(255,255,255,0.92)';
    const MID    = 'rgba(255,255,255,0.55)';
    const DIM    = 'rgba(255,255,255,0.30)';

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div
            className="min-h-screen flex flex-col"
            style={{ background: 'rgba(8,8,16,1)' }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
        >
            {/* ── Top bar ────────────────────────────────────────────────────── */}
            <div
                className="flex items-center justify-between px-4 py-3 sticky top-0 z-20"
                style={{
                    background: 'rgba(8,8,16,0.85)',
                    backdropFilter: 'blur(32px)',
                    WebkitBackdropFilter: 'blur(32px)',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                }}
            >
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-full transition-colors"
                    style={{ color: DIM }}
                >
                    <FaXmark className="text-xl" />
                </button>

                <span className="font-black text-base" style={{ color: BRIGHT }}>New Post</span>

                <button
                    onClick={handleSubmit}
                    disabled={!canSubmit || isUploading}
                    className="flex items-center gap-2 px-5 py-2 rounded-full font-bold text-sm transition-all active:scale-95 disabled:opacity-40"
                    style={{
                        background: 'linear-gradient(145deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.08) 100%)',
                        border: '1px solid rgba(255,255,255,0.24)',
                        color: 'rgba(255,255,255,0.92)',
                        boxShadow: '0 2px 16px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.22)',
                    }}
                >
                    <FaPaperPlane className="text-xs" />
                    {isUploading ? `${progress}%` : 'Share'}
                </button>
            </div>

            {/* ── Upload progress bar ─────────────────────────────────────────── */}
            {isUploading && (
                <div className="h-0.5 w-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div
                        className="h-full transition-all duration-300"
                        style={{ width: `${progress}%`, background: 'rgba(255,255,255,0.50)' }}
                    />
                </div>
            )}

            {/* ── Tab bar ────────────────────────────────────────────────────── */}
            <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => switchTab(tab.id)}
                        className="flex-1 flex flex-col items-center gap-1 py-3 text-xs font-bold transition-all"
                        style={{
                            color: activeTab === tab.id ? BRIGHT : DIM,
                            borderBottom: activeTab === tab.id
                                ? '2px solid rgba(255,255,255,0.55)'
                                : '2px solid transparent',
                        }}
                    >
                        <span className="text-base">{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── Content area ───────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col p-4 gap-4">

                {/* TEXT TAB */}
                {activeTab === 'text' && (
                    <div className="flex-1 flex flex-col gap-3">
                        <textarea
                            value={text}
                            onChange={e => setText(e.target.value.slice(0, MAX_TEXT_LEN))}
                            placeholder="What's on your mind? Use #hashtags to categorise…"
                            className="flex-1 w-full resize-none outline-none text-base leading-relaxed min-h-[200px]"
                            style={{
                                background: 'transparent',
                                color: BRIGHT,
                                caretColor: 'rgba(255,255,255,0.70)',
                            }}
                            autoFocus
                            disabled={isUploading}
                        />

                        {/* Hashtag hints */}
                        {text.includes('#') && (
                            <div className="flex flex-wrap gap-1">
                                {[...text.matchAll(/#(\w+)/g)].slice(0, 10).map((m, i) => (
                                    <span
                                        key={i}
                                        className="px-2 py-0.5 rounded-full text-[11px] font-bold"
                                        style={{
                                            background: 'rgba(255,255,255,0.08)',
                                            border: '1px solid rgba(255,255,255,0.14)',
                                            color: MID,
                                        }}
                                    >
                                        <FaHashtag className="inline text-[9px] mr-0.5" />{m[1]}
                                    </span>
                                ))}
                            </div>
                        )}

                        <div className="flex items-center justify-between text-xs" style={{ color: DIM }}>
                            <span>{charsLeft} chars left</span>
                            <span className={charsLeft < 100 ? 'font-bold' : ''}
                                  style={{ color: charsLeft < 100 ? 'rgba(251,191,36,0.80)' : DIM }}>
                                {text.length}/{MAX_TEXT_LEN}
                            </span>
                        </div>
                    </div>
                )}

                {/* MEDIA / FILE TABS */}
                {activeTab !== 'text' && (
                    <div className="flex-1 flex flex-col gap-4">
                        {!file ? (
                            <button
                                onClick={() => {
                                    if (fileInputRef.current) {
                                        fileInputRef.current.accept = TABS.find(t => t.id === activeTab)!.accept;
                                        fileInputRef.current.click();
                                    }
                                }}
                                className="flex-1 min-h-[220px] flex flex-col items-center justify-center gap-3 rounded-3xl transition-all"
                                style={{
                                    border: '1.5px dashed rgba(255,255,255,0.14)',
                                    background: 'rgba(255,255,255,0.02)',
                                    color: DIM,
                                }}
                            >
                                <span className="text-5xl opacity-40">
                                    {TABS.find(t => t.id === activeTab)!.icon}
                                </span>
                                <div className="text-center">
                                    <p className="font-bold text-sm" style={{ color: MID }}>
                                        Tap to select {activeTab}
                                    </p>
                                    <p className="text-xs mt-0.5" style={{ color: DIM }}>or drag and drop · max 50 MB</p>
                                </div>
                            </button>
                        ) : (
                            <div className="relative rounded-3xl overflow-hidden bg-black/60 flex items-center justify-center min-h-[220px]" style={{ border: '1px solid rgba(255,255,255,0.10)' }}>
                                {previewUrl && activeTab === 'photo' && (
                                    <img src={previewUrl} alt="Preview" className="max-h-80 w-full object-contain" />
                                )}
                                {previewUrl && activeTab === 'video' && (
                                    <video src={previewUrl} className="max-h-80 w-full object-contain" autoPlay muted loop playsInline />
                                )}
                                {activeTab === 'file' && (
                                    <div className="py-16 flex flex-col items-center gap-2">
                                        <FaPaperclip className="text-4xl" style={{ color: MID }} />
                                        <p className="font-medium text-sm" style={{ color: MID }}>{file.name}</p>
                                        <p className="text-xs" style={{ color: DIM }}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                    </div>
                                )}
                                <button
                                    onClick={clearFile}
                                    className="absolute top-3 right-3 p-2 rounded-full transition-colors"
                                    style={{ background: 'rgba(0,0,0,0.55)', color: 'rgba(255,255,255,0.80)' }}
                                >
                                    <FaXmark />
                                </button>
                            </div>
                        )}

                        <textarea
                            value={text}
                            onChange={e => setText(e.target.value.slice(0, MAX_TEXT_LEN))}
                            placeholder="Write a caption… #hashtags welcome"
                            className="w-full resize-none outline-none text-sm leading-relaxed rounded-2xl p-4 min-h-[80px]"
                            style={{
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.09)',
                                color: BRIGHT,
                                caretColor: 'rgba(255,255,255,0.70)',
                            }}
                            disabled={isUploading}
                        />

                        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
                    </div>
                )}

                {/* ── Visibility ───────────────────────────────────────────────── */}
                <div className="pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                    <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: DIM }}>Audience</p>
                    <div className="flex gap-2">
                        {(['public', 'connections'] as const).map(v => (
                            <button
                                key={v}
                                onClick={() => setVisibility(v)}
                                className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                                style={{
                                    background: visibility === v ? 'rgba(255,255,255,0.10)' : 'transparent',
                                    border: `1px solid ${visibility === v ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.08)'}`,
                                    color: visibility === v ? BRIGHT : DIM,
                                }}
                            >
                                {v === 'public' ? <FaGlobe /> : <FaUserGroup />}
                                {v === 'public' ? 'Public' : 'Friends'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Error toast ────────────────────────────────────────────────── */}
            {error && (
                <div className="fixed bottom-32 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full text-sm font-bold shadow-xl animate-in fade-in slide-in-from-bottom-5 z-50"
                     style={{ background: 'rgba(239,68,68,0.90)', color: '#fff' }}>
                    {error}
                </div>
            )}
        </div>
    );
}

export default function Create() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-white" />}>
            <CreateContent />
        </Suspense>
    );
}
