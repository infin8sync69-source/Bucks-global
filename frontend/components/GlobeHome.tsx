"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
    FaMagnifyingGlass, FaLocationDot, FaXmark, FaRoute,
    FaSpinner, FaBars, FaMessage, FaCompass,
} from 'react-icons/fa6';
import Link from 'next/link';

const Globe = dynamic(() => import('react-globe.gl'), { ssr: false });

const D = {
    bright: 'rgba(255,255,255,0.92)',
    mid:    'rgba(255,255,255,0.58)',
    dim:    'rgba(255,255,255,0.32)',
    purple: '#9B3FFF',
    purpleSoft: 'rgba(155,63,255,0.90)',
};

interface ClickedLocation {
    lat: number;
    lng: number;
    altitude: number;
    name?: string;
    city?: string;
    country?: string;
}

interface GlobePoint {
    lat: number;
    lng: number;
    size: number;
    color: string;
    label: string;
}

const HOT_SPOTS: GlobePoint[] = [
    { lat: 12.9716, lng: 77.5946, size: 0.6, color: '#9B3FFF', label: 'Bengaluru' },
    { lat: 28.6139, lng: 77.2090, size: 0.5, color: '#9B3FFF', label: 'Delhi' },
    { lat: 19.0760, lng: 72.8777, size: 0.5, color: '#9B3FFF', label: 'Mumbai' },
    { lat: 51.5074, lng: -0.1278, size: 0.4, color: '#6A00FF', label: 'London' },
    { lat: 40.7128, lng: -74.0060, size: 0.5, color: '#6A00FF', label: 'New York' },
    { lat: 35.6762, lng: 139.6503, size: 0.4, color: '#6A00FF', label: 'Tokyo' },
    { lat: -33.8688, lng: 151.2093, size: 0.3, color: '#6A00FF', label: 'Sydney' },
    { lat: 48.8566, lng: 2.3522, size: 0.4, color: '#6A00FF', label: 'Paris' },
    { lat: -23.5505, lng: -46.6333, size: 0.4, color: '#6A00FF', label: 'São Paulo' },
    { lat: 1.3521, lng: 103.8198, size: 0.3, color: '#6A00FF', label: 'Singapore' },
];

