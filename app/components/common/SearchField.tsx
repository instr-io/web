'use client';

import { ReactNode, Ref } from 'react';

interface SearchFieldProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  inputClassName?: string;
  inputRef?: Ref<HTMLInputElement>;
  action?: {
    label: ReactNode;
    title?: string;
    className?: string;
    onClick: () => void;
  };
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}

function joinClasses(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(' ');
}

export function SearchField({
  value,
  onValueChange,
  placeholder = '',
  disabled = false,
  autoFocus = false,
  className,
  inputClassName,
  inputRef,
  action,
  onKeyDown,
}: SearchFieldProps) {
  return (
    <div className={joinClasses('search-field-shell', className)}>
      <input
        ref={inputRef}
        autoFocus={autoFocus}
        type="text"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        spellCheck={false}
        className={joinClasses('search-field-input', inputClassName)}
        disabled={disabled}
      />
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className={joinClasses('search-field-action', action.className)}
          title={action.title}
          disabled={disabled}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
