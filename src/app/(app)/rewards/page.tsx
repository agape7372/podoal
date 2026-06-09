'use client';

import EmojiIcon from '@/components/EmojiIcon';
import RewardList from '@/components/RewardList';

export default function VineyardPage() {
  return (
    <div className="pb-4">
      <h1 className="font-display text-2xl font-bold text-grape-700 mb-2 inline-flex items-center gap-1.5">
        <EmojiIcon emoji="🍇" size={24} /> 포도밭
      </h1>
      <p className="text-sm text-warm-sub mb-5">지금까지 받은 보상과 중간 보상을 모아봐요</p>

      <RewardList />
    </div>
  );
}
