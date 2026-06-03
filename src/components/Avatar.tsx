'use client';

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

const VALID = new Set([
  'grape', 'strawberry', 'orange', 'blueberry',
  'cherry', 'peach', 'apple', 'watermelon',
]);

export default function Avatar({ avatar, size = 'md', className = '' }: AvatarProps) {
  const dims = sizeMap[size];
  const kind = VALID.has(avatar) ? avatar : 'grape';

  return (
    <div
      className={`
        clay-sm flex items-center justify-center
        bg-clay-cream
        rounded-full ${dims.box} ${className}
      `}
    >
      <img
        src={`/avatars/${kind}.svg`}
        alt=""
        width={dims.sprite}
        height={dims.sprite}
        draggable={false}
        aria-hidden="true"
        onError={(e) => {
          const img = e.currentTarget;
          if (img.src.endsWith('/avatars/grape.svg')) return;
          img.src = '/avatars/grape.svg';
        }}
      />
    </div>
  );
}
