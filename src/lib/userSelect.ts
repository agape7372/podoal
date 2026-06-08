// Public-facing user projection for API responses. Deliberately omits `email`
// (PII): a user's email must never reach friends or third parties. Mirrors the
// canonical select in `api/boards/[id]/route.ts`. Use this everywhere a user is
// embedded in a response for *another* user — own-account routes (auth/me,
// profile) may still return the requester's own email.
export const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  avatar: true,
};
