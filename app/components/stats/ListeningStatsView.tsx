'use client';

import { useEffect, useState, useMemo } from 'react';
import { getListeningStats, ListeningStats } from '@/app/lib/api';

type AggregateBy = 'day' | 'week' | 'month' | 'year';

function thirtyDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 29);
  return d.toISOString().slice(0, 10);
}

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

function aggregateDays(
  days: { date: string; seconds: number }[],
  aggregateBy: AggregateBy,
): { date: string; seconds: number; label: string }[] {
  if (aggregateBy === 'day') {
    return days.map(d => ({ ...d, label: formatDate(d.date) }));
  }

  const buckets = new Map<string, number>();

  for (const { date, seconds } of days) {
    let key: string;
    if (aggregateBy === 'week') {
      key = getWeekStart(date);
    } else if (aggregateBy === 'month') {
      key = date.slice(0, 7);
    } else {
      key = date.slice(0, 4);
    }
    buckets.set(key, (buckets.get(key) || 0) + seconds);
  }

  const sorted = [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return sorted.map(([key, seconds]) => {
    let label: string;
    if (aggregateBy === 'week') {
      label = formatDate(key);
    } else if (aggregateBy === 'month') {
      const [y, m] = key.split('-');
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      label = `${months[parseInt(m) - 1]} '${y.slice(2)}`;
    } else {
      label = key;
    }
    return { date: key, seconds, label };
  });
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
}

function formatDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-');
  return `${parseInt(month)}/${parseInt(day)}`;
}

export function ListeningStatsView() {
  const [stats, setStats] = useState<ListeningStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [aggregateBy, setAggregateBy] = useState<AggregateBy>('day');
  // Track whether we've fetched the full dataset yet
  const [hasFetchedFull, setHasFetchedFull] = useState(false);

  useEffect(() => {
    // "day" defaults to last 30 days; everything else needs the full dataset
    const needsFull = aggregateBy !== 'day';

    if (needsFull && hasFetchedFull) return; // already have full data
    if (!needsFull && stats && !hasFetchedFull) return; // already have day data, haven't upgraded

    setLoading(true);
    const startDate = needsFull ? undefined : thirtyDaysAgo();

    getListeningStats(startDate)
      .then(data => {
        setStats(data);
        if (needsFull) setHasFetchedFull(true);
      })
      .catch(() => setStats({ artists: [], days: [] }))
      .finally(() => setLoading(false));
  }, [aggregateBy, hasFetchedFull, stats]);

  const aggregatedDays = useMemo(() => {
    if (!stats) return [];
    const sorted = [...stats.days].sort((a, b) => a.date.localeCompare(b.date));
    return aggregateDays(sorted, aggregateBy);
  }, [stats, aggregateBy]);

  if (loading) {
    return null;
  }

  if (!stats || (stats.artists.length === 0 && stats.days.length === 0)) {
    return (
      <div className="stats-empty-state">
        No listening data yet. Start playing some songs!
      </div>
    );
  }

  const sortedArtists = [...stats.artists].sort((a, b) => b.seconds - a.seconds);
  const maxArtistSeconds = sortedArtists[0]?.seconds || 1;
  const maxDaySeconds = Math.max(...aggregatedDays.map(d => d.seconds), 1);
  const fewColumns = aggregatedDays.length < 4;

  return (
    <div className="stats-container no-scrollbar">
      <h3 className="stats-section-title">BY ARTIST</h3>
      <div className="stats-artist-list">
        {sortedArtists.map(({ artist, seconds }) => (
          <div key={artist} className="stats-artist-row">
            <span className="stats-artist-name">{artist}</span>
            <div className="stats-bar-track">
              <div
                className="stats-bar-fill"
                style={{ width: `${(seconds / maxArtistSeconds) * 100}%` }}
              />
            </div>
            <span className="stats-artist-time">{formatTime(seconds)}</span>
          </div>
        ))}
      </div>

      <h3 className="stats-section-title stats-day-section-title">
        BY{' '}
        <select
          value={aggregateBy}
          onChange={e => setAggregateBy(e.target.value as AggregateBy)}
          className="stats-aggregate-select"
        >
          <option value="day">DAY</option>
          <option value="week">WEEK</option>
          <option value="month">MONTH</option>
          <option value="year">YEAR</option>
        </select>
      </h3>
      <div className="stats-day-scroll">
        <div className={`stats-day-chart ${fewColumns ? 'stats-day-chart--few' : ''}`}>
          {aggregatedDays.map(({ date, seconds, label }) => (
            <div key={date} className="stats-day-col">
              <span className="stats-day-time">{formatTime(seconds)}</span>
              <div className="stats-day-bar-track">
                <div
                  className="stats-day-bar-fill"
                  style={{ height: `${(seconds / maxDaySeconds) * 100}%` }}
                />
              </div>
              <span className="stats-day-label">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
