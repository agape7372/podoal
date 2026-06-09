'use client';

import PodongList from '@/components/PodongList';

// /relay 는 그대로 유지(딥링크·뒤로가기 폴백). 목록 본문은 PodongList로 추출해
// 친구 페이지의 '포도동' 세그먼트와 공유한다.
export default function RelayListPage() {
  return (
    <div className="pb-4">
      <PodongList />
    </div>
  );
}
