// 계측 단일 진입점 (ANALYTICS_PLAN §5) — 컴포넌트는 posthog-js를 직접 import하지 않는다.
// no-op 게이트: 서버사이드 / NEXT_PUBLIC_POSTHOG_KEY 없음 / 동의 미획득 → 아무것도 안 함.
// posthog-js는 동의가 확인된 첫 track에서야 dynamic import — 초기 번들·미동의 사용자 비용 0.
import type { PostHog } from 'posthog-js';

// ── 이벤트 사전 (ANALYTICS_PLAN §2가 정본 — 추가·변경은 문서 개정으로만) ──────────
export const ANALYTICS_EVENTS = [
  // 획득
  'install_banner_shown',
  'install_banner_accepted',
  // 인증
  'signup_completed',
  'login_completed',
  // 활성화
  'first_board_created',
  'first_fill',
  // 코어
  'board_created',
  'grape_filled',
  'board_completed',
  'board_harvested',
  // 보상
  'reward_unlocked',
  'reward_revealed',
  // 소셜
  'friend_accepted',
  'cheer_sent',
  'gift_sent',
  'relay_started',
  // 알림
  'push_subscribed',
  // 채움 텀
  'cadence_selected',
  'fill_early_override',
  // 품질 (§3-4 — 사전 외 유일한 에러 이벤트)
  'grape_fill_failed',
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

// PII 금지(§2 공통 원칙) — 속성 값은 원시 타입만. 이메일·이름·메시지 내용류 절대 금지.
type EventProps = Record<string, string | number | boolean | null | undefined>;

export type ConsentState = 'granted' | 'denied' | 'unset';

const CONSENT_KEY = 'podoal-analytics-consent';
const FIRST_KEY_PREFIX = 'podoal-analytics-first:'; // + userId → JSON { board?: true, fill?: true }

// ── 순수 헬퍼 (테스트 대상) ──────────────────────────────────────────────
export function parseConsent(raw: string | null): ConsentState {
  return raw === 'granted' || raw === 'denied' ? raw : 'unset';
}

export function shouldTrackWith(opts: { isClient: boolean; hasKey: boolean; consent: ConsentState }): boolean {
  return opts.isClient && opts.hasKey && opts.consent === 'granted';
}

// ── 환경 접근 ────────────────────────────────────────────────────────────
function hasKey(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
}

export function getConsent(): ConsentState {
  if (typeof window === 'undefined') return 'unset';
  try {
    return parseConsent(window.localStorage.getItem(CONSENT_KEY));
  } catch {
    return 'unset';
  }
}

function shouldTrack(): boolean {
  return shouldTrackWith({ isClient: typeof window !== 'undefined', hasKey: hasKey(), consent: getConsent() });
}

/** 배너 노출 조건 — 키가 있고 아직 응답한 적 없는 경우에만. */
export function consentUnset(): boolean {
  return typeof window !== 'undefined' && hasKey() && getConsent() === 'unset';
}

// ── posthog-js 지연 로딩 ─────────────────────────────────────────────────
let phInstance: PostHog | null = null;
let phLoading: Promise<PostHog | null> | null = null;
let pendingUserId: string | null = null;

function loadPosthog(): Promise<PostHog | null> {
  if (phInstance) return Promise.resolve(phInstance);
  if (phLoading) return phLoading;
  phLoading = import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com',
        // 이벤트 사전이 정본(§5) — 자동 수집류는 전부 끈다.
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        disable_session_recording: true,
        persistence: 'localStorage',
        // 로딩 자체가 동의 후에만 일어나지만, 초기화 직후 첫 capture 전 상태도 opt-in으로 명시.
        opt_out_capturing_by_default: true,
      });
      posthog.opt_in_capturing();
      if (pendingUserId) posthog.identify(pendingUserId);
      phInstance = posthog;
      return posthog;
    })
    .catch(() => {
      phLoading = null; // 네트워크 일시 실패 — 다음 track에서 재시도
      return null;
    });
  return phLoading;
}

