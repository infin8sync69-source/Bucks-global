"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
    FaMagnifyingGlass, FaLocationDot, FaXmark, FaRoute,
    FaSpinner, FaCompass,
} from 'react-icons/fa6';

const Globe = dynamic(() => import('react-globe.gl'), { ssr: false });

const TEAL       = 'rgba(0,230,200,0.85)';
const TEAL_DIM   = 'rgba(0,230,200,0.25)';
const TEAL_GLOW  = 'drop-shadow(0 0 6px rgba(0,230,200,0.60))';
const DIM        = 'rgba(255,255,255,0.38)';
const BRIGHT     = 'rgba(255,255,255,0.90)';

interface ClickedLocation {
    lat: number;
    lng: number;
    altitude: number;
    name?: string;
    city?: string;
    country?: string;
}

async function reverseGeocode(lat: number, lng: number) {
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
    const [countries, setCountries] = useState<any[]>([]);
    const [clickedLocation, setClickedLocation] = useState<ClickedLocation | null>(null);
    const [geocoding, setGeocoding] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const update = () => setDimensions({ w: window.innerWidth, h: window.innerHeight });
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);

    // Load world topology for hex-dot continent outlines
    useEffect(() => {
        fetch('https://unpkg.com/world-atlas@2/countries-110m.json')
            .then(r => r.json())
            .then(world => {
                // Dynamic import of topojson-client
                import('topojson-client').then(({ feature }) => {
                    const featureCollection = feature(world as any, (world as any).objects.countries);
                    setCountries((featureCollection as any).features);
                });
            })
            .catch(() => {/* offline ok */});
    }, []);

    // Globe controls
    useEffect(() => {
        if (!mounted || !globeRef.current) return;
        const controls = globeRef.current.controls?.();
        if (controls) {
            controls.autoRotate = true;
            controls.autoRotateSpeed = 0.3;
            controls.enableZoom = true;
            controls.minDistance = 180;
            controls.maxDistance = 600;
        }
    }, [mounted, countries]);

    const stopRotate = useCallback(() => {
        const controls = globeRef.current?.controls?.();
        if (controls) controls.autoRotate = false;
    }, []);

    const handleGlobeClick = useCallback(async ({ lat, lng, altitude }: any) => {
        if (lat == null || lng == null) return;
        stopRotate();
        setClickedLocation({ lat, lng, altitude, name: '…', city: '', country: '' });
        setGeocoding(true);
        const geo = await reverseGeocode(lat, lng);
        setClickedLocation({ lat, lng, altitude, ...geo });
        setGeocoding(false);
    }, [stopRotate]);

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
                stopRotate();
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

    return (
        <div className="relative w-full h-screen overflow-hidden" style={{ background: '#000' }}>

            {/* ── 3D Globe ── */}
            <div className="absolute inset-0" onClick={() => setClickedLocation(null)}>
                {mounted && (
                    <Globe
                        ref={globeRef}
                        width={dimensions.w}
                        height={dimensions.h}
                        backgroundColor="rgba(0,0,0,1)"
                        showGlobe={false}
                        showAtmosphere={false}
                        // Hex-dot country outlines — sphere hidden, dots form the globe shape
                        hexPolygonsData={countries}
                        hexPolygonResolution={3}
                        hexPolygonMargin={0.25}
                        hexPolygonColor={() => 'rgba(0,230,200,0.55)'}
                        hexPolygonCurvatureResolution={5}
                        hexPolygonAltitude={0.002}
                        // Click on globe surface
                        onGlobeClick={handleGlobeClick}
                        enablePointerInteraction
                        // Glow rings on click
                        ringsData={clickedLocation ? [clickedLocation] : []}
                        ringLat="lat"
                        ringLng="lng"
                        ringMaxRadius={3}
                        ringPropagationSpeed={2}
                        ringRepeatPeriod={900}
                        ringColor={() => 'rgba(0,230,200,0.50)'}
                        // Clicked point dot
                        pointsData={clickedLocation ? [clickedLocation] : []}
                        pointLat="lat"
                        pointLng="lng"
                        pointAltitude={0.01}
                        pointRadius={0.4}
                        pointColor={() => TEAL}
                    />
                )}
            </div>

            {/* ── Location card ── */}
            {clickedLocation && (
                <div
                    className="absolute left-4 right-4 z-30 animate-in slide-in-from-bottom-4 duration-300"
                    style={{ bottom: 'calc(env(safe-area-inset-bottom) + 152px)' }}
                    onClick={e => e.stopPropagation()}
                >
                    <div
                        className="relative rounded-2xl p-4 overflow-hidden"
                        style={{
                            background: 'rgba(4,10,18,0.92)',
                            backdropFilter: 'blur(32px)',
                            border: '1px solid rgba(0,230,200,0.18)',
                            boxShadow: '0 8px 40px rgba(0,0,0,0.80), 0 0 0 1px rgba(0,230,200,0.08)',
                        }}
                    >
                        {/* Specular top line */}
                        <div className="absolute top-0 left-8 right-8 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,230,200,0.20), transparent)' }} />

                        <div className="flex items-start gap-3">
                            <div
                                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                                style={{ background: 'rgba(0,230,200,0.10)', border: '1px solid rgba(0,230,200,0.25)' }}
                            >
                                {geocoding
                                    ? <FaSpinner className="animate-spin text-sm" style={{ color: TEAL }} />
                                    : <FaLocationDot className="text-sm" style={{ color: TEAL }} />
                                }
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm truncate" style={{ color: BRIGHT }}>
                                    {clickedLocation.name || '…'}
                                </p>
                                {(clickedLocation.city || clickedLocation.country) && (
                                    <p className="text-xs mt-0.5 truncate" style={{ color: DIM }}>
                                        {[clickedLocation.city, clickedLocation.country].filter(Boolean).join(', ')}
                                    </p>
                                )}
                                <p className="text-[10px] font-mono mt-1" style={{ color: 'rgba(0,230,200,0.55)' }}>
                                    {clickedLocation.lat.toFixed(4)}°, {clickedLocation.lng.toFixed(4)}°
                                </p>
                            </div>
                            <button
                                onClick={() => setClickedLocation(null)}
                                className="p-1.5 rounded-lg"
                                style={{ color: DIM }}
                            >
                                <FaXmark className="text-xs" />
                            </button>
                        </div>

                        <div className="flex gap-2 mt-3">
                            <button
                                onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${clickedLocation.lat},${clickedLocation.lng}`, '_blank')}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
                                style={{
                                    background: 'rgba(0,230,200,0.12)',
                                    border: '1px solid rgba(0,230,200,0.28)',
                                    color: TEAL,
                                    filter: TEAL_GLOW,
                                }}
                            >
                                <FaRoute /> Navigate
                            </button>
                            <button
                                onClick={() => {
                                    globeRef.current?.pointOfView(
                                        { lat: clickedLocation.lat, lng: clickedLocation.lng, altitude: 0.8 },
                                        800
                                    );
                                }}
                                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
                                style={{
                                    background: 'rgba(255,255,255,0.04)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    color: DIM,
                                }}
                            >
                                <FaCompass />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Search bar above bottom nav ── */}
            <div
                className="absolute left-0 right-0 z-30 px-4"
                style={{ bottom: 'calc(env(safe-area-inset-bottom) + 72px)' }}
                onClick={e => e.stopPropagation()}
            >
                <form onSubmit={handleSearch}>
                    <div
                        className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                        style={{
                            background: 'rgba(4,10,18,0.80)',
                            backdropFilter: 'blur(24px)',
                            border: '1px solid rgba(0,230,200,0.12)',
                            boxShadow: '0 4px 24px rgba(0,0,0,0.60)',
                        }}
                    >
                        {searching
                            ? <FaSpinner className="shrink-0 animate-spin" style={{ color: TEAL, fontSize: 14 }} />
                            : <FaMagnifyingGlass className="shrink-0" style={{ color: DIM, fontSize: 13 }} />
                        }
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search any place on Earth…"
                            className="flex-1 bg-transparent outline-none text-sm"
                            style={{ color: BRIGHT, caretColor: TEAL }}
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="shrink-0 p-1 rounded-full"
                                style={{ color: DIM }}
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
