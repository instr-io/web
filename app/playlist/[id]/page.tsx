'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function SpotifyPlaylistRedirect() {
  const params = useParams();
  const router = useRouter();
  const playlistId = params.id as string;

  useEffect(() => {
    if (playlistId) {
      // Redirect to main page with spotify import parameter
      const spotifyUrl = `https://open.spotify.com/playlist/${playlistId}`;
      router.replace(`/?spotify_import=${encodeURIComponent(spotifyUrl)}`);
    }
  }, [playlistId, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <span className="text-secondary">LOADING</span>
    </div>
  );
}
