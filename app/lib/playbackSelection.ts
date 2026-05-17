'use client';

import { ArtistSong, Song, clearUnofficialQueue, getSong, setCurrentSong as setCurrentSongAPI, setPlaybackSource, updateUnofficialQueueFromSongs } from './api';
import { shuffleArray } from './utils';

interface PlaybackSelectionController {
  setLocalSongList: (songs: Song[], currentIndex: number) => void;
  playSong: (song: Song) => void;
  setCurrentSong: (song: Song | undefined) => void;
  loadQueue: () => Promise<void>;
}

interface StartPlaybackSelectionOptions {
  playback: PlaybackSelectionController;
  selectedSong: Song;
  songList: Song[];
  selectedIndex: number;
  source: string;
  isShuffled: boolean;
}

export function getPlaybackSourceForView(view: string): string {
  if (view === 'discover') return 'discover';
  return view === 'user-songs' ? 'user-songs' : `playlist:${view}`;
}

export function toSongFromArtistSong(song: ArtistSong, fallbackArtist: string | null = null): Song {
  return {
    song_id: song.song_id,
    title: song.title || song.song_id,
    artist: song.artist || fallbackArtist || undefined,
    status: 'COMPLETE',
    duration: song.duration || 0,
    actual_id: song.actual_id,
    stream_url: song.stream_url,
  };
}

export function toSongListFromArtistSongs(songs: ArtistSong[], fallbackArtist: string | null = null): Song[] {
  return songs.map((song) => toSongFromArtistSong(song, fallbackArtist));
}

function buildLoopingQueue(songList: Song[], selectedIndex: number, isShuffled: boolean, limit = 50): Song[] {
  if (selectedIndex < 0 || selectedIndex >= songList.length) {
    return [];
  }

  const songsAfter = songList.slice(selectedIndex + 1);
  const songsBefore = songList.slice(0, selectedIndex);
  let queueSongs = [...songsAfter, ...songsBefore];

  if (isShuffled) {
    queueSongs = shuffleArray(queueSongs);
  }

  return queueSongs.slice(0, limit);
}

async function hydratePlaybackSong(song: Song): Promise<Song> {
  const fetchedSong = await getSong(song.actual_id || song.song_id);
  return song.actual_id
    ? { ...fetchedSong, song_id: song.song_id, actual_id: song.actual_id }
    : fetchedSong;
}

export async function startPlaybackSelection({
  playback,
  selectedSong,
  songList,
  selectedIndex,
  source,
  isShuffled,
}: StartPlaybackSelectionOptions): Promise<boolean> {
  const localSongList = songList.length > 0 ? songList : [selectedSong];
  const localIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const canPlayImmediately = Boolean(selectedSong.stream_url && !selectedSong.actual_id);

  playback.setLocalSongList(localSongList, localIndex);

  if (canPlayImmediately) {
    playback.playSong(selectedSong);
  }

  try {
    const playableSong = await hydratePlaybackSong(selectedSong);
    if (canPlayImmediately) {
      playback.setCurrentSong(playableSong);
    } else {
      playback.playSong(playableSong);
    }

    setCurrentSongAPI(selectedSong.song_id).catch((error) =>
      console.error('Failed to set current song on backend:', error)
    );
  } catch (error) {
    console.error('Failed to get song for playback:', error);
    if (!canPlayImmediately) {
      return false;
    }
  }

  try {
    await clearUnofficialQueue();
    await setPlaybackSource(source);

    const queueSongs = buildLoopingQueue(localSongList, localIndex, isShuffled);
    if (queueSongs.length > 0) {
      await updateUnofficialQueueFromSongs(queueSongs, selectedSong.song_id, 50);
    }

    await playback.loadQueue();
  } catch (error) {
    console.error('Backend queue setup failed (local fallback active):', error);
  }

  return true;
}
