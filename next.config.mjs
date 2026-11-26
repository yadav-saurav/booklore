/** @type {import('next').NextConfig} */
const config = {
  // Separate build dirs let several dev servers run side by side (NEXT_DIST_DIR=.next-xyz).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: ["better-sqlite3"],
  poweredByHeader: false,
};
export default config;
