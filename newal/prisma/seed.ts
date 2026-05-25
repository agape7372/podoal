import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Clean existing data
  await prisma.message.deleteMany();
  await prisma.sticker.deleteMany();
  await prisma.reward.deleteMany();
  await prisma.board.deleteMany();
  await prisma.friendship.deleteMany();
  await prisma.user.deleteMany();

  const pw = await bcrypt.hash('1234', 10);

  // ─── Users ────────────────────────────────────────────────
  const dev = await prisma.user.create({
    data: { name: '개발자', email: 'dev@podoal.com', password: await bcrypt.hash('dev1234', 10), avatar: 'grape' },
  });
  const mom = await prisma.user.create({
    data: { name: '엄마', email: 'mom@podoal.com', password: pw, avatar: 'cherry' },
  });
  const kid = await prisma.user.create({
    data: { name: '우리아이', email: 'kid@podoal.com', password: pw, avatar: 'strawberry' },
  });
  const bestie = await prisma.user.create({
    data: { name: '베프 민지', email: 'minji@podoal.com', password: pw, avatar: 'peach' },
  });
  const coworker = await prisma.user.create({
    data: { name: '직장동료 준호', email: 'junho@podoal.com', password: pw, avatar: 'orange' },
  });
  const gymBuddy = await prisma.user.create({
    data: { name: '헬스메이트 수진', email: 'sujin@podoal.com', password: pw, avatar: 'blueberry' },
  });
  const stranger = await prisma.user.create({
    data: { name: '새친구 하늘', email: 'haneul@podoal.com', password: pw, avatar: 'watermelon' },
  });
  const pending1 = await prisma.user.create({
    data: { name: '친구요청 지우', email: 'jiwoo@podoal.com', password: pw, avatar: 'apple' },
  });

  // ─── Friendships ──────────────────────────────────────────
  // dev ↔ accepted friends
  const friends = [mom, kid, bestie, coworker, gymBuddy];
  for (const friend of friends) {
    await prisma.friendship.create({
      data: { requesterId: dev.id, receiverId: friend.id, status: 'accepted' },
    });
  }

  // Favorites
  await prisma.friendship.updateMany({
    where: { requesterId: dev.id, receiverId: { in: [mom.id, bestie.id] } },
    data: { isFavorite: true },
  });

  // Pending friend requests (incoming to dev)
  await prisma.friendship.create({
    data: { requesterId: pending1.id, receiverId: dev.id, status: 'pending' },
  });
  await prisma.friendship.create({
    data: { requesterId: stranger.id, receiverId: dev.id, status: 'pending' },
  });

  // Other users' friendships (for friend detail page boards)
  await prisma.friendship.create({
    data: { requesterId: mom.id, receiverId: kid.id, status: 'accepted', isFavorite: true },
  });

  // ─── Board 1: 빈 보드 (10알, 직접 만든 것) ─────────────────
  const board1 = await prisma.board.create({
    data: {
      title: '매일 운동하기 💪',
      description: '하루 30분 이상 운동',
      totalStickers: 10,
      ownerId: dev.id,
    },
  });
  await prisma.reward.create({
    data: { boardId: board1.id, type: 'giftcard', title: '치킨 기프티콘!', content: '열심히 운동한 나에게 치킨 보상 🍗', triggerAt: 10 },
  });
  await prisma.reward.create({
    data: { boardId: board1.id, type: 'letter', title: '중간 응원 편지', content: '벌써 절반이야! 너무 잘하고 있어 💪✨', triggerAt: 5 },
  });

  // ─── Board 2: 진행 중 (15알, 7개 채움) ────────────────────
  const board2 = await prisma.board.create({
    data: {
      title: '책 읽기 챌린지 📚',
      description: '한 달에 책 15권 읽기',
      totalStickers: 15,
      ownerId: dev.id,
    },
  });
  await prisma.reward.create({
    data: { boardId: board2.id, type: 'wish', title: '소원권 발동!', content: '15권 다 읽으면 소원 하나 들어줄게! 🌟', triggerAt: 15 },
  });
  await prisma.reward.create({
    data: { boardId: board2.id, type: 'letter', title: '5권 달성 축하!', content: '5권이나 읽었어! 독서왕 등극 중 📖✨', triggerAt: 5 },
  });
  await prisma.reward.create({
    data: { boardId: board2.id, type: 'giftcard', title: '10권 달성 보상', content: '카페 기프티콘으로 독서 타임 즐겨! ☕', triggerAt: 10 },
  });
  for (let i = 0; i < 7; i++) {
    await prisma.sticker.create({
      data: { boardId: board2.id, position: i, filledBy: dev.id },
    });
  }

  // ─── Board 3: 거의 완성 (20알, 18개 채움) ─────────────────
  const board3 = await prisma.board.create({
    data: {
      title: '물 마시기 챌린지 💧',
      description: '하루 8잔 물 마시기',
      totalStickers: 20,
      ownerId: dev.id,
    },
  });
  await prisma.reward.create({
    data: { boardId: board3.id, type: 'letter', title: '건강해진 나에게', content: '20일 동안 꾸준히 물 마신 당신, 진짜 대단해! 건강이 최고야! 💙', triggerAt: 20 },
  });
  await prisma.reward.create({
    data: { boardId: board3.id, type: 'wish', title: '10일 달성 보상', content: '절반 달성! 이 기세로 끝까지! 🥤', triggerAt: 10 },
  });
  for (let i = 0; i < 18; i++) {
    await prisma.sticker.create({
      data: { boardId: board3.id, position: i, filledBy: dev.id },
    });
  }

  // ─── Board 4: 완료된 보드 (10알, 전부 채움) ────────────────
  const board4 = await prisma.board.create({
    data: {
      title: '일찍 일어나기 ⏰',
      description: '7시 기상 챌린지',
      totalStickers: 10,
      ownerId: dev.id,
      isCompleted: true,
      completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3일 전
    },
  });
  await prisma.reward.create({
    data: { boardId: board4.id, type: 'giftcard', title: '아침형 인간 축하!', content: '10일 연속 기상 성공! 브런치 기프티콘 🥐☀️', triggerAt: 10 },
  });
  for (let i = 0; i < 10; i++) {
    await prisma.sticker.create({
      data: { boardId: board4.id, position: i, filledBy: dev.id },
    });
  }

  // ─── Board 5: 엄마가 선물한 보드 (15알, 진행 중) ───────────
  const board5 = await prisma.board.create({
    data: {
      title: '칭찬 모으기 ⭐',
      description: '엄마가 만들어준 칭찬 포도판',
      totalStickers: 15,
      ownerId: dev.id,
      giftedFromId: mom.id,
      giftedToId: dev.id,
    },
  });
  await prisma.reward.create({
    data: { boardId: board5.id, type: 'letter', title: '엄마의 편지 💌', content: '우리 아이가 이렇게 열심히 하다니!\n엄마가 정말 자랑스러워.\n항상 응원할게! 사랑해 ❤️', triggerAt: 15 },
  });
  await prisma.reward.create({
    data: { boardId: board5.id, type: 'wish', title: '중간 보상!', content: '절반 달성 기념 아이스크림 사줄게! 🍦', triggerAt: 8 },
  });
  for (let i = 0; i < 6; i++) {
    await prisma.sticker.create({
      data: { boardId: board5.id, position: i, filledBy: dev.id },
    });
  }

  // ─── Board 6: 베프가 선물한 보드 (30알, 왕 포도송이) ────────
  const board6 = await prisma.board.create({
    data: {
      title: '다이어트 화이팅 🥗',
      description: '민지가 응원하는 한 달 다이어트',
      totalStickers: 30,
      ownerId: dev.id,
      giftedFromId: bestie.id,
      giftedToId: dev.id,
    },
  });
  await prisma.reward.create({
    data: { boardId: board6.id, type: 'giftcard', title: '완주 보상!', content: '30일 성공하면 맛집 데려갈게! 예약은 내가 할게 🍽️', triggerAt: 30 },
  });
  await prisma.reward.create({
    data: { boardId: board6.id, type: 'letter', title: '10일 격려편지', content: '10일이나 했어!? 대박 진짜 대단해 ㅠㅠ 💕', triggerAt: 10 },
  });
  await prisma.reward.create({
    data: { boardId: board6.id, type: 'wish', title: '20일 소원권', content: '20일 달성! 소원 하나 들어줄게~ 뭐든 OK 🎀', triggerAt: 20 },
  });
  for (let i = 0; i < 12; i++) {
    await prisma.sticker.create({
      data: { boardId: board6.id, position: i, filledBy: dev.id },
    });
  }

  // ─── 친구들의 보드 (친구 상세에서 보임) ────────────────────
  // 엄마의 보드
  const momBoard1 = await prisma.board.create({
    data: { title: '요가 30일 🧘', description: '매일 아침 요가', totalStickers: 15, ownerId: mom.id },
  });
  await prisma.reward.create({
    data: { boardId: momBoard1.id, type: 'wish', title: '요가 마스터!', content: '유연성 대장 등극! 🏆', triggerAt: 15 },
  });
  for (let i = 0; i < 11; i++) {
    await prisma.sticker.create({ data: { boardId: momBoard1.id, position: i, filledBy: mom.id } });
  }

  const momBoard2 = await prisma.board.create({
    data: { title: '영어 공부 🇺🇸', totalStickers: 20, ownerId: mom.id },
  });
  await prisma.reward.create({
    data: { boardId: momBoard2.id, type: 'giftcard', title: '영어왕!', content: '원서 구매 쿠폰! 📚', triggerAt: 20 },
  });
  for (let i = 0; i < 5; i++) {
    await prisma.sticker.create({ data: { boardId: momBoard2.id, position: i, filledBy: mom.id } });
  }

  // 베프 민지의 보드
  const bestieBoard = await prisma.board.create({
    data: { title: '그림 그리기 🎨', description: '매일 스케치 한 장', totalStickers: 10, ownerId: bestie.id },
  });
  await prisma.reward.create({
    data: { boardId: bestieBoard.id, type: 'letter', title: '아티스트!', content: '10장 완성! 전시회 열자 🖼️', triggerAt: 10 },
  });
  for (let i = 0; i < 8; i++) {
    await prisma.sticker.create({ data: { boardId: bestieBoard.id, position: i, filledBy: bestie.id } });
  }

  // 직장동료 준호의 보드
  const coworkerBoard = await prisma.board.create({
    data: {
      title: '자격증 공부 📝',
      description: 'AWS 자격증 따기',
      totalStickers: 20,
      ownerId: coworker.id,
      isCompleted: true,
      completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.reward.create({
    data: { boardId: coworkerBoard.id, type: 'giftcard', title: '합격 축하!', content: '자격증 딴 기념 회식! 🍻', triggerAt: 20 },
  });
  for (let i = 0; i < 20; i++) {
    await prisma.sticker.create({ data: { boardId: coworkerBoard.id, position: i, filledBy: coworker.id } });
  }

  // 헬스메이트 수진의 보드
  const gymBoard = await prisma.board.create({
    data: { title: '스쿼트 챌린지 🏋️', description: '매일 스쿼트 100개', totalStickers: 30, ownerId: gymBuddy.id },
  });
  await prisma.reward.create({
    data: { boardId: gymBoard.id, type: 'wish', title: '근육왕 소원권', content: '30일 완주하면 프로틴 쏜다! 💪', triggerAt: 30 },
  });
  for (let i = 0; i < 15; i++) {
    await prisma.sticker.create({ data: { boardId: gymBoard.id, position: i, filledBy: gymBuddy.id } });
  }

  // ─── Messages ─────────────────────────────────────────────
  const now = Date.now();
  const msgs = [
    // 엄마 → dev 응원
    { senderId: mom.id, receiverId: dev.id, content: '오늘도 화이팅! 엄마가 응원해 💪', type: 'cheer', emoji: '💜', isRead: true, createdAt: new Date(now - 6 * 60 * 60 * 1000) },
    { senderId: mom.id, receiverId: dev.id, content: '포도알 많이 모았네! 대단해~', type: 'cheer', emoji: '🍇', isRead: true, createdAt: new Date(now - 4 * 60 * 60 * 1000) },
    { senderId: mom.id, receiverId: dev.id, content: '사랑하는 우리 아이 ❤️', type: 'cheer', emoji: '❤️', isRead: false, createdAt: new Date(now - 30 * 60 * 1000) },

    // 베프 민지 → dev
    { senderId: bestie.id, receiverId: dev.id, content: '다이어트 같이 하자!! 화이팅!!', type: 'cheer', emoji: '✨', isRead: true, createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000) },
    { senderId: bestie.id, receiverId: dev.id, content: '오늘 운동 했어?? 나는 했다~', type: 'cheer', emoji: '💪', isRead: false, createdAt: new Date(now - 2 * 60 * 60 * 1000) },
    { senderId: bestie.id, receiverId: dev.id, content: '거의 다 됐어! 포기하지 마! 🔥', type: 'cheer', emoji: '🔥', isRead: false, createdAt: new Date(now - 20 * 60 * 1000) },

    // 직장동료 준호 → dev
    { senderId: coworker.id, receiverId: dev.id, content: '나 자격증 땄다!! 🎉🎉', type: 'celebration', emoji: '🎉', isRead: true, createdAt: new Date(now - 7 * 24 * 60 * 60 * 1000) },
    { senderId: coworker.id, receiverId: dev.id, content: '너도 운동 열심히 하는구나 ㅋㅋ', type: 'cheer', emoji: '👏', isRead: false, createdAt: new Date(now - 1 * 60 * 60 * 1000) },

    // 헬스메이트 수진 → dev
    { senderId: gymBuddy.id, receiverId: dev.id, content: '내일 같이 헬스 갈까?', type: 'cheer', emoji: '🏋️', isRead: false, createdAt: new Date(now - 45 * 60 * 1000) },
    { senderId: gymBuddy.id, receiverId: dev.id, content: '오늘 스쿼트 100개 클리어! 🥳', type: 'celebration', emoji: '🥳', isRead: false, createdAt: new Date(now - 10 * 60 * 1000) },

    // dev → 베프 민지 (dev가 보낸 메시지)
    { senderId: dev.id, receiverId: bestie.id, content: '응원 고마워!! 나도 화이팅! 💕', type: 'cheer', emoji: '💜', isRead: true, createdAt: new Date(now - 1.5 * 60 * 60 * 1000) },
    { senderId: dev.id, receiverId: bestie.id, content: '그림 거의 다 모았네! 대단해!', type: 'cheer', emoji: '🌟', isRead: true, createdAt: new Date(now - 50 * 60 * 1000) },

    // dev → 엄마
    { senderId: dev.id, receiverId: mom.id, content: '엄마 요가 화이팅!!', type: 'cheer', emoji: '✨', isRead: true, createdAt: new Date(now - 3 * 60 * 60 * 1000) },

    // 선물 관련 메시지
    { senderId: mom.id, receiverId: dev.id, content: '칭찬 포도판 선물했어! 열심히 모아봐 🍇', type: 'gift', emoji: '🎁', isRead: true, createdAt: new Date(now - 5 * 24 * 60 * 60 * 1000) },
    { senderId: bestie.id, receiverId: dev.id, content: '다이어트 포도판 선물이야~ 같이 하자!', type: 'gift', emoji: '🎁', isRead: true, createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000) },
  ];

  for (const msg of msgs) {
    await prisma.message.create({ data: msg });
  }

  console.log('');
  console.log('🍇 포도알 샘플 데이터 생성 완료!');
  console.log('');
  console.log('─── 계정 목록 ───────────────────────────────────');
  console.log('  dev@podoal.com    / dev1234  ← 개발자 (메인)');
  console.log('  mom@podoal.com    / 1234     ← 엄마');
  console.log('  kid@podoal.com    / 1234     ← 우리아이');
  console.log('  minji@podoal.com  / 1234     ← 베프 민지');
  console.log('  junho@podoal.com  / 1234     ← 직장동료 준호');
  console.log('  sujin@podoal.com  / 1234     ← 헬스메이트 수진');
  console.log('  haneul@podoal.com / 1234     ← 새친구 하늘 (대기)');
  console.log('  jiwoo@podoal.com  / 1234     ← 친구요청 지우 (대기)');
  console.log('');
  console.log('─── dev 계정 데이터 ─────────────────────────────');
  console.log('  친구: 5명 (수락) + 2명 (대기 요청)');
  console.log('  즐겨찾기: 엄마, 베프 민지');
  console.log('  보드:');
  console.log('    - 매일 운동하기 (10알, 빈 보드, 리워드 2개)');
  console.log('    - 책 읽기 챌린지 (15알, 7/15, 리워드 3개)');
  console.log('    - 물 마시기 챌린지 (20알, 18/20, 거의 완성)');
  console.log('    - 일찍 일어나기 (10알, 완료!)');
  console.log('    - 칭찬 모으기 (15알, 6/15, 엄마 선물)');
  console.log('    - 다이어트 화이팅 (30알, 12/30, 베프 선물)');
  console.log('  메시지: 읽은 것 + 안 읽은 것 다수');
  console.log('──────────────────────────────────────────────────');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
