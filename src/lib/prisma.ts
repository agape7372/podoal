import { PrismaClient } from '@prisma/client';
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

// On Vercel (and any serverless host where the function filesystem is
// read-only), we keep the SQLite file in /tmp — the only writable location.
// We bundle an empty `prisma/_seed.db` (created at build time via the
// `prebuild` script) and copy it to /tmp on the first cold-start before
// PrismaClient reads DATABASE_URL.
if (
  process.env.NODE_ENV === 'production' &&
  (process.env.PODOAL_BOOTSTRAP_SQLITE === '1' || process.env.VERCEL === '1')
) {
  const RUNTIME_DB = '/tmp/dev.db';
  process.env.DATABASE_URL = `file:${RUNTIME_DB}`;
  if (!existsSync(RUNTIME_DB)) {
    const seedDb = path.join(process.cwd(), 'prisma/_seed.db');
    if (existsSync(seedDb)) {
      try {
        mkdirSync('/tmp', { recursive: true });
        copyFileSync(seedDb, RUNTIME_DB);
      } catch {
        // best effort — Prisma will surface the real error if the copy fails
      }
    }
  }
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
