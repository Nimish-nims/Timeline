/**
 * Stub for the Node-only "canvas" package so builds (Vercel/Turbopack) succeed.
 * pdfjs-dist (used by Eddyter for PDF thumbnails) requires "canvas" on the server;
 * this stub prevents "Module not found: Can't resolve 'canvas'" during build.
 */
function createCanvas(_width: number, _height: number) {
  return {
    getContext: () => null,
    width: 0,
    height: 0,
  };
}

export default { createCanvas };
export { createCanvas };
