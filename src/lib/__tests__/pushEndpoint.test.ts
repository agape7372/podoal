import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validatePushEndpoint,
  validatePushKeys,
  base64UrlByteLength,
} from '../pushEndpoint';

// 실제 형태의 키 — p256dh는 비압축 P-256 공개키 65바이트(0x04 접두), auth는 16바이트.
const P256DH = Buffer.concat([Buffer.from([0x04]), Buffer.alloc(64, 7)]).toString('base64url');
const AUTH = Buffer.alloc(16, 3).toString('base64url');

const FCM = 'https://fcm.googleapis.com/fcm/send/dGVzdC10b2tlbi12YWx1ZQ';

test('validatePushEndpoint: 정상 provider endpoint 통과', () => {
  assert.equal(validatePushEndpoint(FCM).ok, true);
  assert.equal(validatePushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/abc').ok, true);
  assert.equal(validatePushEndpoint('https://web.push.apple.com/QWxpY2U').ok, true);
});

test('validatePushEndpoint: https가 아니면 거부', () => {
  for (const bad of [
    'http://fcm.googleapis.com/fcm/send/x',
    'ftp://fcm.googleapis.com/x',
    'file:///etc/passwd',
    'gopher://example.com/',
  ]) {
    assert.equal(validatePushEndpoint(bad).ok, false, bad);
  }
});

test('validatePushEndpoint: IP 리터럴은 공인이든 사설이든 거부', () => {
  for (const bad of [
    'https://127.0.0.1/push',
    'https://10.0.0.5/push',
    'https://192.168.1.1/push',
    'https://172.16.0.9/push',
    'https://169.254.169.254/latest/meta-data/', // 클라우드 메타데이터
    'https://100.64.0.1/push', // CGNAT
    'https://8.8.8.8/push', // 공인이어도 provider가 IP를 쓰지는 않는다
    'https://[::1]/push',
    'https://[fd00::1]/push',
    'https://[fe80::1]/push',
  ]) {
    assert.equal(validatePushEndpoint(bad).ok, false, bad);
  }
});

test('validatePushEndpoint: 내부 도메인·단일 라벨 호스트 거부', () => {
  for (const bad of [
    'https://printer.local/push',
    'https://db.internal/push',
    'https://intranet/push', // 점 없는 단일 라벨
    'https://foo.localhost/push',
  ]) {
    assert.equal(validatePushEndpoint(bad).ok, false, bad);
  }
});

test('validatePushEndpoint: 길이 상한과 빈 값', () => {
  assert.equal(validatePushEndpoint('').ok, false);
  assert.equal(validatePushEndpoint(undefined).ok, false);
  assert.equal(validatePushEndpoint(123).ok, false);
  assert.equal(validatePushEndpoint({ endpoint: FCM }).ok, false);
  assert.equal(validatePushEndpoint(`https://fcm.googleapis.com/${'x'.repeat(2100)}`).ok, false);
});

test('validatePushEndpoint: URL에 박힌 자격증명 거부', () => {
  assert.equal(validatePushEndpoint('https://user:pw@fcm.googleapis.com/fcm/send/x').ok, false);
});

test('validatePushEndpoint: strict 모드에서만 provider allowlist를 강제', () => {
  const unknown = 'https://push.some-new-browser.example/endpoint/abc';
  // 기본(비강제) — 알려지지 않은 provider도 통과시킨다.
  assert.equal(validatePushEndpoint(unknown).ok, true);
  assert.equal(validatePushEndpoint(unknown, 'off').ok, true);
  // strict — allowlist 밖은 거부.
  assert.equal(validatePushEndpoint(unknown, 'strict').ok, false);
  assert.equal(validatePushEndpoint(FCM, 'strict').ok, true);
  // 접미사 매칭이 부분 문자열로 새지 않아야 한다.
  assert.equal(validatePushEndpoint('https://evil-fcm.googleapis.com.attacker.example/x', 'strict').ok, false);
});

test('base64UrlByteLength: 바이트 수 계산과 형식 거부', () => {
  assert.equal(base64UrlByteLength(Buffer.alloc(16).toString('base64url')), 16);
  assert.equal(base64UrlByteLength(Buffer.alloc(65).toString('base64url')), 65);
  assert.equal(base64UrlByteLength('has space'), null);
  assert.equal(base64UrlByteLength('plus+slash/'), null); // 표준 base64는 base64url이 아니다
  assert.equal(base64UrlByteLength(''), null);
});

test('validatePushKeys: 정상 키 통과', () => {
  assert.equal(validatePushKeys(P256DH, AUTH).ok, true);
});

test('validatePushKeys: 길이·형식이 어긋나면 저장 전에 거부', () => {
  assert.equal(validatePushKeys('', AUTH).ok, false);
  assert.equal(validatePushKeys(P256DH, '').ok, false);
  assert.equal(validatePushKeys(undefined, AUTH).ok, false);
  assert.equal(validatePushKeys(P256DH, undefined).ok, false);
  assert.equal(validatePushKeys('!!!not-base64!!!', AUTH).ok, false);
  assert.equal(validatePushKeys(Buffer.alloc(32).toString('base64url'), AUTH).ok, false); // 65바이트 아님
  assert.equal(validatePushKeys(P256DH, Buffer.alloc(8).toString('base64url')).ok, false); // 16바이트 아님
});
