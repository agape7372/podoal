'use client';

import Modal, { useModalClose } from './Modal';
import ClayButton from './ClayButton';
import EmojiIcon from './EmojiIcon';

interface RipeningSheetProps {
  /** board.cadenceType — WEEKLY_N만 별도 문구, 나머지(DAILY_1/DAILY_N)는 같은 날/다음날
   *  분기(아래 formatRipeningBody). */
  cadenceType: string;
  /** computePaceState().nextRipeAt — 이 시트가 열렸다는 건 non-null이 보장된 상태. */
  nextRipeAt: Date | null;
  /** 판정 시각 — 호출부(effect)가 캡처해 내려준다. 이 컴포넌트 렌더 중엔 new Date()를
   *  직접 부르지 않는다(react-hooks/purity — Date 값 자체는 그냥 prop으로 받아 순수
   *  포맷팅만 한다). */
  now: Date;
  /** "그래도 채우기" — earlyFill 오버라이드. 정상 채움과 동일 연출·낙관 경로를 타고
   *  차이는 서버 기록 플래그뿐(FILL_CADENCE §8, 아너 시스템 — 막지 않고 기록만). */
  onOverride: () => void;
  /** 서버 판정(computeBackfillEligibility, FILL_CADENCE §5) — 어제 몫이 비어 있고
   *  아직 보충을 안 썼을 때만 true. false/undefined면 보조 버튼 자체를 숨긴다. */
  backfillAvailable?: boolean;
  /** "어제 몫 채우기" — onOverride와 동일 패턴(이탈 애니 없이 직접 호출, 부모가 즉시
   *  언마운트). backfillAvailable일 때만 쓰인다. */
  onBackfill?: () => void;
  onClose: () => void;
}

// 0~5시는 "내일 오전 12시" 같은 어색한 디지털 표기 대신 "아침"으로 뭉뚱그린다.
const MORNING_HOUR_CUTOFF = 6;

function formatRipeningBody(cadenceType: string, nextRipeAt: Date | null, now: Date): string {
  if (!nextRipeAt) return '';
  if (cadenceType === 'WEEKLY_N') return '다음 주가 되면 다시 익어요';

  const timeLabel = nextRipeAt.toLocaleTimeString('ko-KR', { hour: 'numeric' });
  const sameDay = now.toDateString() === nextRipeAt.toDateString();
  if (sameDay) {
    return `오늘 몫은 다 채웠어요 · ${timeLabel}에 다시 익어요`;
  }
  const label = nextRipeAt.getHours() < MORNING_HOUR_CUTOFF ? '아침' : timeLabel;
  return `내일 ${label}이면 제철이에요`;
}

/**
 * 채움 텀 C1 소프트 가드 시트(FILL_CADENCE_PLAN §3) — 잠그지 않는다: 다음 알이 아직
 * 안 익었을 때 탭하면 뜨고, "그래도 채우기"로 언제든 오버라이드할 수 있다. 질책 문구
 * 금지(§1 처벌 금지) — 두 선택지 모두 긍정적 어조.
 *
 * 버튼 우선순위는 ConfirmDialog와 대칭이 아니라 GiftUnboxModal형: "기다릴게요"가
 * 주 버튼(ClayButton), 그 아래 "어제 몫 채우기"(C3, backfillAvailable일 때만) 보조
 * 버튼, 맨 아래 "그래도 채우기"는 보조 텍스트 링크 — 기다림을 은근히 권하되 막지는
 * 않는다. "그래도 채우기"·"어제 몫 채우기" 둘 다 ConfirmDialog의 확인 버튼과 같은
 * 패턴으로 이탈 애니를 거치지 않고 각각 onOverride/onBackfill을 직접 호출한다(부모가
 * 즉시 언마운트 — Modal.tsx 주석의 "부모가 open 상태를 직접 끄는 경로" 케이스).
 * "기다릴게요"/백드롭/Escape는 requestClose로 이탈 애니를 거친다(CLAUDE.md 모달 규약).
 */
export default function RipeningSheet({
  cadenceType,
  nextRipeAt,
  now,
  onOverride,
  backfillAvailable,
  onBackfill,
  onClose,
}: RipeningSheetProps) {
  const { closeRef, requestClose } = useModalClose(onClose);
  const body = formatRipeningBody(cadenceType, nextRipeAt, now);

  return (
    <Modal
      onClose={onClose}
      closeRef={closeRef}
      label="아직 익는 중이에요"
      backdropClassName="z-90 bg-black/30 backdrop-blur-xs"
    >
      <div className="w-12 h-1.5 bg-warm-border rounded-full mx-auto mb-5" />

      <div className="text-center mb-6">
        <EmojiIcon emoji="🍇" size={40} className="block mx-auto mb-3" />
        <h3 className="font-display text-xl font-bold text-grape-700 mb-1">아직 익는 중이에요</h3>
        {body && <p className="text-sm text-warm-sub">{body}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <ClayButton variant="primary" onClick={requestClose} fullWidth>
          기다릴게요
        </ClayButton>
        {backfillAvailable && onBackfill && (
          <>
            <p className="text-xs text-warm-sub text-center">
              어제 한 알이 비어 있어요 — 지금 채우면 어제로 기록돼요
            </p>
            <ClayButton variant="ghost" onClick={onBackfill} fullWidth>
              어제 몫 채우기
            </ClayButton>
          </>
        )}
        <button onClick={onOverride} className="text-xs text-warm-sub underline py-1">
          그래도 채우기
        </button>
      </div>
    </Modal>
  );
}
