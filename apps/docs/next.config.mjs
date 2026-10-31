import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  output: 'export',
  // A static export has no server to run the image optimizer, and next/image
  // throws in dev without this (MDX images render through next/image).
  images: { unoptimized: true },
  reactStrictMode: true,
  // English and Vietnamese are separate root layouts (each sets its own <html lang>), so the
  // 404 for unmatched URLs comes from app/global-not-found.tsx instead of a shared layout.
  experimental: { globalNotFound: true },
};

export default withMDX(config);
