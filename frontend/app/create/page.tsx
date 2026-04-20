"use client";

import React, { useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    FaXmark, FaGlobe, FaUserGroup, FaImage, FaVideo,
    FaFileLines, FaArrowUp, FaLocationDot,
} from 'react-icons/fa6';
import { uploadFile } from '@/lib/api';
import { G, Iris, Specular } from '@/components/ui/Glass';
import { getIdentity } from '@/lib/identity';

const D = {
    bright: 'rgba(255,255,255,0.92)',
    mid:    'rgba(255,255,255,0.55)',
    dim:    'rgba(255,255,255,0.30)',
    purple: 'rgba(155,63,255,0.90)',
    purpleBg: 'rgba(155,63,255,0.15)',
    purpleBorder: 'rgba(155,63,255,0.30)',
};

const MAX_FILE_SIZE = 50 * 1024 * 1024;

function CreateContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const isStory = searchParams?.get('type') === 'story';

    const [file, setFile]               = useState<File | null>(null);
    const [caption, setCaption]         = useState('');
    const [visibility, setVisibility]   = useState<'public' | 'connections'>('public');
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError]             = useState('');
    const [previewUrl, setPreviewUrl]   = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const identity = typeof window !== 'undefined' ? getIdentity() : null;

    const applyFile = (f: File) => {
        if (f.size > MAX_FILE_SIZE) { setError('File too large. Max 50 MB.'); return; }
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setFile(f);
        setError('');
        if (f.type.startsWith('image/') || f.type.startsWith('video/')) {
            setPreviewUrl(URL.createObjectURL(f));
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

    const handleSubmit = async () => {
        if (!caption.trim() && !file) return;
        setIsUploading(true);
        setError('');

        const formData = new FormData();
        if (file) formData.append('file', file);
        formData.append('title', caption || 'Untitled Post');
        formData.append('description', caption);
        formData.append('visibility', visibility);

        try {
            await uploadFile(formData);
            router.push('/feed');
        } catch {
            setError('Failed to post. Please try again.');
            setIsUploading(false);
        }
    };

    const isImage = file?.type.startsWith('image/');
    const isVideo = file?.type.startsWith('video/');

    return (
        <div
            className="min-h-screen flex flex-col items-center justify-end md:justify-center px-0 pb-0"
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
        >
            {/* ── Bottom-sheet card ── */}
            <div
                className="w-full max-w-lg relative overflow-hidden"
                style={{
                    ...G.sheet,
                    borderRadius: '28px 28px 0 0',
                    borderTop: '1px solid rgba(255,255,255,0.12)',
                    borderLeft: '1px solid rgba(255,255,255,0.09)',
                    borderRight: '1px solid rgba(255,255,255,0.09)',
                    borderBottom: 'none',
                    minHeight: '60vh',
                    paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)',
                }}
            >
                <Specular />
                <Iris opacity={0.3} />

                {/* Handle */}
                <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.18)' }} />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    <button onClick={() => router.back()} className="p-2 rounded-xl transition-all active:scale-90" style={{ color: D.dim }}>
                        <FaXmark className="text-lg" />
                    </button>
                    <span className="font-bold text-base" style={{ color: D.bright }}>
                        {isStory ? 'Add to Story' : 'Create a Post'}
                    </span>
                    <button
                        onClick={handleSubmit}
                        disabled={isUploading || (!caption.trim() && !file)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-40"
                        style={{
                            background: 'linear-gradient(135deg, #9B3FFF 0%, #6A00FF 100%)',
                            color: '#fff',
                            boxShadow: '0 4px 16px rgba(106,0,255,0.40)',
                        }}
                    >
                        {isUploading ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>Post</>
                        )}
                    </button>
                </div>

                {/* Author row */}
                <div className="flex items-center gap-3 px-5 py-4">
                    <div
                        className="w-10 h-10 rounded-full overflow-hidden shrink-0"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
                    >
                        {identity?.avatar
                            ? <img src={identity.avatar} alt="" className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-sm font-bold" style={{ color: D.dim }}>
                                {identity?.username?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                        }
                    </div>
                    <div>
                        <p className="text-sm font-semibold" style={{ color: D.bright }}>{identity?.username || 'You'}</p>
                        {/* Visibility picker */}
                        <div className="flex items-center gap-2 mt-1">
                            {[
                                { id: 'public',      icon: <FaGlobe className="text-[10px]" />,      label: 'Public' },
                                { id: 'connections', icon: <FaUserGroup className="text-[10px]" />,   label: 'Friends' },
                            ].map(v => (
                                <button
                                    key={v.id}
                                    onClick={() => setVisibility(v.id as any)}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all"
                                    style={visibility === v.id ? {
                                        background: D.purpleBg,
                                        border: `1px solid ${D.purpleBorder}`,
                                        color: D.purple,
                                    } : {
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        color: D.dim,
                                    }}
                                >
                                    {v.icon} {v.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Caption textarea */}
                <div className="px-5 pb-3">
                    <textarea
                        value={caption}
                        onChange={e => setCaption(e.target.value)}
                        placeholder="Share what's on your mind…"
                        rows={4}
                        autoFocus
                        className="w-full resize-none outline-none text-sm leading-relaxed"
                        style={{
                            background: 'transparent',
                            color: D.bright,
                            caretColor: 'rgba(155,63,255,0.90)',
                        }}
                    />
                </div>

                {/* Media preview */}
                {previewUrl && (
                    <div className="mx-5 mb-4 rounded-2xl overflow-hidden relative" style={{ maxHeight: 300 }}>
                        {isVideo
                            ? <video src={previewUrl} className="w-full h-full object-cover max-h-72" autoPlay muted loop />
                            : <img src={previewUrl} alt="Preview" className="w-full h-auto max-h-72 object-cover" />
                        }
                        <button
                            onClick={() => { if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); setFile(null); }}
                            className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
                            style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}
                        >
                            <FaXmark className="text-xs" />
                        </button>
                    </div>
                )}

                {/* Non-image file pill */}
                {file && !previewUrl && (
                    <div className="mx-5 mb-4 flex items-center gap-3 px-4 py-3 rounded-2xl" style={{ ...G.medium }}>
                        <FaFileLines style={{ color: D.purple }} />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: D.bright }}>{file.name}</p>
                            <p className="text-xs" style={{ color: D.dim }}>{(file.size / 1024).toFixed(0)} KB</p>
                        </div>
                        <button onClick={() => setFile(null)} style={{ color: D.dim }}>
                            <FaXmark className="text-xs" />
                        </button>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="mx-5 mb-3 px-4 py-2.5 rounded-xl text-sm" style={{ background: 'rgba(255,80,80,0.12)', border: '1px solid rgba(255,80,80,0.25)', color: 'rgba(252,165,165,0.90)' }}>
                        {error}
                    </div>
                )}

                {/* Toolbar */}
                <div
                    className="flex items-center gap-2 px-5 py-3"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
                >
                    <input ref={fileInputRef} type="file" accept="image/*,video/*,application/pdf,.doc,.docx,.zip" className="hidden" onChange={handleFileChange} />

                    {[
                        { icon: <FaImage />,     accept: 'image/*',  label: 'Photo' },
                        { icon: <FaVideo />,     accept: 'video/*',  label: 'Video' },
                        { icon: <FaFileLines />, accept: undefined,  label: 'File' },
                    ].map(item => (
                        <button
                            key={item.label}
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-90"
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: D.dim }}
                        >
                            {item.icon}
                            <span className="hidden sm:inline">{item.label}</span>
                        </button>
                    ))}

                    <div className="ml-auto">
                        <span className="text-xs" style={{ color: caption.length > 450 ? 'rgba(252,165,165,0.80)' : D.dim }}>
                            {500 - caption.length}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function CreatePage() {
    return (
        <Suspense>
            <CreateContent />
        </Suspense>
    );
}
