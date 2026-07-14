import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesHost } from '../../proxy';

// proxy.ts는 src/ 루트에 있으므로 __tests__ 기준 두 단계 위(../../proxy).
// matchesHost = 동일출처 CSRF 판정의 핵심(Origin/Referer 호스트 == 요청 host).

test('matchesHost: 같은 호스트면 true (path·query 무시)', () => {
  assert.equal(matchesHost('https://podoal-rouge.vercel.app', 'podoal-rouge.vercel.app'), true);
  assert.equal(matchesHost('https://podoal-rouge.vercel.app/board/1?x=2', 'podoal-rouge.vercel.app'), true);
  assert.equal(matchesHost('http://localhost:3000', 'localhost:3000'), true);
});

test('matchesHost: 다른 호스트/포트면 false (CSRF 차단)', () => {
  assert.equal(matchesHost('https://evil.com', 'podoal-rouge.vercel.app'), false);
  assert.equal(matchesHost('https://podoal-rouge.vercel.app', 'evil.com'), false);
  // 포트가 다르면 host 문자열이 달라 false
  assert.equal(matchesHost('http://localhost:3001', 'localhost:3000'), false);
});

test('matchesHost: null·빈값·파싱 불가 origin은 false', () => {
  assert.equal(matchesHost(null, 'podoal-rouge.vercel.app'), false);
  assert.equal(matchesHost('', 'podoal-rouge.vercel.app'), false);
  assert.equal(matchesHost('not-a-valid-url', 'podoal-rouge.vercel.app'), false);
  assert.equal(matchesHost('podoal-rouge.vercel.app', 'podoal-rouge.vercel.app'), false); // 스킴 없으면 URL 파싱 실패
});
