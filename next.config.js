/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['bcryptjs', '@prisma/client', 'prisma'],
    // Ship the build-time seed SQLite file with the serverless function
    // bundle so the runtime can copy it to /tmp on cold start. Without this,
    // Next.js's output file tracer drops the .db file.
    outputFileTracingIncludes: {
      '/**/*': ['./prisma/_seed.db'],
    },
  },
};

module.exports = nextConfig;
