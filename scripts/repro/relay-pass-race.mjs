// GAP-08 재현 시도 — 릴레이 차례 이중 진행 레이스 (PERSONA_REVIEW GAP-08)
// 가설: POST /api/relays/[id]/pass 의 자격 가드가 tx 밖(기본 격리)이라, 동시 /pass
//       또는 마지막 알 채움(자동 진행)과 /pass 동시 도달 시 바통이 두 칸 진행(active 2명).
// 기대(가설이 유령일 때): 동시 요청 중 1건만 진행, 나머지는 400 — active ≤ 1 유지.
// 실행: dev 서버(localhost:3000) + 로컬 DB에서 `node scripts/repro/relay-pass-race.mjs`
// 판정 출력: "RACE_DETECTED"(재현 성공) 또는 "NO_RACE"(재현 실패) + 상태 덤프.

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

class Jar {
  constructor() { this.cookies = new Map(); }
  absorb(res) {
    const set = res.headers.getSetCookie?.() ?? [];
    for (const c of set) {
      const [pair] = c.split(';');
      const [k, v] = pair.split('=');
      this.cookies.set(k.trim(), v);
    }
  }
  header() { return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '); }
}

async function call(jar, method, path, json) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'content-type': 'application/json',
      cookie: jar.header(),
      // proxy.ts 동일 출처 CSRF 가드: 브라우저 요청처럼 origin을 실어준다.
      origin: BASE,
    },
    body: json ? JSON.stringify(json) : undefined,
  });
  jar.absorb(res);
  let body = null;
  try { body = await res.json(); } catch { /* empty */ }
  return { status: res.status, body };
}

const a = new Jar();

// 1) 계정 A(dev) 로그인 + 친구 시드
let r = await call(a, 'POST', '/api/auth/dev');
if (r.status !== 200) throw new Error(`dev login failed: ${r.status}`);
r = await call(a, 'POST', '/api/dev/seed-friends');
if (r.status !== 200) throw new Error(`seed-friends failed: ${r.status} ${JSON.stringify(r.body)}`);
const friendEmails = (r.body.friends ?? r.body.created ?? []).map((f) => f.email ?? f);
if (friendEmails.length < 2) throw new Error(`need 2 friends, got: ${JSON.stringify(r.body)}`);

// 친구 id 확보 — seed 응답엔 email뿐이라, 각자 로그인해 /api/auth/me로 id를 짝 맞춘다
// (초대 대상 id와 수락 계정이 반드시 동일 인물이 되도록).
const friends = [];
for (const email of friendEmails.slice(0, 2)) {
  const j = new Jar();
  let fr = await call(j, 'POST', '/api/auth/login', { email, password: 'test1234' });
  if (fr.status !== 200) throw new Error(`friend login failed: ${email} ${fr.status}`);
  fr = await call(j, 'GET', '/api/auth/me');
  const fid = fr.body.user?.id;
  if (!fid) throw new Error(`friend me failed: ${email} ${JSON.stringify(fr.body)}`);
  friends.push({ email, id: fid, jar: j });
}

// 2) 릴레이 생성 (순차 모드, 2알 — 빠른 완성)
r = await call(a, 'POST', '/api/relays', {
  title: `레이스검증 ${process.pid}`,
  totalStickers: 2,
  friendIds: friends.map((f) => f.id),
  mode: 'relay',
});
if (r.status !== 200 && r.status !== 201) throw new Error(`relay create failed: ${r.status} ${JSON.stringify(r.body)}`);
const relayId = r.body.relay?.id ?? r.body.id;

// 3) 친구 2명 수락(pending 대기열 형성)
for (const f of friends) {
  const fr = await call(f.jar, 'POST', `/api/relays/${relayId}/accept`);
  if (fr.status >= 400) throw new Error(`accept failed: ${f.email} ${fr.status} ${JSON.stringify(fr.body)}`);
}

// 4) 내 릴레이 보드 찾기
r = await call(a, 'GET', `/api/relays/${relayId}`);
const me = (r.body.relay?.participants ?? r.body.participants ?? []).find((p) => p.order === 0);
const boardId = me?.boardId;
if (!boardId) throw new Error(`creator board missing: ${JSON.stringify(r.body)}`);

// 5) 각도 1 — 마지막 알 채움(자동 진행)과 /pass 5연발 "동시" 발사
const fill0 = await call(a, 'POST', `/api/boards/${boardId}/stickers`, { position: 0 });
if (fill0.status !== 201) throw new Error(`fill#0 failed: ${fill0.status}`);
const volley = await Promise.all([
  call(a, 'POST', `/api/boards/${boardId}/stickers`, { position: 1 }), // 마지막 알 → 자동 진행
  call(a, 'POST', `/api/relays/${relayId}/pass`),
  call(a, 'POST', `/api/relays/${relayId}/pass`),
  call(a, 'POST', `/api/relays/${relayId}/pass`),
  call(a, 'POST', `/api/relays/${relayId}/pass`),
  call(a, 'POST', `/api/relays/${relayId}/pass`),
]);
console.log('volley statuses:', volley.map((v) => v.status).join(','));

// 6) 판정 — active 참가자 수
r = await call(a, 'GET', `/api/relays/${relayId}`);
const parts = r.body.relay?.participants ?? r.body.participants ?? [];
const actives = parts.filter((p) => p.status === 'active');
console.log('participants:', parts.map((p) => `${p.order}:${p.status}`).join(' '));
if (actives.length > 1) {
  console.log('RACE_DETECTED — active', actives.length);
  process.exit(2);
}
console.log('NO_RACE — active', actives.length);
