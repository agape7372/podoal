// 데이터레이어(/api/auth/*)가 돌려주는 영어 검증 메시지를 한국어로 매핑.
// 한국어 메시지는 맵에 없으면 원문 그대로 통과한다.
export function describeAuthError(message: string): string {
  const map: Record<string, string> = {
    'Name, email, and password are required.': '이름, 이메일, 비밀번호를 모두 입력해주세요.',
    'Email and password are required.': '이메일과 비밀번호를 입력해주세요.',
    'Invalid email format.': '이메일 형식이 올바르지 않아요.',
    'Invalid email or password.': '이메일 또는 비밀번호가 올바르지 않아요.',
    'Email is already registered.': '이미 가입된 이메일이에요. 로그인해주세요.',
    'Internal server error.': '일시적인 오류가 발생했어요. 잠시 후 다시 시도해주세요.',
    'Unauthorized': '로그인이 필요해요. 다시 로그인해주세요.',
    'User not found': '계정을 찾을 수 없어요. 다시 로그인해주세요.',
  };
  return map[message] ?? message;
}
