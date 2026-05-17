'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function SpotifyAlbumRedirect() {
  const params = useParams();
  const router = useRouter();
  const albumId = params.id as string;

  useEffect(() => {
    if (albumId) {
      // Redirect to main page with spotify import parameter
      const spotifyUrl = `https://open.spotify.com/album/${albumId}`;
      router.replace(`/?spotify_import=${encodeURIComponent(spotifyUrl)}`);
    }
  }, [albumId, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <span className="text-secondary">LOADING</span>
    </div>
  );
}
