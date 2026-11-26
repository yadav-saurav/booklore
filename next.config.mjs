/** @type {import('next').NextConfig} */
const config = {
  // Separate build dirs let several dev servers run side by side (NEXT_DIST_DIR=.next-xyz).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // PGlite ships WASM + data files that must be loaded from node_modules, not bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
  poweredByHeader: false,
};
export default config;
