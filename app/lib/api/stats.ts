import { API_BASE, getAuthToken, getCurrentUserId, requireCurrentUserId } from './client';
import type { ListeningStats, UserQuota } from './types';

export async function getUserQuota(): Promise<UserQuota> {
  const userId = requireCurrentUserId('User ID required for quota information');
  const token = await getAuthToken();

  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/users/${userId}/quota`, {
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user quota');
  }

  return response.json();
}

export async function getListeningStats(startDate?: string): Promise<ListeningStats> {
  const userId = getCurrentUserId();
  if (!userId) return { artists: [], days: [] };

  let url = `${API_BASE}/stats/listening?user_id=${userId}`;
  if (startDate) url += `&start_date=${startDate}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch listening stats');
  return response.json();
}
