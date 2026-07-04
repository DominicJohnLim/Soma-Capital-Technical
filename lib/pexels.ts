export interface PexelsImage {
  url: string;
  alt: string;
}

// Server-side only: keeps the API key off the client. Image lookup is
// best-effort — any failure returns null and todo creation proceeds without
// an image.
export async function searchImage(query: string): Promise<PexelsImage | null> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1`,
      { headers: { Authorization: apiKey } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const photo = data?.photos?.[0];
    if (!photo?.src?.medium) return null;
    return {
      url: photo.src.medium,
      alt: typeof photo.alt === 'string' && photo.alt ? photo.alt : query,
    };
  } catch {
    return null;
  }
}
