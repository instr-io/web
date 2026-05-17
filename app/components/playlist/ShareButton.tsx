'use client';

import { useState } from 'react';

interface ShareButtonProps {
  onShare: () => void;
  title?: string;
  size?: 'small' | 'large';
}

export function ShareButton({ onShare, title = "Share playlist", size = 'large' }: ShareButtonProps) {
  return (
    <button
      className={`share-button ${size === 'small' ? 'share-button-small' : 'share-button-large'}`}
      onClick={onShare}
      title={title}
    >
      <svg
        width={size === 'small' ? '16' : '22'}
        height={size === 'small' ? '16' : '22'}
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      >
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
        <polyline points="16,6 12,2 8,6" />
        <line x1="12" y1="2" x2="12" y2="15" />
      </svg>
    </button>
  );
} 