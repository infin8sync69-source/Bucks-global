"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { FaCircleCheck, FaCircleExclamation, FaCircleInfo, FaXmark } from 'react-icons/fa6';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast must be used within a ToastProvider');
    return context;
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType = 'success') => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    }, []);

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const iconColor = (type: ToastType) => {
        if (type === 'success') return 'rgba(180,255,180,0.85)';
        if (type === 'error')   return 'rgba(255,160,160,0.85)';
        return 'rgba(200,200,255,0.85)';
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center space-y-2 w-full max-w-sm px-4">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-2xl animate-in slide-in-from-bottom-5 fade-in duration-300"
                        style={{
                            background: 'linear-gradient(145deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)',
                            backdropFilter: 'blur(32px) saturate(130%)',
                            WebkitBackdropFilter: 'blur(32px) saturate(130%)',
                            border: '1px solid rgba(255,255,255,0.10)',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.12)',
                            color: 'rgba(230,230,240,0.95)',
                        }}
                    >
                        <div className="flex items-center space-x-3">
                            {toast.type === 'success' && (
                                <FaCircleCheck style={{ color: iconColor('success'), flexShrink: 0 }} />
                            )}
                            {toast.type === 'error' && (
                                <FaCircleExclamation style={{ color: iconColor('error'), flexShrink: 0 }} />
                            )}
                            {toast.type === 'info' && (
                                <FaCircleInfo style={{ color: iconColor('info'), flexShrink: 0 }} />
                            )}
                            <span className="text-sm font-medium">{toast.message}</span>
                        </div>
                        <button
                            onClick={() => removeToast(toast.id)}
                            className="opacity-40 hover:opacity-80 transition-opacity p-1 ml-3"
                            style={{ color: 'rgba(255,255,255,0.8)' }}
                        >
                            <FaXmark className="text-xs" />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
