import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, UserPlus, AlertCircle, TrendingUp } from 'lucide-react';

export const Auth: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (isSignUp) {
        await signUp(email, password);
        setSuccess('Account created! Please check your email to verify your account.');
        setEmail('');
        setPassword('');
      } else {
        await signIn(email, password);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-md p-8">
        
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/20 rounded-full mb-4">
            <TrendingUp className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Sports Trader Pro</h1>
          <p className="text-gray-400">
            {isSignUp ? 'Create your account' : 'Sign in to your account'}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-center gap-2 text-red-300">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/50 rounded-lg flex items-center gap-2 text-green-300">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{success}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Email</label>
            <input
              type="email"
              required
              placeholder="your@email.com"
              className="w-full bg-background border border-border rounded-lg p-3 text-white focus:border-primary outline-none transition-colors"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Password</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              minLength={6}
              className="w-full bg-background border border-border rounded-lg p-3 text-white focus:border-primary outline-none transition-colors"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {isSignUp && (
              <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-blue-600 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
          >
            {loading ? (
              <span>Loading...</span>
            ) : isSignUp ? (
              <>
                <UserPlus className="w-5 h-5" />
                Sign Up
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                Sign In
              </>
            )}
          </button>
        </form>

        {/* Toggle Sign In / Sign Up */}
        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
              setSuccess(null);
            }}
            className="text-sm text-gray-400 hover:text-primary transition-colors"
          >
            {isSignUp 
              ? 'Already have an account? Sign In' 
              : "Don't have an account? Sign Up"}
          </button>
        </div>

        {/* Info Note */}
        <div className="mt-8 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <p className="text-xs text-blue-300 text-center">
            🔒 Your data is secured with Supabase authentication
          </p>
        </div>
      </div>
    </div>
  );
};

