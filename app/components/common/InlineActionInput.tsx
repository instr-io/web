'use client';

import { ReactNode } from 'react';

interface InlineActionInputProps {
  variant?: 'selection' | 'overlay';
  className?: string;
  formClassName?: string;
  inputClassName?: string;
  submitButtonClassName?: string;
  cancelButtonClassName?: string;
  placeholder: string;
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  submitLabel: ReactNode;
  disabled?: boolean;
  submitDisabled?: boolean;
  autoFocus?: boolean;
}

function joinClasses(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function InlineActionInput({
  variant = 'selection',
  className,
  formClassName,
  inputClassName,
  submitButtonClassName,
  cancelButtonClassName,
  placeholder,
  value,
  onValueChange,
  onSubmit,
  onCancel,
  submitLabel,
  disabled = false,
  submitDisabled = false,
  autoFocus = false,
}: InlineActionInputProps) {
  return (
    <div className={joinClasses('ui-action-prompt', `ui-action-prompt--${variant}`, className)}>
      <form onSubmit={onSubmit} className={joinClasses('ui-action-prompt__form', formClassName)}>
        <input
          autoFocus={autoFocus}
          type="text"
          className={joinClasses('ui-action-prompt__input', inputClassName)}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          disabled={disabled}
          spellCheck={false}
        />
        <button
          type="submit"
          className={joinClasses('ui-inline-button', 'ui-inline-button--submit', submitButtonClassName)}
          disabled={submitDisabled}
        >
          {submitLabel}
        </button>
      </form>
      <button
        type="button"
        className={joinClasses('ui-inline-button', 'ui-inline-button--dismiss', cancelButtonClassName)}
        onClick={onCancel}
        aria-label="Close"
      >
        &times;
      </button>
    </div>
  );
}

export { InlineActionInput as CompactActionInput };
