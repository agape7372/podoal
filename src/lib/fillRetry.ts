import { ApiError } from './api';

// 채움 POST 재시도 — 배치/단건 postFill의 catch가 롤백+fillResumeAt 연쇄로 가기 전에
// 일시 실패를 스스로 회복시킨다. 근거(2026-07-23 재현): 배치 하나가 전송 실패하면
// 그 배치 롤백 + 뒤 배치 전부 폐기 → 완성됐던 보드가 실패 지점까지 되감겼다. 서버는
// 멱등(createMany skipDuplicates + unique[boardId,position])이라 같은 배치 재전송이 안전.

/** 채움 POST 실패가 일시적(재시도 가치 있음)인가.
 *  - 4xx(400·403·404·409·422): 결정적 클라 오류 → 재시도해도 같은 결과(false)
 *  - 5xx(500·503): 서버 일시 오류(직렬화 재시도 소진 등) → 재시도(true)
 *  - ApiError 아님(fetch reject=네트워크 단절, AbortError=타임아웃, 미상): 전송 자체
 *    실패라 재시도(true) */
export function isRetryableFillError(err: unknown): boolean {
  if (err instanceof ApiError) return err.status >= 500;
  return true;
}

/** 지수 백오프 재시도. sleep/rand 주입으로 순수 단위 테스트 가능. 마지막 시도까지
 *  실패하면 마지막 에러를 그대로 throw(호출부의 기존 롤백/안내 경로가 이어받는다). */
export async function withFillRetry<T>(
  attempt: () => Promise<T>,
  opts: {
    /** 최초 1회 외 추가 재시도 횟수(총 시도 = maxRetries + 1). */
    maxRetries: number;
    baseMs: number;
    sleep: (ms: number) => Promise<void>;
    shouldRetry?: (e: unknown) => boolean;
    /** 지터 소스(테스트 주입용); 미지정 시 Math.random. */
    rand?: () => number;
  },
): Promise<T> {
  const shouldRetry = opts.shouldRetry ?? isRetryableFillError;
  for (let i = 0; ; i++) {
    try {
      return await attempt();
    } catch (e) {
      if (i >= opts.maxRetries || !shouldRetry(e)) throw e;
      const r = opts.rand ? opts.rand() : Math.random();
      await opts.sleep(opts.baseMs * 2 ** i * (0.5 + r));
    }
  }
}
