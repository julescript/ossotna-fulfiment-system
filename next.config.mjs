/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['upload.cloudlift.app', 'res.cloudinary.com'], // Add other domains if needed
  },
};

export default nextConfig;
