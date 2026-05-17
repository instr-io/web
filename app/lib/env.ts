function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export const publicEnv = {
  // Use direct NEXT_PUBLIC_* accesses so Next.js can expose them to client bundles.
  apiUrl: trimTrailingSlash(process.env.NEXT_PUBLIC_API_URL?.trim() || 'http://localhost:8080'),
  supabaseUrl: trimTrailingSlash(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || ''),
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || '',
} as const;

export const isSupabaseConfigured = Boolean(
  publicEnv.supabaseUrl && publicEnv.supabaseAnonKey
);

export function buildApiUrl(path = ''): string {
  if (!path) {
    return publicEnv.apiUrl;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${publicEnv.apiUrl}${normalizedPath}`;
}
