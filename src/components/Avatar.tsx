'use client';

import { AVATAR_EMOJIS } from '@/types';

interface AvatarProps {
  avatar: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeMap = {
  sm: 'w-8 h-8 text-base',
  md: 'w-10 h-10 text-xl',
  lg: 'w-14 h-14 text-2xl',
  xl: 'w-20 h-20 text-4xl',
};

export default function Avatar({ avatar, size = 'md', className = '' }: AvatarProps) {
  const emoji = AVATAR_EMOJIS[avatar] || '🍇';

  return (
    <div
      className={`
        clay-sm flex items-center justify-center
        bg-grape-50/80
        rounded-full ${sizeMap[size]} ${className}
      `}
    >
      {emoji}
    </div>
  );
}
