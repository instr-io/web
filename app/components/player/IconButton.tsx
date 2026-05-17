'use client';

interface IconButtonProps {
  icon: 'play' | 'pause' | 'next' | 'previous' | 'shuffle' | 'repeat';
  onClick: () => void;
  active?: boolean;
  size?: 'normal' | 'large';
  title?: string;
  disabled?: boolean;
}

export function IconButton({ icon, onClick, active = false, size = 'normal', title, disabled = false }: IconButtonProps) {
  const icons = {
    play: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5v14l11-7z"/>
      </svg>
    ),
    pause: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
      </svg>
    ),
    next: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
      </svg>
    ),
    previous: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6 6h2v12H6V6zm3.5 6l8.5 6V6l-8.5 6z"/>
      </svg>
    ),
    shuffle: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
      </svg>
    ),
    repeat: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
      </svg>
    ),
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`icon-button ${active ? 'active' : ''} ${size === 'large' ? 'large' : ''}`}
      title={title}
    >
      {icons[icon]}
    </button>
  );
} 
