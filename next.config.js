/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['res.cloudinary.com', 'upload.cloudlift.app'],
  },
};

module.exports = nextConfig;
