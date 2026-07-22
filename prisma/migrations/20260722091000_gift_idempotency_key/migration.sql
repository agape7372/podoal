-- 선물 생성 멱등키 (감사 H-01). 순수 additive — 기존 행은 전부 NULL이라 무중단이다.
--
-- 클라이언트가 제출 1회당 키 하나를 만들고 재시도에도 같은 값을 보낸다. 같은 보내는 사람이
-- 같은 키로 다시 요청하면 유니크 제약이 두 번째 생성을 막고, 라우트가 그 위반을 잡아
-- 이미 만들어진 선물을 그대로 돌려준다 — 타임아웃·중복 제출에도 수신 보드는 정확히 하나.
--
-- Postgres 기본 NULLS DISTINCT라 선물이 아닌 보드(키 NULL)는 개수 제한이 없다.

-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "giftIdempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Board_giftedFromId_giftIdempotencyKey_key" ON "Board"("giftedFromId", "giftIdempotencyKey");
