// 최신-호출-우선 비동기 순서 가드.
//
// 같은 컴포넌트 인스턴스에서 여러 비동기 요청이 경합할 때(대표적으로 useCachedApi가
// 동적 url을 전환하는 경우: friends/[id]·relay/[id]), 늦게 도착한 이전 요청의 결과가
// 나중에 시작된 요청의 결과(=현재 화면)를 덮어쓰는 "역순 응답" 회귀를 막는다.
//
// 사용법: 요청 시작 시 begin()으로 토큰을 받고, 응답을 반영하기 직전 isLatest(token)이
// 참일 때만 화면 state를 갱신한다. 캐시(모듈 Map)는 자기 url 키로 항상 갱신해도 안전하다
// — 문제는 "다른 url의 응답을 현재 인스턴스 state에 쓰는 것"뿐이기 때문이다.
export interface LatestGuard {
  /** 새 요청 시작 — 단조 증가 토큰 반환. 이 시점부터 이전 토큰들은 모두 무효가 된다. */
  begin: () => number;
  /** 이 토큰이 아직 가장 최근에 시작된 요청인가 (결과를 반영해도 되는가). */
  isLatest: (token: number) => boolean;
}

export function createLatestGuard(): LatestGuard {
  let current = 0;
  return {
    begin: () => (current += 1),
    isLatest: (token: number) => token === current,
  };
}
