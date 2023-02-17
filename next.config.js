/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
    serverComponentsExternalPackages: ['sagus', 'winston'],
  },
};

module.exports = nextConfig;
