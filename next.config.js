/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "img.olx.com.br" },
      { protocol: "https", hostname: "vivaimagem.vivareal.com.br" },
    ],
  },
};

module.exports = nextConfig;
