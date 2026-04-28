// Shared decoded-image cache used by both the 2D canvas (ConstellationCanvas)
// and the 3D globe view (Globe3DView). Hoisted here so toggling between modes
// keeps the same HTMLImageElement instances around and we never have to
// re-decode logos (which would briefly fall back to letter placeholders).

const CACHE = new Map<string, HTMLImageElement>();

export const imageCache: ReadonlyMap<string, HTMLImageElement> = CACHE;

export const getCachedImage = (src: string): HTMLImageElement | undefined => CACHE.get(src);

export const ensureImage = (src: string): HTMLImageElement => {
  const existing = CACHE.get(src);
  if (existing) return existing;
  const image = new Image();
  image.decoding = 'async';
  image.crossOrigin = 'anonymous';
  image.src = src;
  CACHE.set(src, image);
  return image;
};

/**
 * Resolve a fully-decoded image. If it's already loaded, this resolves
 * synchronously (microtask). Otherwise it waits for load/error.
 */
export const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = ensureImage(src);
    if (img.complete && img.naturalWidth > 0) {
      resolve(img);
      return;
    }
    const onLoad = () => {
      img.removeEventListener('load', onLoad);
      img.removeEventListener('error', onError);
      resolve(img);
    };
    const onError = (err: Event | string) => {
      img.removeEventListener('load', onLoad);
      img.removeEventListener('error', onError);
      reject(err);
    };
    img.addEventListener('load', onLoad);
    img.addEventListener('error', onError);
  });
