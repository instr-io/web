import { getCurrentUserId as getAuthUserId, getAuthToken as getAuthTokenFromAuth } from '../auth';
import { buildApiUrl } from '../env';

export const API_BASE = buildApiUrl();

export function getCurrentUserId(): string | null {
  return getAuthUserId();
}

export async function getAuthToken(): Promise<string | null> {
  return getAuthTokenFromAuth();
}

export function requireCurrentUserId(message: string): string {
  const userId = getCurrentUserId();
  if (!userId) {
    throw new Error(message);
  }

  return userId;
}

export async function createHeaders(additionalHeaders: Record<string, string> = {}): Promise<Record<string, string>> {
  const userId = getCurrentUserId();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(userId ? { 'X-User-Id': userId } : {}),
    ...additionalHeaders,
  };

  const token = await getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}
