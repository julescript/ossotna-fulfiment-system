/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
  images: {
    domains: ['res.cloudinary.com', 'upload.cloudlift.app'],
  },
};

module.exports = nextConfig;
