/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimize for client-side audio streaming
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'credentialless'
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin'
          }
        ]
      }
    ]
  },
};

module.exports = nextConfig;
