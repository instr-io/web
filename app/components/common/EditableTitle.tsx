'use client';

import { useState, useEffect, useRef } from 'react';

interface EditableTitleProps {
  title: string;
  onSave: (newTitle: string) => Promise<void>;
  onEditingChange?: (isEditing: boolean) => void;
  className?: string;
}

export function EditableTitle({ title, onSave, onEditingChange, className = 'page-title' }: EditableTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
    onEditingChange?.(isEditing);
  }, [isEditing, onEditingChange]);

  useEffect(() => {
    setEditValue(title);
  }, [title]);

  const handleSave = async () => {
    if (editValue.trim() === '' || editValue === title) {
      setIsEditing(false);
      setEditValue(title);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(editValue.trim());
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save title:', err);
      setEditValue(title); // Revert on error
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(title);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSave}
        disabled={isSaving}
        className={`${className} editable-title-input`}
      />
    );
  }

  return (
    <h2
      className={`${className} ui-clickable`}
      onClick={() => setIsEditing(true)}
      title="Click to edit"
    >
      {title}
    </h2>
  );
}
