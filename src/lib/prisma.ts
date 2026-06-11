import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// v7: Rust 쿼리 엔진 제거 — JS 드라이버 어댑터(pg)가 필수.
// connectionTimeoutMillis: pg 기본값 0(무한 대기)은 Neon 장애 시 행으로 이어지므로
// v6 내장 풀의 connect_timeout(5s)을 유지한다.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
});

export const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
