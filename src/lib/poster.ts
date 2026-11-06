export function posterUrl(path: string | null) {
  return path && /^\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(path)
    ? `https://image.tmdb.org/t/p/w342${path}`
    : null;
}
