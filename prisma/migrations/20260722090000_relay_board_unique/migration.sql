-- 포도판 하나는 최대 한 포도동에만 연결된다는 불변식을 DB로 강제한다 (감사 H-02).
-- 예전에는 join 라우트의 findFirst 선검사만 있어서, 두 포도동이 동시에 read-then-write
-- 하면 같은 보드가 양쪽에 붙고 한쪽 바통이 영원히 멈췄다.
--
-- nullable unique는 Postgres 기본 NULLS DISTINCT라 미참여(boardId IS NULL) 행은 무제한이다.
--
-- ⚠ 적용 전 확인 — 기존 데이터에 중복이 있으면 이 마이그레이션은 실패한다(의도된 fail-closed).
--    대상 DB에서 먼저 실행할 것:
--
--      SELECT "boardId", count(*) FROM "RelayParticipant"
--      WHERE "boardId" IS NOT NULL GROUP BY "boardId" HAVING count(*) > 1;
--
--    0행이면 그대로 적용된다. 1행 이상이면 어느 참가자가 그 보드를 유지할지 먼저 정해야 한다.

-- DropIndex
DROP INDEX "RelayParticipant_boardId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "RelayParticipant_boardId_key" ON "RelayParticipant"("boardId");
