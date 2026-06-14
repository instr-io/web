'use client';

import { useState, useEffect } from 'react';
import { subscribeToAuth, signIn, signUp, signOut, AuthState } from '../../lib/auth';
import { getUserQuota, UserQuota } from '../../lib/api';
import { ThemeToggle } from '@/app/components/theme/ThemeToggle';

interface UserProfileProps {
  onAboutClick?: () => void;
}

export function UserProfile({ onAboutClick }: UserProfileProps) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    userType: null
  });
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [quota, setQuota] = useState<UserQuota | null>(null);

  // Subscribe to auth state changes
  useEffect(() => {
    const unsubscribe = subscribeToAuth((newAuthState) => {
      setAuthState(newAuthState);
      
      // Load quota for authenticated Supabase users
      if (newAuthState.user && newAuthState.userType === 'supabase') {
        // loadQuota(); // Removed automatic quota loading
      } else {
        setQuota(null);
      }
    });

    return unsubscribe;
  }, []);

  const loadQuota = async () => {
    try {
      const quotaData = await getUserQuota();
      setQuota(quotaData);
    } catch (error) {
      console.error('Failed to load quota:', error);
      setQuota(null);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setAuthLoading(true);
    setAuthError('');

    try {
      const result = isSignUp 
        ? await signUp(email, password)
        : await signIn(email, password);
      
      if (!result.success) {
        setAuthError(result.error || 'Authentication failed');
      } else {
        if ('needsVerification' in result && result.needsVerification) {
          setAuthError('Check your email for verification link!');
        } else {
          setShowAuthForm(false);
          setEmail('');
          setPassword('');
        }
      }
    } catch (error) {
      setAuthError('An unexpected error occurred');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      // Close dropdown immediately to show responsiveness
      setShowDropdown(false);
      
      // Clear quota immediately
      setQuota(null);
      
      // Perform signout with timeout protection
      await Promise.race([
        signOut(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Signout timeout')), 3000)
        )
      ]);
    } catch (error) {
      console.warn('Signout completed with warning:', error);
      // Don't show error to user - signout should always appear successful
      // Local state is already cleared by the signOut function
    }
  };

  const toggleAuthMode = () => {
    setIsSignUp(!isSignUp);
    setAuthError('');
    setEmail('');
    setPassword('');
  };

  if (authState.isLoading) {
    return null;
  }

  // Show sign in button for anonymous users
  if (authState.userType === 'anonymous') {
    return (
      <div className="user-profile">
        <button className="sign-in-btn" onClick={() => setShowAuthForm(true)}>
          Sign In
        </button>
        
        {showAuthForm && (
          <div className="auth-modal-overlay" onClick={() => setShowAuthForm(false)}>
            <div className="auth-modal" onClick={e => e.stopPropagation()}>
              <div className="auth-header">
                <h3>{isSignUp ? 'Sign Up' : 'Sign In'}</h3>
                <button className="auth-close" onClick={() => setShowAuthForm(false)}>×</button>
              </div>
              
              <form onSubmit={handleAuth} className="auth-form">
                {authError && (
                  <div className={`auth-message ${
                    authError.includes('verification') ? 'success' : 
                    authError.includes('Welcome back') ? 'success' : 'error'
                  }`}>
                    {authError}
                  </div>
                )}
                
                <div className="auth-field">
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                
                <div className="auth-field">
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                
                <button type="submit" className={`auth-submit ${isSignUp ? 'sign-up' : ''}`} disabled={authLoading}>
                  {authLoading ? 'LOADING' : (isSignUp ? 'Sign Up' : 'Sign In')}
                </button>
                
                <button type="button" className="auth-toggle" onClick={toggleAuthMode}>
                  {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Show user profile for authenticated Supabase users
  if (authState.userType === 'supabase' && authState.user) {
    const userInitial = authState.user.email?.charAt(0).toUpperCase() || '?';
    const userEmail = authState.user.email || 'User';

    return (
      <div className="user-profile">
        <div className="user-avatar-container">
          <button 
            className="user-avatar"
            onClick={() => { const newShow = !showDropdown; setShowDropdown(newShow); if (newShow && !quota) loadQuota(); }}
          >
            {authState.user.user_metadata?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={authState.user.user_metadata.avatar_url} alt="User avatar" />
            ) : (
              <span className="user-initial">{userInitial}</span>
            )}
          </button>
          
          {showDropdown && (
            <div className="user-dropdown">
              <div className="user-info">
                <div className="user-email">{userEmail}</div>
                {quota && (
                  <div className="user-quota">
                    <div className="quota-text">
                      {quota.remaining} / {quota.daily_limit}
                    </div>
                    <div className="quota-bar">
                      <div 
                        className="quota-fill" 
                        style={{ width: `${(quota.conversions_used / quota.daily_limit) * 100}%` }}
                      ></div>
                    </div>
                    <div className="quota-reset">
                      Resets in {quota.reset_in_hours}h {quota.reset_in_minutes}m
                    </div>
                  </div>
                )}
                <div className="user-theme-row">
                  <ThemeToggle className="theme-toggle--dropdown" compact label="Theme" showValue={false} />
                </div>
              </div>
              <button className="sign-out-btn" onClick={handleSignOut}>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Fallback - should not happen with proper auth initialization
  return (
    <div className="user-profile">
      <button className="sign-in-btn" onClick={() => setShowAuthForm(true)}>
        Sign In
      </button>
    </div>
  );
} 
