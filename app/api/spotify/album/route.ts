import { NextRequest, NextResponse } from 'next/server';

interface SpotifyAlbumResult {
  album: string;
  artist: string;
  tracks: Array<{
    title: string;
    artist: string;
  }>;
}

async function scrapeSpotifyAlbum(url: string): Promise<SpotifyAlbumResult | null> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.error('Failed to fetch Spotify album page:', response.status);
      return null;
    }

    const html = await response.text();

    const result: SpotifyAlbumResult = {
      album: '',
      artist: '',
      tracks: []
    };

    // Parse album name and artist from meta tag
    const metaTitleMatch = html.match(/<meta property="og:title" content="(.*?)"/);
    if (metaTitleMatch) {
      // Format: "The DECADE - Album by DAY6 | Spotify"
      const titleMatch = metaTitleMatch[1].match(/^(.+?)\s*-\s*Album by\s+(.+?)\s*\|/);
      if (titleMatch) {
        result.album = titleMatch[1].trim();
        result.artist = titleMatch[2].trim();
      }
    }

    // If we didn't get album/artist from meta tag, try JSON-LD
    if (!result.album || !result.artist) {
      const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      if (jsonLdMatch) {
        try {
          const jsonData = JSON.parse(jsonLdMatch[1]);
          if (jsonData.name) {
            result.album = jsonData.name;
          }
        } catch (e) {
          console.warn('Failed to parse JSON-LD:', e);
        }
      }
    }

    // Parse tracks from aria-label attributes in track rows
    // Pattern: aria-label="Track Name" data-testid="track-row"
    const trackRowRegex = /aria-label="([^"]+)"\s+data-testid="track-row"/g;
    const trackMatches: RegExpExecArray[] = [];
    let match;
    while ((match = trackRowRegex.exec(html)) !== null) {
      trackMatches.push(match);
    }

    trackMatches.forEach((match) => {
      const trackTitle = match[1];
      result.tracks.push({
        title: trackTitle,
        artist: result.artist // Default to album artist
      });
    });

    // Try to find individual artist names for each track
    // Split by track rows to get sections
    const trackSections = html.split(/aria-label="[^"]+"\s+data-testid="track-row"/);

    result.tracks.forEach((track, index) => {
      if (trackSections[index + 1]) {
        const section = trackSections[index + 1];
        // Get content until next track row (limited to 1000 chars to avoid processing too much)
        const sectionContent = section.substring(0, 1000);

        // Look for artist link pattern: href="/artist/..." followed by the artist name
        const artistRegex = /href="\/artist\/[^"]+">([^<]+)</g;
        const artistMatches: RegExpExecArray[] = [];
        let artistMatch;
        while ((artistMatch = artistRegex.exec(sectionContent)) !== null) {
          artistMatches.push(artistMatch);
        }

        if (artistMatches.length > 0) {
          const artists = artistMatches.map(m => m[1].trim());
          // Remove duplicates
          const uniqueArtists = [...new Set(artists)];
          track.artist = uniqueArtists.join(', ');
        }
      }
    });

    if (!result.album || !result.artist || result.tracks.length === 0) {
      console.error('Incomplete album data:', {
        hasAlbum: !!result.album,
        hasArtist: !!result.artist,
        trackCount: result.tracks.length
      });
      return null;
    }

    return result;

  } catch (error) {
    console.error('Error scraping Spotify album:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.url) {
      return NextResponse.json(
        { error: 'Album URL is required' },
        { status: 400 }
      );
    }

    // Validate it's a Spotify album URL
    if (!body.url.includes('spotify.com/album/')) {
      return NextResponse.json(
        { error: 'Invalid Spotify album URL' },
        { status: 400 }
      );
    }

    const result = await scrapeSpotifyAlbum(body.url);

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to parse Spotify album' },
        { status: 404 }
      );
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Spotify album API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
