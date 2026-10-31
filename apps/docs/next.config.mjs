import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  output: 'export',
  // A static export has no server to run the image optimizer, and next/image
  // throws in dev without this (MDX images render through next/image).
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default withMDX(config);
