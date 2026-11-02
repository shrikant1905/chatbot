import React, { useState, useEffect } from 'react';
import {
  FiX,
  FiMail,
  FiLock,
  FiUser,
  FiEye,
  FiEyeOff,
  FiArrowRight,
  FiAlertCircle,
  FiShield
} from 'react-icons/fi';
import { apiClient } from '../api/client';

export function AuthModal({ isOpen, onClose, onAuthSuccess, onShowToast }) {
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    if (tab === 'register' && password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      let res;
      if (tab === 'login') {
        res = await apiClient.login(email.trim(), password);
        onShowToast?.(`Welcome back, ${res.user.name}!`);
      } else {
        res = await apiClient.register(name.trim(), email.trim(), password);
        onShowToast?.(`Welcome to Kiaan AI, ${res.user.name}!`);
      }

      if (res.user) {
        onAuthSuccess?.(res.user);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleContinueAsGuest = () => {
    onClose();
    onShowToast?.('Browsing as Guest. Chats will not be saved.');
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div
        className="auth-chatgpt-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        {/* Subtle Close Button */}
        <button
          type="button"
          className="auth-chatgpt-close"
          onClick={onClose}
          aria-label="Close"
          title="Close (Esc)"
        >
          <FiX />
        </button>

        {/* ChatGPT Style Centered Logo & Header */}
        <div className="auth-chatgpt-header">
          <div className="auth-chatgpt-logo-orb">
            <img src="/assets/kiaan-orb-3d.png" alt="Kiaan AI Logo" />
          </div>
          <h2 id="auth-modal-title" className="auth-chatgpt-title">
            {tab === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="auth-chatgpt-subtitle">
            {tab === 'login'
              ? 'Log in to Kiaan AI to continue your conversations and view chat history.'
              : 'Sign up to save your conversations, attachments, and customize preferences.'}
          </p>
        </div>

        {/* Tab Toggle Switcher */}
        <div className="auth-chatgpt-tabs">
          <button
            type="button"
            className={`auth-chatgpt-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => {
              setTab('login');
              setError('');
            }}
          >
            Log in
          </button>
          <button
            type="button"
            className={`auth-chatgpt-tab ${tab === 'register' ? 'active' : ''}`}
            onClick={() => {
              setTab('register');
              setError('');
            }}
          >
            Sign up
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="auth-chatgpt-error">
            <FiAlertCircle />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="auth-chatgpt-form">
          {tab === 'register' && (
            <div className="auth-chatgpt-field">
              <label htmlFor="auth-name">Full name</label>
              <div className="auth-chatgpt-input-box">
                <FiUser className="auth-field-icon" />
                <input
                  id="auth-name"
                  type="text"
                  placeholder="e.g. Rohit Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </div>
            </div>
          )}

          <div className="auth-chatgpt-field">
            <label htmlFor="auth-email">Email or username</label>
            <div className="auth-chatgpt-input-box">
              <FiMail className="auth-field-icon" />
              <input
                id="auth-email"
                type="text"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="auth-chatgpt-field">
            <div className="auth-chatgpt-label-row">
              <label htmlFor="auth-password">Password</label>
              {tab === 'register' && <span className="auth-hint">Min 6 characters</span>}
            </div>
            <div className="auth-chatgpt-input-box">
              <FiLock className="auth-field-icon" />
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                required
              />
              <button
                type="button"
                className="auth-chatgpt-eye-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="auth-chatgpt-primary-btn"
            disabled={loading}
          >
            {loading ? (
              <span className="auth-spinner" />
            ) : (
              <>
                <span>{tab === 'login' ? 'Continue' : 'Sign up'}</span>
                <FiArrowRight />
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="auth-chatgpt-divider">
          <span>OR</span>
        </div>

        {/* Guest Mode Button (ChatGPT Style Clean Outline Button) */}
        <button
          type="button"
          className="auth-chatgpt-guest-btn"
          onClick={handleContinueAsGuest}
        >
          <FiShield />
          <span>Continue as Guest (No Login Required)</span>
        </button>

        <p className="auth-chatgpt-footer-hint">
          ⚡ <strong>Guest mode:</strong> You can chat right away, but conversations are not saved.
        </p>
      </div>
    </div>
  );
}