// ── 공개 API ─────────────────────────────────────────────────────────────
/** 이벤트 발사 — 게이트 미통과 시 완전 no-op. 실패는 조용히 무시(계측이 UX를 깨지 않게). */
export function track(event: AnalyticsEvent, props?: EventProps): void {
  if (!shouldTrack()) return;
  void loadPosthog().then((ph) => {
    try {
      ph?.capture(event, props);
    } catch {
      /* 계측 실패는 앱 동작에 영향 주지 않는다 */
    }
  });
}

/** 동의 설정 — localStorage 반영 + posthog opt in/out. 서버 동기화(PATCH)는 호출부 책임. */
export function setConsent(granted: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied');
  } catch {
    return;
  }
  if (granted) {
    if (hasKey()) void loadPosthog();
  } else if (phInstance) {
    try {
      phInstance.opt_out_capturing();
      phInstance.reset(); // 철회 즉시 식별자도 초기화
    } catch {
      /* no-op */
    }
  }
}

/** 내부 cuid만 전달(§2 공통 원칙 — 이메일·이름 금지). 동의 전이면 보관했다가 로딩 시 반영. */
export function identifyUser(userId: string): void {
  pendingUserId = userId;
  if (!shouldTrack()) return;
  void loadPosthog().then((ph) => {
    try {
      ph?.identify(userId);
    } catch {
      /* no-op */
    }
  });
}

/** 서버 동의 상태로 로컬 시딩 — 다른 기기에서 이미 동의한 사용자는 배너를 다시 보지 않는다.
 *  로컬이 unset일 때만 개입(로컬의 명시적 granted/denied가 항상 우선). */
export function seedConsentFromServer(analyticsConsentAt: string | null | undefined): void {
  if (typeof window === 'undefined') return;
  if (getConsent() !== 'unset') return;
  if (analyticsConsentAt) setConsent(true);
}

// ── first_* 1회성 이벤트 (활성화 퍼널) ───────────────────────────────────
// 유저별 localStorage 플래그. 기존 유저는 홈 보드 로드 시 markFirstDone으로 비관적 시딩
// (이벤트 미발화) — first_*가 신규 유저에게서만 발사되게 한다. 기기 간 중복은 PostHog
// person 단위 first-time 필터가 뒷단에서 걸러준다.
export type FirstKind = 'board' | 'fill';

type FlagStore = { getItem(key: string): string | null; setItem(key: string, value: string): void };

function defaultStore(): FlagStore | null {
  if (typeof window === 'undefined') return null;
  try {
    // 접근 자체가 throw할 수 있다(사파리 프라이빗 등) — 실패 시 first 기능만 조용히 끈다.
    return window.localStorage;
  } catch {
    return null;
  }
}

function readFlags(userId: string, store: FlagStore): Record<string, boolean> {
  try {
    const raw = store.getItem(FIRST_KEY_PREFIX + userId);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** 플래그만 세팅(이벤트 미발화) — 기존 유저 비관적 시딩용. */
export function markFirstDone(userId: string, kind: FirstKind, store: FlagStore | null = defaultStore()): void {
  if (!store) return;
  try {
    const flags = readFlags(userId, store);
    if (flags[kind]) return;
    flags[kind] = true;
    store.setItem(FIRST_KEY_PREFIX + userId, JSON.stringify(flags));
  } catch {
    /* no-op */
  }
}

/** 아직 안 했으면 플래그 세팅 + 이벤트 발사. 이미 했으면 no-op. */
export function trackFirst(
  userId: string,
  kind: FirstKind,
  event: AnalyticsEvent,
  props?: EventProps,
  store: FlagStore | null = defaultStore(),
): void {
  if (!store) return;
  const flags = readFlags(userId, store);
  if (flags[kind]) return;
  markFirstDone(userId, kind, store);
  track(event, props);
}
