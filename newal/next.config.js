/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['bcryptjs', '@prisma/client', 'prisma'],
  },
};

module.exports = nextConfig;
