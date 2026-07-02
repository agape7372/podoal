'use client';

import { useCallback, useEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react';

interface ModalProps {
  onClose: () => void;
  children: ReactNode;
  /** 시트 위치: 바닥 시트(기본) 또는 화면 중앙. 프리셋 스타일·진입/이탈 애니도 이 값으로 결정. */
  variant?: 'sheet' | 'center';
  /** true면 variant 프리셋 스타일을 붙이지 않는다(이탈 애니메이션은 그대로 주입) —
      ConfirmDialog(clay-puffy)·relay 첨부 시트처럼 프리셋 밖 외형을 쓰는 이탈자용. */
  unstyled?: boolean;
  /** 프리셋에 '추가'되는 클래스(max-h·flex 등). unstyled면 시트 스타일 전체를 담당. */
  sheetClassName?: string;
  /** 진입 애니 오버라이드(기본: sheet=animate-slide-up, center=animate-bounce-in).
      보상 리빌처럼 차별화된 개봉감이 필요한 모달이 사용. */
  enterClassName?: string;
  /** 접근성 이름(보통 모달 제목 텍스트). labelledBy가 있으면 그쪽 우선. */
  label?: string;
  labelledBy?: string;
  /** 백드롭 오버라이드(z-index·배경·블러). 기본 z-90 반투명+블러. */
  backdropClassName?: string;
  /** false면 백드롭/Escape 닫기 비활성(비동기 동작 중 등). 기본 true. */
  dismissable?: boolean;
  /** 시트 바깥(백드롭 안)에 깔리는 전체화면 오버레이(예: Confetti). */
  overlay?: ReactNode;
  /** 모달 내부 버튼이 이탈 애니메이션을 거쳐 닫도록 하는 연결 고리 — Modal이
      current에 requestClose를 넣어준다. 호출부는 useModalClose()로 만들어 전달. */
  closeRef?: MutableRefObject<(() => void) | null>;
}

/** 모달 컴포넌트 본문에서 '이탈 애니메이션을 거치는 닫기'를 얻는 헬퍼.
    requestClose는 Modal이 마운트되기 전엔 onClose로 폴백한다. */
export function useModalClose(onClose: () => void) {
  const closeRef = useRef<(() => void) | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  // 신원 고정(useCallback []) — ref 읽기는 호출 시점(이벤트)에만 일어난다
  // (렌더 중 ref 접근은 react-hooks/purity 위반).
  const requestClose = useCallback(() => (closeRef.current ?? onCloseRef.current)(), []);
  return { closeRef, requestClose };
}

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea,input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

// 중첩 모달 스택 — 가장 위에 열린 모달만 Escape/포커스 트랩에 반응한다(같은 document
// keydown 리스너가 등록 순서대로 모두 실행돼 바깥 모달이 안쪽과 함께 닫히는 충돌 방지).
const modalStack: symbol[] = [];
// 배경 스크롤 잠금 카운트 — 중첩 시 마지막 모달이 닫힐 때만 body overflow 복원.
let scrollLockCount = 0;

// variant 프리셋 — 15개 호출부에 복붙되어 있던 시트 클래스 문자열의 단일 정본.
// 진입/이탈 애니 클래스는 Modal이 상태에 따라 주입하므로 여기 포함하지 않는다.
const SHEET_PRESET =
  'w-full max-w-lg bg-clay-bg rounded-t-clay-lg clay-float p-6 pb-8 safe-bottom';
const CENTER_PRESET = 'w-full max-w-sm bg-clay-bg rounded-[28px] clay-float p-6 text-center';

// 이탈 애니 총 시간 상한 — animationend 미발화(호출부가 animation을 덮는 등) 대비
// setTimeout 폴백. 이탈 keyframes(0.25s)+여유. reduced-motion에선 0.001ms로 즉시 종료.
const EXIT_FALLBACK_MS = 350;

/**
 * 공용 모달 래퍼 — 모든 시트/다이얼로그에 dialog 의미론과 포커스 관리를 일괄 제공한다.
 * role="dialog" + aria-modal + Escape 닫기 + 포커스 트랩(Tab 순환) + 초기 포커스 +
 * 닫힐 때 직전 포커스 복원. 조건부 렌더(`{open && <Modal/>}`)로 쓰면 닫힘=언마운트라
 * cleanup이 포커스를 되돌린다. backdrop 클릭(시트 바깥)도 닫는다.
 *
 * 진입/이탈 대칭: 백드롭은 페이드 인/아웃, 시트는 variant별 진입(슬라이드업/바운스인)과
 * 이탈(슬라이드다운/스케일아웃)을 Modal이 주입한다. Escape/백드롭 경로는 자동으로 이탈
 * 애니를 거치고, 버튼 닫기는 closeRef(useModalClose)로 연결한 호출부만 거친다 —
 * 부모가 open 상태를 직접 끄는 경로(제출 성공 등)는 종전대로 즉시 언마운트.
 */
export default function Modal({
  onClose,
  children,
  variant = 'sheet',
  unstyled = false,
  sheetClassName = '',
  enterClassName,
  label,
  labelledBy,
  backdropClassName = 'z-90 bg-black/40 backdrop-blur-xs',
  dismissable = true,
  overlay,
  closeRef,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false); // setState 비동기와 무관한 동기 재진입 가드
  const finishedRef = useRef(false);
  // 최신 onClose/dismissable를 ref로 — 인라인 onClose가 매 렌더 신원이 바뀌어도 포커스
  // effect가 재실행돼 포커스를 빼앗지 않도록(아래 마운트-1회 effect가 이 ref를 읽는다).
  const onCloseRef = useRef(onClose);
  const dismissableRef = useRef(dismissable);
  // 렌더 순수성(react-hooks/purity) 유지: ref 갱신은 렌더가 아닌 effect에서.
  useEffect(() => {
    onCloseRef.current = onClose;
    dismissableRef.current = dismissable;
  });

  // 실제 닫기(부모 onClose 호출) — 이탈 애니 종료(animationend) 또는 폴백 타이머에서 1회만.
  const finishClose = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onCloseRef.current();
  };

  // 이탈 애니메이션을 시작한다. 부모 onClose는 애니 종료 후 발화.
  const requestClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
  };

  // closeRef 연결 — 호출부 버튼이 requestClose를 쓸 수 있게. 매 렌더 재할당(값싼 대입).
  useEffect(() => {
    if (!closeRef) return;
    closeRef.current = requestClose;
    return () => {
      closeRef.current = null;
    };
  });

  // 이탈 폴백 타이머 — sheetClassName이 animation을 덮거나 animationend가 유실돼도 닫힘 보장.
  // (finishClose는 ref 기반이라 신원 무관 — closing 전이 시 1회만 무장.)
  useEffect(() => {
    if (!closing) return;
    const t = setTimeout(finishClose, EXIT_FALLBACK_MS);
    return () => clearTimeout(t);
  }, [closing]);

  // 포커스 캡처/초기포커스/트랩/복원 + 모달 스택 + 배경 스크롤 잠금: 마운트당 1회만.
  useEffect(() => {
    const token = Symbol('modal');
    modalStack.push(token);
    const isTop = () => modalStack[modalStack.length - 1] === token;

    const prevFocus = document.activeElement as HTMLElement | null;
    const el = dialogRef.current;
    const getFocusable = () =>
      el ? Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null) : [];

    // 초기 포커스: 첫 포커스 가능한 요소, 없으면 다이얼로그 자체.
    (getFocusable()[0] ?? el)?.focus({ preventScroll: true });

    // 배경 스크롤 잠금(중첩 시 마지막 모달이 닫힐 때만 해제).
    if (scrollLockCount === 0) document.body.style.overflow = 'hidden';
    scrollLockCount += 1;

    const onKey = (e: KeyboardEvent) => {
      if (!isTop()) return; // 최상위 모달만 키 처리(중첩 시 충돌 방지)
      if (e.key === 'Escape') {
        // requestClose는 stable한 setState/ref만 캡처하므로 마운트 시점 클로저로 안전.
        if (dismissableRef.current) { e.stopPropagation(); requestClose(); }
        return;
      }
      if (e.key !== 'Tab') return;
      const f = getFocusable();
      if (f.length === 0) { e.preventDefault(); el?.focus({ preventScroll: true }); return; }
      // 포커스가 다이얼로그 밖으로 샜으면 안으로 되당긴다(경계 wrap만으론 이탈을 못 막음).
      if (el && !el.contains(document.activeElement)) { e.preventDefault(); f[0].focus({ preventScroll: true }); return; }
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus({ preventScroll: true }); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus({ preventScroll: true }); }
    };

    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      const i = modalStack.indexOf(token);
      if (i !== -1) modalStack.splice(i, 1);
      scrollLockCount = Math.max(0, scrollLockCount - 1);
      if (scrollLockCount === 0) document.body.style.overflow = '';
      // 닫히는 모달이 포커스를 보유 중일 때만 복원(중첩/이탈 시 엉뚱한 곳으로 복원 방지).
      if (el?.contains(document.activeElement)) prevFocus?.focus?.({ preventScroll: true });
    };
    // 마운트당 1회 — onClose/dismissable는 ref로 읽어 effect 재실행(포커스 도난)을 막는다.
  }, []);

  const preset = unstyled ? '' : variant === 'center' ? CENTER_PRESET : SHEET_PRESET;
  const enterCls =
    enterClassName ?? (unstyled ? '' : variant === 'center' ? 'animate-bounce-in' : 'animate-slide-up');
  // 이탈 클래스는 파일 하단(unlayered, 최후순)에 정의되어 호출부의 진입 애니 선언을 이긴다.
  const exitCls = variant === 'center' ? 'modal-center-out' : 'modal-sheet-out';

  return (
    <div
      className={`fixed inset-0 flex justify-center ${variant === 'center' ? 'items-center' : 'items-end'} ${backdropClassName} ${
        closing ? 'modal-backdrop-out pointer-events-none' : 'modal-backdrop-in'
      }`}
      onClick={(e) => {
        // onClick(release) — 시트 내부에서 드래그(텍스트 선택 등)하다 backdrop에서 떼도 닫히지 않음.
        if (dismissable && e.target === e.currentTarget) requestClose();
      }}
    >
      {overlay}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : label}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`${preset} ${sheetClassName} ${closing ? exitCls : enterCls} focus:outline-hidden`}
        onAnimationEnd={(e) => {
          // 시트 자신의 이탈 애니 종료에만 반응(자식 요소 애니메이션 버블 무시).
          if (closing && e.target === dialogRef.current) finishClose();
        }}
      >
        {children}
      </div>
    </div>
  );
}
