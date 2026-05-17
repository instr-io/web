'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getPlaylistByShortCode } from '@/app/lib/api';

export default function ShortLinkPage() {
  const params = useParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const shortCode = params.shortCode as string;

  useEffect(() => {
    async function resolveShortLink() {
      try {
        const data = await getPlaylistByShortCode(shortCode);
        // Redirect to main page with playlist query parameter
        // The API returns: { playlist_id, name, public, songs, user_id }
        const userId = data.user_id;
        const playlistId = data.playlist_id;
        router.replace(`/?playlist=${userId}:${playlistId}`);
      } catch (err) {
        console.error('Failed to resolve short link:', err);
        setError('Playlist not found');
      }
    }

    if (shortCode) {
      resolveShortLink();
    }
  }, [shortCode, router]);

  if (error) {
    return (
      <div className="ui-shortlink-state ui-shortlink-state--error">
        <h1>404</h1>
        <p>{error}</p>
        <a href="/" className="ui-shortlink-link">Go home</a>
      </div>
    );
  }

  return (
    <div className="ui-shortlink-state">
      <p>Loading playlist...</p>
    </div>
  );
}
