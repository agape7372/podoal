'use client';

import { InputHTMLAttributes } from 'react';

interface ClayInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function ClayInput({ label, error, className = '', ...props }: ClayInputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-warm-sub mb-2 ml-1">
          {label}
        </label>
      )}
      <input
        className={`clay-input ${error ? 'ring-2 ring-juice-300 border-juice-400' : ''} ${className}`}
        {...props}
      />
      {error && (
        <p className="text-juice-600 text-xs mt-1.5 ml-1">{error}</p>
      )}
    </div>
  );
}
