// Images uploaded through the Uploads API are not readable by the browser until the document is
// published, so the preview shows the local file that was just uploaded (object URL) and, in mock
// mode, falls back to the server route that serves the bytes it kept in memory (or the fixture
// files). Media API assets (videos) are likewise only viewable once published; the mock serves the
// poster frame and the clip itself so video modules preview with a playable video instead of a black box.
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

type Registry = {
  urlFor: (uploadDestinationId: string, size?: { w: number; h: number }) => string | null;
  posterFor: (mediaId: string) => string | null;
  videoFor: (mediaId: string) => string | null;
  remember: (id: string, file: File) => void;
};
const Ctx = createContext<Registry>({
  urlFor: () => null,
  posterFor: () => null,
  videoFor: () => null,
  remember: () => {},
});

export function ImagesProvider({ mode, children }: { mode: 'live' | 'mock'; children: ReactNode }) {
  const [local, setLocal] = useState<Record<string, string>>({});
  // Object URLs hold the file bytes until revoked: release the previous one when an id is replaced,
  // and all of them when the provider unmounts (the ref keeps the cleanup from seeing a stale map).
  const localRef = useRef(local);
  useEffect(() => {
    localRef.current = local;
  }, [local]);
  useEffect(() => () => Object.values(localRef.current).forEach((url) => URL.revokeObjectURL(url)), []);
  const value = useMemo<Registry>(
    () => ({
      urlFor: (id, size) => {
        if (!id) return null;
        if (local[id]) return local[id];
        return mode === 'mock' ? `/api/uploads/${id}${size ? `?w=${size.w}&h=${size.h}` : ''}` : null;
      },
      posterFor: (mediaId) => (mediaId && mode === 'mock' ? `/api/media/${mediaId}/poster` : null),
      videoFor: (mediaId) => (mediaId && mode === 'mock' ? `/api/media/${mediaId}/video` : null),
      remember: (id, file) => {
        const url = URL.createObjectURL(file);
        setLocal((m) => {
          if (m[id] && m[id] !== url) URL.revokeObjectURL(m[id]);
          return { ...m, [id]: url };
        });
      },
    }),
    [local, mode],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useImages = () => useContext(Ctx);
