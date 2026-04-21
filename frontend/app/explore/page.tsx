"use client";

import dynamic from 'next/dynamic';

// Explore — interactive globe view.
// Kept SSR-disabled because react-globe.gl relies on WebGL / window.
const GlobeHome = dynamic(() => import('@/components/GlobeHome'), { ssr: false });

export default function Explore() {
    return <GlobeHome />;
}
