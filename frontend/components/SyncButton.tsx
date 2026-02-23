"use client";

import React, { useState } from "react";
import { FaArrowsRotate, FaCircleCheck, FaSpinner } from "react-icons/fa6";

import { followPeer, unfollowPeer } from "../lib/api";

interface SyncButtonProps {
  peerId: string;
  initialSynced?: boolean;
  onSyncChange?: (synced: boolean) => void;
}

export default function SyncButton({
  peerId,
  initialSynced = false,
  onSyncChange,
}: SyncButtonProps) {
  const [isSynced, setIsSynced] = useState(initialSynced);
  const [isLoading, setIsLoading] = useState(false);

  const handleSync = async () => {
    setIsLoading(true);
    try {
      if (isSynced) {
        await unfollowPeer(peerId);
      } else {
        await followPeer(peerId);
      }
      const newState = !isSynced;
      setIsSynced(newState);
      onSyncChange?.(newState);
    } catch (error: unknown) {
      console.error("Sync error:", error);
      const err = error as {
        response?: { data?: { detail?: string } };
        message?: string;
      };
      alert(
        err?.response?.data?.detail ||
          err?.message ||
          "Failed to update sync status",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleSync}
      disabled={isLoading}
      className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
        isSynced
          ? "bg-gray-100 text-foreground hover:bg-gray-200"
          : "bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20"
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {isLoading ? (
        <>
          <FaSpinner className="animate-spin" />
          <span>{isSynced ? "Unsyncing..." : "Syncing..."}</span>
        </>
      ) : isSynced ? (
        <>
          <FaCircleCheck />
          <span>Synced</span>
        </>
      ) : (
        <>
          <FaArrowsRotate />
          <span>Sync</span>
        </>
      )}
    </button>
  );
}
