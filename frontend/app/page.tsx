"use client";

import dynamic from 'next/dynamic';

const GlobeHome = dynamic(() => import('@/components/GlobeHome'), { ssr: false });

export default function Home() {
    return <GlobeHome />;
}