async function reverseGeocode(lat: number, lng: number): Promise<{ name: string; city: string; country: string }> {
    try {
        const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lng=${lng}&format=json`,
            { headers: { 'Accept-Language': 'en' } }
        );
        const data = await r.json();
        const addr = data.address || {};
        return {
            name: data.display_name?.split(',')[0] || 'Unknown Place',
            city: addr.city || addr.town || addr.village || addr.suburb || '',
            country: addr.country || '',
        };
    } catch {
        return { name: `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`, city: '', country: '' };
    }
}

export default function GlobeHome() {
    const globeRef = useRef<any>(null);
    const [dimensions, setDimensions] = useState({ w: 390, h: 700 });
    const [clickedLocation, setClickedLocation] = useState<ClickedLocation | null>(null);
    const [geocoding, setGeocoding] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [unread] = useState(10);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const update = () => setDimensions({ w: window.innerWidth, h: window.innerHeight });
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);

    // Auto-rotate until first interaction
    useEffect(() => {
        if (!mounted || !globeRef.current) return;
        const controls = globeRef.current.controls?.();
        if (controls) {
            controls.autoRotate = true;
            controls.autoRotateSpeed = 0.4;
            controls.enableZoom = true;
            controls.minDistance = 150;
            controls.maxDistance = 500;
        }
    }, [mounted]);

    const handleGlobeClick = useCallback(async ({ lat, lng, altitude }: any) => {
        if (lat == null || lng == null) return;
        // Stop auto-rotate on interaction
        const controls = globeRef.current?.controls?.();
        if (controls) controls.autoRotate = false;

        setClickedLocation({ lat, lng, altitude, name: '…', city: '', country: '' });
        setGeocoding(true);
        const geo = await reverseGeocode(lat, lng);
        setClickedLocation({ lat, lng, altitude, ...geo });
        setGeocoding(false);
    }, []);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;
        setSearching(true);
        try {
            const r = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1`,
                { headers: { 'Accept-Language': 'en' } }
            );
            const [result] = await r.json();
            if (result && globeRef.current) {
                const lat = parseFloat(result.lat);
                const lng = parseFloat(result.lon);
                globeRef.current.pointOfView({ lat, lng, altitude: 1.5 }, 1200);
                const controls = globeRef.current.controls?.();
                if (controls) controls.autoRotate = false;
                setClickedLocation({
                    lat, lng, altitude: 1.5,
                    name: result.display_name?.split(',')[0] || searchQuery,
                    city: result.display_name?.split(',')[1]?.trim() || '',
                    country: result.display_name?.split(',').pop()?.trim() || '',
                });
            }
        } catch { /* ignore */ }
        finally { setSearching(false); }
    };

    const openNavigation = (loc: ClickedLocation) => {
        const url = `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`;
        window.open(url, '_blank');
    };

    const flyTo = (point: GlobePoint) => {
        if (!globeRef.current) return;
        const controls = globeRef.current.controls?.();
        if (controls) controls.autoRotate = false;
        globeRef.current.pointOfView({ lat: point.lat, lng: point.lng, altitude: 1.8 }, 1000);
        setClickedLocation({ lat: point.lat, lng: point.lng, altitude: 1.8, name: point.label, city: '', country: '' });
    };

    return (
        <div className="relative w-full h-screen overflow-hidden bg-black">

            {/* ── Header ── */}
            <div
                className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-5 py-4"
                style={{
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.70) 0%, transparent 100%)',
                    paddingTop: 'calc(env(safe-area-inset-top) + 12px)',
                }}
            >
                <button className="p-2 rounded-xl transition-all active:scale-90" style={{ color: D.mid }}>
                    <FaBars className="text-xl" />
                </button>

                <span
                    className="text-2xl font-black tracking-tight"
                    style={{
                        background: 'linear-gradient(135deg, #9B3FFF 0%, #c084fc 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        filter: 'drop-shadow(0 0 12px rgba(155,63,255,0.60))',
                    }}
                >
                    bucks
                </span>

                <Link href="/messages" className="relative p-2 rounded-xl transition-all active:scale-90" style={{ color: D.mid }}>
                    <FaMessage className="text-xl" />
                    {unread > 0 && (
                        <span
                            className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full text-[9px] font-black flex items-center justify-center text-white"
                            style={{
                                background: 'linear-gradient(135deg, #9B3FFF 0%, #6A00FF 100%)',
                                boxShadow: '0 2px 8px rgba(155,63,255,0.60)',
                            }}
                        >
                            {unread}
                        </span>
                    )}
                </Link>
            </div>

            {/* ── 3D Globe ── */}
            <div className="absolute inset-0" onClick={() => setClickedLocation(null)}>
                {mounted && (
                    <Globe
                        ref={globeRef}
                        width={dimensions.w}
                        height={dimensions.h}
                        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
                        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
                        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
                        atmosphereColor="rgba(155,63,255,0.35)"
                        atmosphereAltitude={0.18}
                        onGlobeClick={handleGlobeClick}
                        enablePointerInteraction
                        // Hot-spot points
                        pointsData={HOT_SPOTS}
                        pointLat="lat"
                        pointLng="lng"
                        pointAltitude={0.01}
                        pointRadius="size"
                        pointColor="color"
                        pointLabel="label"
                        onPointClick={(point: any) => flyTo(point)}
                        // Glow rings
                        ringsData={clickedLocation ? [clickedLocation] : []}
                        ringLat="lat"
                        ringLng="lng"
                        ringMaxRadius={3}
                        ringPropagationSpeed={3}
                        ringRepeatPeriod={800}
                        ringColor={() => 'rgba(155,63,255,0.60)'}
                    />
                )}
            </div>

            {/* ── Location popup ── */}
            {clickedLocation && (
                <div
                    className="absolute left-4 right-4 z-30 animate-in slide-in-from-bottom-4 duration-300"
                    style={{ bottom: 'calc(env(safe-area-inset-bottom) + 152px)' }}
                    onClick={e => e.stopPropagation()}
                >
                    <div
                        className="relative rounded-3xl p-4 overflow-hidden"
                        style={{
                            background: 'linear-gradient(145deg, rgba(20,10,40,0.95) 0%, rgba(10,5,20,0.98) 100%)',
                            backdropFilter: 'blur(40px)',
                            border: '1px solid rgba(155,63,255,0.30)',
                            boxShadow: '0 8px 40px rgba(0,0,0,0.70), 0 0 0 1px rgba(155,63,255,0.12)',
                        }}
                    >
                        {/* Specular */}
                        <div className="absolute top-0 left-8 right-8 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)' }} />

                        <div className="flex items-start gap-3">
                            <div
                                className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-0.5"
                                style={{ background: 'rgba(155,63,255,0.20)', border: '1px solid rgba(155,63,255,0.35)' }}
                            >
                                {geocoding
                                    ? <FaSpinner className="text-purple-400 animate-spin text-sm" />
                                    : <FaLocationDot className="text-purple-400 text-sm" />
                                }
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm truncate" style={{ color: D.bright }}>
                                    {clickedLocation.name || '…'}
                                </p>
                                {(clickedLocation.city || clickedLocation.country) && (
                                    <p className="text-xs mt-0.5 truncate" style={{ color: D.dim }}>
                                        {[clickedLocation.city, clickedLocation.country].filter(Boolean).join(', ')}
                                    </p>
                                )}
                                <p className="text-[10px] font-mono mt-1" style={{ color: 'rgba(155,63,255,0.60)' }}>
                                    {clickedLocation.lat.toFixed(4)}°, {clickedLocation.lng.toFixed(4)}°
                                </p>
                            </div>
                            <button
                                onClick={() => setClickedLocation(null)}
                                className="p-1.5 rounded-lg transition-all"
                                style={{ color: D.dim }}
                            >
                                <FaXmark className="text-xs" />
                            </button>
                        </div>

                        <div className="flex gap-2 mt-3">
                            <button
                                onClick={() => openNavigation(clickedLocation)}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-semibold transition-all active:scale-95"
                                style={{
                                    background: 'linear-gradient(135deg, #9B3FFF 0%, #6A00FF 100%)',
                                    color: '#fff',
                                    boxShadow: '0 4px 16px rgba(106,0,255,0.45)',
                                }}
                            >
                                <FaRoute /> Navigate
                            </button>
                            <button
                                onClick={() => {
                                    if (!globeRef.current) return;
                                    globeRef.current.pointOfView(
                                        { lat: clickedLocation.lat, lng: clickedLocation.lng, altitude: 0.8 },
                                        800
                                    );
                                }}
                                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all active:scale-95"
                                style={{
                                    background: 'rgba(155,63,255,0.15)',
                                    border: '1px solid rgba(155,63,255,0.30)',
                                    color: D.purpleSoft,
                                }}
                            >
                                <FaCompass />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Search bar (above bottom nav) ── */}
            <div
                className="absolute left-0 right-0 z-30 px-4"
                style={{ bottom: 'calc(env(safe-area-inset-bottom) + 72px)' }}
                onClick={e => e.stopPropagation()}
            >
                <form onSubmit={handleSearch}>
                    <div
                        className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                        style={{
                            background: 'rgba(12,6,24,0.85)',
                            backdropFilter: 'blur(32px)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.60), inset 0 1px 0 rgba(255,255,255,0.08)',
                        }}
                    >
                        {searching
                            ? <FaSpinner className="shrink-0 animate-spin" style={{ color: D.purpleSoft, fontSize: 15 }} />
                            : <FaMagnifyingGlass className="shrink-0" style={{ color: D.dim, fontSize: 14 }} />
                        }
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search any place on Earth…"
                            className="flex-1 bg-transparent outline-none text-sm"
                            style={{ color: D.bright, caretColor: D.purpleSoft }}
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="shrink-0 p-1 rounded-full transition-all"
                                style={{ color: D.dim }}
                            >
                                <FaXmark className="text-xs" />
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}
