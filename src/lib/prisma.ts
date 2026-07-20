import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// v7: Rust 쿼리 엔진 제거 — JS 드라이버 어댑터(pg)가 필수.
// connectionTimeoutMillis: pg 기본값 0(무한 대기)은 Neon 장애 시 행으로 이어지므로
// v6 내장 풀의 connect_timeout(5s)을 유지한다.
// idleTimeoutMillis/keepAlive(2026-07-18 스켈레톤 감사): pg 기본값(idle 10초 후 소켓
// 폐기, keepAlive off)은 요청이 10초만 뜸해도 다음 요청이 TCP+TLS+SCRAM 풀 핸드셰이크를
// 다시 지불하게 했다 — 웜 람다에서도 왕복이 수백 ms씩 늘던 원인. 유휴 보존을 60초로
// 늘리고 keepAlive로 NAT/LB의 조용한 소켓 폐기를 막는다. (Neon은 -pooler 엔드포인트
// 사용 전제 — .env.example 참조. 서버리스 인스턴스별 풀이므로 상한(max) 기본 10 유지.)
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 60_000,
  keepAlive: true,
});

export const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
