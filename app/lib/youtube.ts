export interface YouTubeSearchResult {
  id: string;
  url: string;
  title: string;
  channel: string;
  duration: string;
  thumbnail: string;
}

export const searchYouTubeForTrack = async (artist: string, title: string): Promise<YouTubeSearchResult | null> => {
  try {
    const response = await fetch('/api/youtube/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artist, title }),
    });    
    if (!response.ok) {
      throw new Error('YouTube search failed');
    }
    
    const data = await response.json();
    
    // The API returns the result directly, not wrapped in a results array
    if (data && data.id) {
      return {
        id: data.id,
        url: data.url,
        title: data.title,
        channel: data.channel,
        duration: data.duration,
        thumbnail: data.thumbnail
      };
    }
    
    return null;
  } catch (error) {
    console.error('YouTube search error:', error);
    return null;
  }
};

export const searchYouTubeForQuery = async (query: string) => {
  try {
    const response = await fetch('/api/youtube/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`YouTube search failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('YouTube search error:', error);
    return null;
  }
}; 
