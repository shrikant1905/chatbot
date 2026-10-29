import React, { useEffect, useState } from 'react';
import { FiX, FiSliders, FiSun, FiMoon, FiMonitor, FiCheck } from 'react-icons/fi';

export function SettingsModal({
  isOpen,
  onClose,
  themeMode,
  setThemeMode,
  onShowToast
}) {
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [codeLineNumbers, setCodeLineNumbers] = useState(false);
  const [soundEffects, setSoundEffects] = useState(false);
  const [fontSize, setFontSize] = useState('standard');

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

  const handleSave = () => {
    onClose();
    if (onShowToast) {
      onShowToast('Preferences saved successfully.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
      >
        <div className="modal-header">
          <div className="modal-title" id="settings-modal-title">
            <FiSliders style={{ color: 'var(--brand-primary)' }} />
            <span>Settings</span>
          </div>
          <button
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close settings modal"
          >
            <FiX />
          </button>
        </div>

        <div className="modal-body">
          {/* Section: Appearance */}
          <div className="settings-section">
            <div className="settings-section-title">Appearance</div>

            <div className="settings-row">
              <div className="settings-label-box">
                <span className="settings-label">Theme Mode</span>
                <span className="settings-description">
                  Choose your interface visual theme or match system settings
                </span>
              </div>
              <div className="segmented-control">
                <button
                  type="button"
                  className={`segment-btn ${themeMode === 'light' ? 'active' : ''}`}
                  onClick={() => setThemeMode('light')}
                >
                  <FiSun />
                  <span>Light</span>
                </button>
                <button
                  type="button"
                  className={`segment-btn ${themeMode === 'dark' ? 'active' : ''}`}
                  onClick={() => setThemeMode('dark')}
                >
                  <FiMoon />
                  <span>Dark</span>
                </button>
                <button
                  type="button"
                  className={`segment-btn ${themeMode === 'system' ? 'active' : ''}`}
                  onClick={() => setThemeMode('system')}
                >
                  <FiMonitor />
                  <span>System</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section: Chat & Messages */}
          <div className="settings-section">
            <div className="settings-section-title">Chat & Display Preferences</div>

            <div className="settings-row">
              <div className="settings-label-box">
                <span className="settings-label">Display Timestamps</span>
                <span className="settings-description">
                  Show message delivery timestamps next to author name
                </span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={showTimestamps}
                  onChange={(e) => setShowTimestamps(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="settings-row">
              <div className="settings-label-box">
                <span className="settings-label">Code Block Line Numbers</span>
                <span className="settings-description">
                  Display vertical line counts on syntax-highlighted blocks
                </span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={codeLineNumbers}
                  onChange={(e) => setCodeLineNumbers(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="settings-row">
              <div className="settings-label-box">
                <span className="settings-label">Sound Effects</span>
                <span className="settings-description">
                  Play subtle auditory chime upon local interaction (preview toggle)
                </span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={soundEffects}
                  onChange={(e) => setSoundEffects(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          {/* Section: About Kiaan AI */}
          <div className="settings-section">
            <div className="settings-section-title">About Kiaan AI</div>

            <div style={{
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.84rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Kiaan AI Workspace</strong>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-xs)',
                  background: 'var(--tag-bg)',
                  color: 'var(--tag-text)',
                  fontSize: '0.72rem',
                  fontWeight: 600
                }}>
                  v1.0.0 Frontend
                </span>
              </div>
              <div>
                This is a high-performance, strictly client-side UI prototype designed with React, Vite, and custom CSS design tokens.
              </div>
              <div style={{ marginTop: '8px', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                • Backend, authentication, and LLM integrations are scheduled for the subsequent phase.
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            <FiCheck />
            <span>Save Preferences</span>
          </button>
        </div>
      </div>
    </div>
  );
}

