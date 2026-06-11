'use client';

import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  onClose: () => void;
  children: ReactNode;
  /** 시트 위치: 바닥 시트(기본) 또는 화면 중앙. */
  variant?: 'sheet' | 'center';
  /** 시트 요소(role=dialog가 붙는 div)의 클래스 — 모달별 스타일을 그대로 전달. */
  sheetClassName?: string;
  /** 접근성 이름(보통 모달 제목 텍스트). labelledBy가 있으면 그쪽 우선. */
  label?: string;
  labelledBy?: string;
  /** 백드롭 오버라이드(z-index·배경·블러). 기본 z-90 반투명+블러. */
  backdropClassName?: string;
  /** false면 백드롭/Escape 닫기 비활성(비동기 동작 중 등). 기본 true. */
  dismissable?: boolean;
  /** 시트 바깥(백드롭 안)에 깔리는 전체화면 오버레이(예: Confetti). */
  overlay?: ReactNode;
}

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea,input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

// 중첩 모달 스택 — 가장 위에 열린 모달만 Escape/포커스 트랩에 반응한다(같은 document
// keydown 리스너가 등록 순서대로 모두 실행돼 바깥 모달이 안쪽과 함께 닫히는 충돌 방지).
const modalStack: symbol[] = [];
// 배경 스크롤 잠금 카운트 — 중첩 시 마지막 모달이 닫힐 때만 body overflow 복원.
let scrollLockCount = 0;

/**
 * 공용 모달 래퍼 — 모든 시트/다이얼로그에 dialog 의미론과 포커스 관리를 일괄 제공한다.
 * role="dialog" + aria-modal + Escape 닫기 + 포커스 트랩(Tab 순환) + 초기 포커스 +
 * 닫힐 때 직전 포커스 복원. 조건부 렌더(`{open && <Modal/>}`)로 쓰면 닫힘=언마운트라
 * cleanup이 포커스를 되돌린다. backdrop 클릭(시트 바깥)도 닫는다.
 */
export default function Modal({
  onClose,
  children,
  variant = 'sheet',
  sheetClassName = '',
  label,
  labelledBy,
  backdropClassName = 'z-90 bg-black/40 backdrop-blur-xs',
  dismissable = true,
  overlay,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // 최신 onClose/dismissable를 ref로 — 인라인 onClose가 매 렌더 신원이 바뀌어도 포커스
  // effect가 재실행돼 포커스를 빼앗지 않도록(아래 마운트-1회 effect가 이 ref를 읽는다).
  const onCloseRef = useRef(onClose);
  const dismissableRef = useRef(dismissable);
  // 렌더 순수성(react-hooks/purity) 유지: ref 갱신은 렌더가 아닌 effect에서.
  useEffect(() => {
    onCloseRef.current = onClose;
    dismissableRef.current = dismissable;
  });

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
        if (dismissableRef.current) { e.stopPropagation(); onCloseRef.current(); }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`fixed inset-0 flex justify-center ${variant === 'center' ? 'items-center' : 'items-end'} ${backdropClassName}`}
      onClick={(e) => {
        // onClick(release) — 시트 내부에서 드래그(텍스트 선택 등)하다 backdrop에서 떼도 닫히지 않음.
        if (dismissable && e.target === e.currentTarget) onClose();
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
        className={`${sheetClassName} focus:outline-hidden`}
      >
        {children}
      </div>
    </div>
  );
}
