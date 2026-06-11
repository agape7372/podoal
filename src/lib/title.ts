// 표시 전용 유틸: 포도판 제목 맨 앞의 이모지(이모지 군집·ZWJ 시퀀스·변형 셀렉터·키캡 포함)와
// 뒤따르는 공백을 제거한다. 템플릿으로 만든 제목("💧 물 마시기")과 직접 만든 제목("물 마시기")의
// 표시 통일성을 위함. DB는 불변 — 렌더 시점에만 적용한다.
// 안전장치: 제거 결과가 비면(제목이 이모지뿐) 원본을 그대로 돌려준다.

// 맨 앞 "이모지 단위"를 1회 이상 반복 매칭:
//   - 그림문자(Extended_Pictographic) / 지역표시자(국기) / 스킨톤 modifier 중 하나로 시작
//   - ZWJ(‍)로 이어진 추가 그림문자 0회 이상 (예: 🏃‍♂️)
//   - 변형셀렉터-16(️) 또는 키캡(⃣) 0~1회
//   - 뒤따르는 공백(\s*)
const LEADING_EMOJI =
  /^(?:[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}](?:‍\p{Extended_Pictographic})*[️⃣]?\s*)+/u;

export function stripTitleEmoji(title: string): string {
  if (!title) return title;
  const stripped = title.replace(LEADING_EMOJI, '').trimStart();
  return stripped.length > 0 ? stripped : title;
}

// 표시 전용: 긴 이름이 모달 부제 등 한 줄 레이아웃을 깨지 않도록 max 글자 초과 시 '…'로 자른다.
// Array.from으로 코드포인트 단위 분할 — 서로게이트 쌍(이모지 등)을 반 토막 내지 않는다.
export function ellipsizeName(name: string, max = 12): string {
  if (!name) return name;
  const chars = Array.from(name);
  return chars.length > max ? `${chars.slice(0, max).join('')}…` : name;
}
