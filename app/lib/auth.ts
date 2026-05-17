import { AuthClient } from '@supabase/auth-js';
import { isSupabaseConfigured, publicEnv } from './env';

// Types
export interface User {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
  };
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  userType: 'anonymous' | 'supabase' | null;
}

// Configuration
const supabaseUrl = publicEnv.supabaseUrl;
const supabaseAnonKey = publicEnv.supabaseAnonKey;

// Create auth-only client with correct Supabase API endpoints
export const authClient = isSupabaseConfigured
  ? new AuthClient({
      url: `${supabaseUrl}/auth/v1`,
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storageKey: 'supabase.auth.token',
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    })
  : null;

function createAnonymousUserId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `anon_${crypto.randomUUID()}`;
  }

  return `anon_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

// Backward compatibility wrapper
export const supabase = authClient ? { auth: authClient } : null;

// Cookie utilities
const setCookie = (name: string, value: string, hoursFromNow: number = 24) => {
  if (typeof document === 'undefined') return;
  
  const date = new Date();
  date.setTime(date.getTime() + (hoursFromNow * 60 * 60 * 1000));
  const expires = `expires=${date.toUTCString()}`;
  document.cookie = `${name}=${value};${expires};path=/;SameSite=Lax;Secure`;
};

const getCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;
  
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for(let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
};

const deleteCookie = (name: string) => {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
};

// Authentication Manager Class
class AuthManager {
  private currentUserId: string | null = null;
  private authState: AuthState = {
    user: null,
    isAuthenticated: false,
    isLoading: true,
    userType: null
  };
  private listeners: ((state: AuthState) => void)[] = [];
  private initialized = false;

  // Subscribe to auth state changes
  subscribe(listener: (state: AuthState) => void) {
    this.listeners.push(listener);
    // Immediately call with current state
    listener(this.authState);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Notify all listeners of state changes
  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.authState));
  }

  // Update auth state
  private updateAuthState(updates: Partial<AuthState>) {
    this.authState = { ...this.authState, ...updates };
    this.notifyListeners();
  }

  // Initialize authentication
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // STEP 1: Setup auth listener first
      if (authClient) {
        this.setupAuthListener();
      }

      // STEP 2: Quick sync check - do we have a stored session?
      // This helps us decide whether to wait for auth or go straight to anonymous
      const hasStoredSession = typeof window !== 'undefined' &&
        (localStorage.getItem('supabase.auth.token') || getCookie('instrio_user_type') === 'supabase');

      if (authClient && hasStoredSession) {
        // User likely has a session - MUST validate it definitively with Supabase
        const authCheckPromise = authClient.getUser();
        const timeoutPromise = new Promise<{ data: { user: null }, error: { message: string } }>((resolve) =>
          setTimeout(() => resolve({ data: { user: null }, error: { message: 'Auth check timeout' } }), 2000)
        );

        const { data: { user }, error } = await Promise.race([authCheckPromise, timeoutPromise]);

        if (user && !error) {
          // DEFINITIVE: User is authenticated
          // Set current user to authenticated user
          this.currentUserId = user.id;
          this.updateAuthState({
            user,
            isAuthenticated: true,
            isLoading: false,
            userType: 'supabase'
          });

          // Clean up ALL old cookies and set new ones
          this.cleanupAndSetSupabaseUser(user.id);

          this.initialized = true;
          return;
        } else {
          // DEFINITIVE: Session is invalid/expired - clear ALL stale data
          console.log('Stored session is invalid - clearing stale auth data');
          this.clearLocalState();
        }
      }

      // STEP 3: No stored session OR auth check failed/timed out - initialize as anonymous
      await this.initializeAnonymousUser();

    } catch (error) {
      console.error('Auth initialization error', error);
      // Clear any stale state and fallback to anonymous
      this.clearLocalState();
      await this.initializeAnonymousUser();
    }

    this.initialized = true;
  }

  // Clean up all user-related cookies and localStorage, then set authenticated user
  private cleanupAndSetSupabaseUser(supabaseUserId: string): void {
    // Delete ALL old user-related cookies
    deleteCookie('instrio_anonymous_user_id');
    deleteCookie('instrio_user_id'); // Delete old one first
    
    // Clear localStorage (legacy)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('instrio_user_id');
    }
    
    // Set new authenticated user cookies
    setCookie('instrio_user_id', supabaseUserId);
    setCookie('instrio_user_type', 'supabase');
  }

  // Initialize anonymous user
  private async initializeAnonymousUser(): Promise<void> {
    // Check for cached anonymous user
    const cachedUserId = getCookie('instrio_anonymous_user_id');
    if (cachedUserId) {
      this.currentUserId = cachedUserId;
      this.updateAuthState({
        user: { id: cachedUserId },
        isAuthenticated: true,
        isLoading: false,
        userType: 'anonymous'
      });
    } else {
      // Generate new anonymous user
      const anonymousId = createAnonymousUserId();
      setCookie('instrio_anonymous_user_id', anonymousId);
      setCookie('instrio_user_type', 'anonymous');
      
      this.currentUserId = anonymousId;
      this.updateAuthState({
        user: { id: anonymousId },
        isAuthenticated: true,
        isLoading: false,
        userType: 'anonymous'
      });
    }
  }

  // Get current user ID
  getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  // Get current auth state
  getAuthState(): AuthState {
    return this.authState;
  }

  // Sign in with Supabase
  async signIn(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    if (!authClient) {
      return { success: false, error: 'Authentication not configured' };
    }

    try {
      const { data, error } = await authClient.signInWithPassword({ email, password });
      
      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        this.currentUserId = data.user.id;
        this.updateAuthState({
          user: data.user,
          isAuthenticated: true,
          isLoading: false,
          userType: 'supabase'
        });
        
        this.cleanupAndSetSupabaseUser(data.user.id);
        return { success: true };
      }
      
      return { success: false, error: 'Sign in failed' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Sign up with Supabase
  async signUp(email: string, password: string): Promise<{ success: boolean; error?: string; needsVerification?: boolean }> {
    if (!authClient) {
      return { success: false, error: 'Authentication not configured' };
    }

    try {
      const { data, error } = await authClient.signUp({ email, password });
      
      if (error) {
        if (error.message?.includes('User already registered')) {
          // Try to sign in instead
          const signInResult = await this.signIn(email, password);
          return signInResult;
        }
        return { success: false, error: error.message };
      }

      if (data.user && data.session) {
        // User is immediately signed in
        this.currentUserId = data.user.id;
        this.updateAuthState({
          user: data.user,
          isAuthenticated: true,
          isLoading: false,
          userType: 'supabase'
        });
        
        this.cleanupAndSetSupabaseUser(data.user.id);
        return { success: true };
      } else if (data.user && !data.session) {
        // User needs to verify email
        return { success: true, needsVerification: true };
      }
      
      return { success: false, error: 'Sign up failed' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Sign out - DEFINITIVE cleanup and re-initialization
  async signOut(): Promise<void> {
    // STEP 1: Clear ALL local state immediately
    this.clearLocalState();

    // STEP 2: Sign out from Supabase (best effort)
    if (authClient) {
      try {
        const signOutPromise = authClient.signOut();
        await Promise.race([
          signOutPromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Sign out timeout')), 3000)
          )
        ]);
      } catch (error) {
        console.warn('Error during sign out (continuing anyway):', error);
      }
    }

    // STEP 3: Re-initialize as anonymous user
    await this.initializeAnonymousUser();
    this.initialized = true; // Mark as initialized after fresh anonymous setup
  }

  // Helper method to clear all local state - DEFINITIVE cleanup
  public clearLocalState(): void {
    // Clear ALL auth-related cookies
    deleteCookie('instrio_user_id');
    deleteCookie('instrio_anonymous_user_id');
    deleteCookie('instrio_user_type');

    // Clear ALL localStorage entries related to auth
    if (typeof window !== 'undefined') {
      localStorage.removeItem('instrio_user_id');
      localStorage.removeItem('supabase.auth.token');
      // Clear any other Supabase storage keys
      const storageKeys = Object.keys(localStorage);
      storageKeys.forEach(key => {
        if (key.startsWith('supabase.') || key.startsWith('instrio_')) {
          localStorage.removeItem(key);
        }
      });
    }

    // Reset internal state
    this.currentUserId = null;
    this.initialized = false; // Allow re-initialization
    this.updateAuthState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      userType: null
    });
  }

  // Get auth token for API calls
  async getAuthToken(): Promise<string | null> {
    if (!authClient) return null;

    try {
      const sessionPromise = authClient.getSession();
      const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) =>
        setTimeout(() => resolve({ data: { session: null } }), 1000)
      );

      const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);
      return session?.access_token || null;
    } catch (error) {
      console.error('Error getting auth token (continuing without auth):', error);
      return null;
    }
  }

  // Setup auth state listener
  setupAuthListener(): (() => void) | null {
    if (!authClient) return null;

    const { data: { subscription } } = authClient.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT' || !session?.user) {
          await this.initializeAnonymousUser();
        } else if (event === 'SIGNED_IN' && session?.user) {
          const user = session.user;
          this.currentUserId = user.id;
          this.updateAuthState({
            user,
            isAuthenticated: true,
            isLoading: false,
            userType: 'supabase'
          });
          this.cleanupAndSetSupabaseUser(user.id);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          const user = session.user;
          this.currentUserId = user.id;
          this.updateAuthState({
            user,
            isAuthenticated: true,
            isLoading: false,
            userType: 'supabase'
          });
        }
      }
    );

    return () => subscription?.unsubscribe();
  }
}

// Create singleton instance
const authManager = new AuthManager();

// Export convenience functions
export const useAuth = () => authManager.getAuthState();
export const getCurrentUserId = () => authManager.getCurrentUserId();
export const getAuthToken = () => authManager.getAuthToken();
export const signIn = (email: string, password: string) => authManager.signIn(email, password);
export const signUp = (email: string, password: string) => authManager.signUp(email, password);
export const signOut = () => authManager.signOut();
export const forceSignOut = () => authManager.clearLocalState(); // Emergency local-only signout
export const initializeAuth = () => authManager.initialize();
export const subscribeToAuth = (listener: (state: AuthState) => void) => authManager.subscribe(listener);
