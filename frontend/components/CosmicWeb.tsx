
"use client";

import React, { useRef, useEffect } from 'react';

const CosmicWeb = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;

        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Animation logic will go here

        const render = () => {
            // Clear canvas and draw animation
            animationFrameId = window.requestAnimationFrame(render);
        };
        render();

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            window.cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return <canvas ref={canvasRef} style={{ position: 'fixed', top: 0, left: 0, zIndex: -15 }} />;
};

export default CosmicWeb;
