export interface Song {
  song_id: string;
  title: string;
  artist?: string;
  status: 'QUEUED' | 'FETCHING' | 'PREPARING_TO_CONVERT' | 'CONVERTING' | 'DOWNLOADING' | 'COMPLETE' | 'ERROR';
  duration?: number;
  stream_url?: string;
  timestamp?: number;
  is_incorrect?: boolean;
  actual_id?: string;
}

export interface QueueItem {
  index: number;
  song_id: string;
  title?: string;
}

export interface Playlist {
  playlist_id: string;
  playlist_name: string;
  song_ids: string[];
}

export interface UserPlaylist {
  playlist_id: string;
  playlist_name: string;
  song_count: number;
  original_user_id?: string;
  artist_name?: string;
}

export interface PlaylistWithSongs {
  playlist_id: string;
  name: string;
  songs: Song[];
  artist_name?: string;
}

export interface UserPlaylistsResponse {
  playlists: UserPlaylist[];
}

export interface PlaylistMutationResponse {
  playlist: UserPlaylist;
}

export interface PlaylistShareResponse {
  share_url: string;
}

export interface ShortCodePlaylistResponse extends PlaylistWithSongs {
  public?: boolean;
  user_id: string;
}

export interface UserQuota {
  conversions_used: number;
  daily_limit: number;
  remaining: number;
  reset_in_hours: number;
  reset_in_minutes: number;
  last_reset_date: string;
}

export interface Artist {
  name: string;
  song_count: number;
}

export interface ArtistSong {
  song_id: string;
  title: string;
  artist?: string;
  status?: Song['status'];
  duration?: number;
  stream_url?: string;
  actual_id?: string;
  listen_count?: number;
  created_at?: number;
}

export interface ListeningStats {
  artists: { artist: string; seconds: number }[];
  days: { date: string; seconds: number }[];
}
