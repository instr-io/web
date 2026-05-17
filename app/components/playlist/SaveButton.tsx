'use client';

interface SaveButtonProps {
  onSave: () => void;
  title?: string;
}

export function SaveButton({ onSave, title = "Save playlist to your library" }: SaveButtonProps) {
  return (
    <button
      className="save-button"
      onClick={onSave}
      title={title}
    >
      <svg 
        width="18" 
        height="18" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      >
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </button>
  );
} 