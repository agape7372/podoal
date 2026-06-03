'use client';

import { InputHTMLAttributes, useId } from 'react';

interface ClayInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function ClayInput({ label, error, className = '', id, ...props }: ClayInputProps) {
  const autoId = useId();
  const inputId = id || autoId;
  const errorId = `${inputId}-error`;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-warm-sub mb-2 ml-1">
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`clay-input ${error ? 'ring-2 ring-rose-200 border-rose-400' : ''} ${className}`}
        {...props}
      />
      {error && (
        <p id={errorId} role="alert" className="text-rose-700 text-xs mt-1.5 ml-1">{error}</p>
      )}
    </div>
  );
}
