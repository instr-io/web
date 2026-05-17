'use client';

import { useCallback, useRef } from 'react';
import { ArtistSong, Song, clearQueue, getArtistSongs, getArtists, getSong, popNextSong, setCurrentSong as setCurrentSongAPI, updateUnofficialQueueFromSongs } from '../lib/api';
import { getPlaybackSourceForView, startPlaybackSelection, toSongFromArtistSong } from '../lib/playbackSelection';

interface PlaybackLauncherController {
  isShuffled: boolean;
  loadQueue: () => Promise<void>;
  playSong: (song: Song) => void;
  setCurrentSong: (song: Song | undefined) => void;
  setLocalSongList: (songs: Song[], currentIndex: number) => void;
}

interface UsePlaybackLauncherOptions {
  currentView: string;
  currentArtistName: string | null;
  discoverSongs: Song[];
  sortedCompleteSongs: Song[];
  fallbackCompleteSongs: Song[];
  playback: PlaybackLauncherController;
  setPlaybackSourceView: (view: string) => void;
  setPlaybackSourceArtist: (artist: string | null) => void;
}

export function usePlaybackLauncher({
  currentView,
  currentArtistName,
  discoverSongs,
  sortedCompleteSongs,
  fallbackCompleteSongs,
  playback,
  setPlaybackSourceView,
  setPlaybackSourceArtist,
}: UsePlaybackLauncherOptions) {
  const lastRandomArtistRef = useRef<string | null>(null);

  const resumeQueuedPlayback = useCallback(async (): Promise<boolean> => {
    try {
      const nextFromQueue = await popNextSong();
      if (!nextFromQueue) {
        return false;
      }

      const songToPlay = await getSong(nextFromQueue.song_id);
      playback.setCurrentSong(songToPlay);
      setCurrentSongAPI(songToPlay.song_id).catch(console.error);
      await playback.loadQueue();
      return true;
    } catch (error) {
      console.error('Failed to check existing queue:', error);
      return false;
    }
  }, [playback]);

  const startRandomDiscoverPlayback = useCallback(async () => {
    try {
      const allArtists = await getArtists();
      if (allArtists.length === 0) {
        return;
      }

      const pickRandomArtist = (exclude: string | null) => {
        const candidates = allArtists.length > 1 && exclude
          ? allArtists.filter((artist) => artist.name !== exclude)
          : allArtists;
        const maxWeight = (1 / candidates.length) * 5;
        const rawWeights = candidates.map((artist) => artist.song_count || 1);
        const rawTotal = rawWeights.reduce((sum, weight) => sum + weight, 0);
        const cappedWeights = rawWeights.map((weight) => Math.min(weight / rawTotal, maxWeight));
        const totalWeight = cappedWeights.reduce((sum, weight) => sum + weight, 0);
        let roll = Math.random() * totalWeight;

        for (let index = 0; index < candidates.length; index += 1) {
          roll -= cappedWeights[index];
          if (roll <= 0) {
            return candidates[index];
          }
        }

        return candidates[0];
      };

      const pickRandomSong = (songs: ArtistSong[]) => {
        const totalWeight = songs.reduce((sum, song) => sum + (song.listen_count || 1), 0);
        let roll = Math.random() * totalWeight;

        for (const song of songs) {
          roll -= (song.listen_count || 1);
          if (roll <= 0) {
            return song;
          }
        }

        return songs[0];
      };

      const firstArtist = pickRandomArtist(lastRandomArtistRef.current);
      lastRandomArtistRef.current = firstArtist.name;
      const firstArtistSongs = (await getArtistSongs(firstArtist.name)).filter((song) => song.status === 'COMPLETE');
      if (firstArtistSongs.length === 0) {
        return;
      }

      const firstPick = pickRandomSong(firstArtistSongs);
      const fetchedSong = await getSong(firstPick.actual_id || firstPick.song_id);
      const songToPlay = firstPick.actual_id
        ? { ...fetchedSong, song_id: firstPick.song_id, actual_id: firstPick.actual_id }
        : fetchedSong;
      playback.playSong(songToPlay);

      const queueSongs: Song[] = [];
      const usedSongIds = new Set([firstPick.song_id]);
      let lastArtist = firstArtist.name;
      const artistSongsCache = new Map<string, ArtistSong[]>();
      artistSongsCache.set(firstArtist.name, firstArtistSongs);

      for (let index = 0; index < 20; index += 1) {
        const artist = pickRandomArtist(lastArtist);
        lastArtist = artist.name;

        if (!artistSongsCache.has(artist.name)) {
          artistSongsCache.set(
            artist.name,
            (await getArtistSongs(artist.name)).filter((song) => song.status === 'COMPLETE')
          );
        }

        const availableSongs = artistSongsCache.get(artist.name)!.filter((song) => !usedSongIds.has(song.song_id));
        if (availableSongs.length === 0) {
          continue;
        }

        const pick = pickRandomSong(availableSongs);
        usedSongIds.add(pick.song_id);
        queueSongs.push(toSongFromArtistSong(pick));
      }

      if (queueSongs.length > 0) {
        playback.setLocalSongList([toSongFromArtistSong(firstPick), ...queueSongs], 0);
        try {
          await clearQueue();
          await updateUnofficialQueueFromSongs(queueSongs, firstPick.song_id, 50);
          await playback.loadQueue();
        } catch (error) {
          console.error('Queue setup for random songs failed (local fallback active):', error);
        }
      }
    } catch (error) {
      console.error('Failed to play random discover song:', error);
    }
  }, [playback]);

  const startPlaybackFromCurrentContext = useCallback(async () => {
    const hasDiscoverSongs = currentView === 'discover' && discoverSongs.length > 0;
    const activeSongs = hasDiscoverSongs
      ? discoverSongs
      : (sortedCompleteSongs.length > 0 ? sortedCompleteSongs : fallbackCompleteSongs);
    const firstSong = activeSongs.length > 0 ? activeSongs[0] : null;

    if (firstSong) {
      setPlaybackSourceView(currentView);
      setPlaybackSourceArtist(currentView === 'discover' ? currentArtistName : null);

      const didStartPlayback = await startPlaybackSelection({
        playback,
        selectedSong: firstSong,
        songList: activeSongs,
        selectedIndex: 0,
        source: getPlaybackSourceForView(currentView),
        isShuffled: playback.isShuffled,
      });
      if (!didStartPlayback) {
        return;
      }
      return;
    }

    await startRandomDiscoverPlayback();
  }, [currentArtistName, currentView, discoverSongs, fallbackCompleteSongs, playback, setPlaybackSourceArtist, setPlaybackSourceView, sortedCompleteSongs, startRandomDiscoverPlayback]);

  return {
    resumeQueuedPlayback,
    startPlaybackFromCurrentContext,
  };
}
