'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import EmojiIcon from '@/components/EmojiIcon';

export default function BoardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error('[board] page error:', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-6">
      <div className="text-center max-w-sm">
        <EmojiIcon emoji="🍇" size={52} className="block mx-auto mb-4" />
        <h2 className="font-display text-lg font-bold text-grape-700 mb-2">
          포도판을 불러올 수 없어요
        </h2>
        <p className="text-sm text-warm-sub mb-6 leading-relaxed">
          일시적인 문제일 수 있어요.<br />
          잠시 후 다시 시도해주세요.
        </p>
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => reset()}
            className="clay-button px-4 py-2 rounded-xl text-sm font-medium"
          >
            <EmojiIcon emoji="🔄" size={15} className="mr-0.5" />다시 시도
          </button>
          <button
            onClick={() => router.push('/home')}
            className="clay-button px-4 py-2 rounded-xl text-sm font-medium bg-grape-50 text-grape-600"
          >
            <EmojiIcon emoji="🏠" size={15} className="mr-0.5" />홈으로
          </button>
        </div>
      </div>
    </div>
  );
}
