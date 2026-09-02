/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: "/index.html",
        destination: "/",
        permanent: true
      },
      {
        source: "/learn.html",
        destination: "/learn",
        permanent: true
      }
    ];
  }
};

module.exports = nextConfig;
