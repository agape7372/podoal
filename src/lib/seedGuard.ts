/**
 * 파괴적 DB 작업(seed의 전체 삭제, baseline 마킹)의 **대상 검증** 순수 모듈.
 *
 * 왜 순수 모듈인가: 판정이 DB 연결 **이전**에 끝나야 한다. 잘못된 대상이면
 * PrismaClient를 만들지도 않는다 — 연결에 성공하는 순간 이미 사고 반경 안이다.
 *
 * 왜 URL 파싱인가: `url.includes('localhost')` 류 문자열 검사는 양방향으로 틀린다.
 * 비밀번호나 DB명에 'localhost'가 들어간 원격 URL을 통과시키고(우회),
 * `postgresql://u@127.0.0.1/db`는 막는다(오판). `new URL()`로 host를 뽑아야 한다.
 */

export interface DbTarget {
  host: string;
  port: string;
  database: string;
}

export type GuardVerdict =
  | { allowed: true; target: DbTarget; reason: string }
  | { allowed: false; target: DbTarget | null; reason: string };

const LOOPBACK_NAMES = new Set(['localhost', '::1', 'host.docker.internal']);

/** 127.0.0.0/8 전체가 루프백이다 — 127.0.0.1만 보면 127.0.0.2를 놓친다. */
function isIpv4Loopback(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const octets = m.slice(1).map((n) => Number(n));
  if (octets.some((n) => n > 255)) return false;
  return octets[0] === 127;
}

export function isLoopbackHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  return LOOPBACK_NAMES.has(h) || isIpv4Loopback(h);
}

/**
 * postgres 연결 URL에서 host/port/database만 뽑는다. 자격증명은 읽지도 반환하지도
 * 않는다(로그에 새어나가면 안 됨). 파싱 불가·비-postgres 스킴·DB명 부재는 null.
 */
export function parseDbTarget(url: string | undefined | null): DbTarget | null {
  if (typeof url !== 'string' || url.trim().length === 0) return null;

  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }

  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') return null;

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return null;

  // pathname은 '/podoal' 형태. 선행 슬래시만 제거하고 그 뒤 세그먼트는 무시한다.
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, '')).split('/')[0];
  if (!database) return null;

  return { host, port: parsed.port || '5432', database };
}

/** 로그·에러 메시지에 쓰는 사람 읽는 표기. 자격증명은 절대 포함하지 않는다. */
export function describeTarget(target: DbTarget | null): string {
  return target ? `${target.host}:${target.port}/${target.database}` : '(파싱 불가)';
}

/**
 * seed의 전체 삭제를 허용할지 판정한다.
 *
 * - 루프백 호스트: 무조건 허용(로컬 개발 DB).
 * - 그 밖의 모든 호스트: `ALLOW_DESTRUCTIVE_SEED=true` **그리고**
 *   `SEED_CONFIRM_DATABASE`가 실제 DB명과 정확히 일치할 때만 허용.
 *   플래그 하나로는 부족하게 만든 이유 — 플래그는 shell 히스토리에 남아 재사용되기 쉽고,
 *   그 상태로 다른 DB를 가리키면 그대로 사고다. DB명 재확인이 "지금 이 대상"을 강제한다.
 */
export function assertSeedAllowed(
  url: string | undefined | null,
  env: Record<string, string | undefined>
): GuardVerdict {
  const target = parseDbTarget(url);
  if (!target) {
    return { allowed: false, target: null, reason: 'DATABASE_URL이 없거나 postgres URL로 파싱되지 않습니다.' };
  }

  if (isLoopbackHost(target.host)) {
    return { allowed: true, target, reason: '루프백 호스트 — 로컬 개발 DB로 판단.' };
  }

  if (env.ALLOW_DESTRUCTIVE_SEED !== 'true') {
    return {
      allowed: false,
      target,
      reason:
        `원격 DB(${describeTarget(target)})를 대상으로 한 파괴적 seed는 기본 차단됩니다. ` +
        `정말 필요하면 ALLOW_DESTRUCTIVE_SEED=true 와 SEED_CONFIRM_DATABASE=${target.database} 를 함께 지정하세요.`,
    };
  }

  if (env.SEED_CONFIRM_DATABASE !== target.database) {
    return {
      allowed: false,
      target,
      reason:
        `SEED_CONFIRM_DATABASE가 실제 대상과 다릅니다. ` +
        `실제=${target.database} / 지정=${env.SEED_CONFIRM_DATABASE ?? '(없음)'}`,
    };
  }

  return { allowed: true, target, reason: '원격 DB — 명시적 승인 플래그와 DB명 재확인 통과.' };
}

/**
 * baseline(0_init 강제 마킹)을 허용할지 판정한다. seed와 같은 2단 확인을 쓰되
 * 별도 env를 쓴다 — seed 승인이 baseline 승인으로 번지면 안 된다.
 * 스키마 지문 검사는 DB를 읽어야 하므로 여기가 아니라 호출측(scripts/baseline-init.mjs)이 한다.
 */
export function assertBaselineAllowed(
  url: string | undefined | null,
  env: Record<string, string | undefined>
): GuardVerdict {
  const target = parseDbTarget(url);
  if (!target) {
    return { allowed: false, target: null, reason: 'DATABASE_URL이 없거나 postgres URL로 파싱되지 않습니다.' };
  }

  if (env.ALLOW_BASELINE !== 'true') {
    return {
      allowed: false,
      target,
      reason:
        `baseline 마킹은 일회성 운영 절차입니다. ALLOW_BASELINE=true 와 ` +
        `BASELINE_CONFIRM_DATABASE=${target.database} 를 함께 지정하세요.`,
    };
  }

  if (env.BASELINE_CONFIRM_DATABASE !== target.database) {
    return {
      allowed: false,
      target,
      reason:
        `BASELINE_CONFIRM_DATABASE가 실제 대상과 다릅니다. ` +
        `실제=${target.database} / 지정=${env.BASELINE_CONFIRM_DATABASE ?? '(없음)'}`,
    };
  }

  return { allowed: true, target, reason: '명시적 승인 플래그와 DB명 재확인 통과.' };
}
