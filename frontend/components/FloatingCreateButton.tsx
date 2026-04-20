"use client";

import React from 'react';
import Link from 'next/link';
import { FaPlus } from 'react-icons/fa6';
import { usePathname } from 'next/navigation';

export default function FloatingCreateButton() {
    const pathname = usePathname();
    
    // Hide FAB on create page or login/recover pages
    const hideOnPages = ['/create', '/login', '/recover', '/qr-scan'];
    const shouldHide = hideOnPages.some(page => pathname.startsWith(page));
    
    if (shouldHide) return null;

    return (
        <Link
            href="/create"
            className="fixed bottom-24 right-6 md:bottom-8 md:right-8 z-40 flex items-center justify-center w-16 h-16 rounded-full text-white text-2xl shadow-2xl transition-all active:scale-90 hover:scale-110"
            style={{
                background: 'linear-gradient(145deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.08) 100%)',
                border: '1px solid rgba(255,255,255,0.26)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.45), inset 0 1.5px 0 rgba(255,255,255,0.28)',
            }}
            title="Create post"
        >
            <FaPlus />
        </Link>
    );
}
