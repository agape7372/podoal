'use client';

import PixelFruit, { type FruitKind } from './PixelFruit';

interface AvatarProps {
  avatar: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeMap = {
  sm: { box: 'w-8 h-8', sprite: 22 },
  md: { box: 'w-10 h-10', sprite: 28 },
  lg: { box: 'w-14 h-14', sprite: 38 },
  xl: { box: 'w-20 h-20', sprite: 56 },
};

const VALID_KINDS: FruitKind[] = [
  'grape', 'strawberry', 'orange', 'blueberry',
  'cherry', 'peach', 'apple', 'watermelon',
];

function isValidKind(s: string): s is FruitKind {
  return (VALID_KINDS as string[]).includes(s);
}

export default function Avatar({ avatar, size = 'md', className = '' }: AvatarProps) {
  const dims = sizeMap[size];
  const kind: FruitKind = isValidKind(avatar) ? avatar : 'grape';

  return (
    <div
      className={`
        clay-sm flex items-center justify-center
        bg-clay-cream
        rounded-full ${dims.box} ${className}
      `}
      style={{ borderRadius: '50%' }}
    >
      <PixelFruit kind={kind} size={dims.sprite} />
    </div>
  );
}
