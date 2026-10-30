import React, { useEffect, useState } from 'react';
import {
  FiX,
  FiSliders,
  FiSun,
  FiMoon,
  FiMonitor,
  FiCheck,
  FiTrash2,
  FiPlus,
  FiDatabase,
  FiLoader
} from 'react-icons/fi';
import { apiClient } from '../api/client';
import { soundEffectsManager } from '../utils/soundEffects';

export function SettingsModal({
  isOpen,
  onClose,
  themeMode,
  setThemeMode,
  preferences,
  updatePreferences,
  onShowToast
}) {
  // Local settings edit state
  const [localThemeMode, setLocalThemeMode] = useState(themeMode || 'dark');
  const [showTimestamps, setShowTimestamps] = useState(preferences?.showTimestamps ?? true);
  const [codeLineNumbers, setCodeLineNumbers] = useState(preferences?.codeLineNumbers ?? false);
  const [soundEffects, setSoundEffects] = useState(preferences?.soundEffects ?? false);

  // Conversational Memory State
  const [memories, setMemories] = useState([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [loadingMemories, setLoadingMemories] = useState(false);
  const [isSavingMemory, setIsSavingMemory] = useState(false);

  // Sync state whenever modal opens or props change
  useEffect(() => {
    if (isOpen) {
      setLocalThemeMode(themeMode || 'dark');
      setShowTimestamps(preferences?.showTimestamps ?? true);
      setCodeLineNumbers(preferences?.codeLineNumbers ?? false);
      setSoundEffects(preferences?.soundEffects ?? false);

      setLoadingMemories(true);
      apiClient.getMemories()
        .then((res) => setMemories(res.memories || []))
        .catch((err) => {
          console.warn('Could not load conversational memories:', err.message);
        })
        .finally(() => setLoadingMemories(false));
    }
  }, [isOpen, themeMode, preferences]);

  // Handle ESC key to close
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

  const handleToggleSound = (checked) => {
    setSoundEffects(checked);
    if (checked) {
      soundEffectsManager.playToggle();
    }
  };

  const handleAddMemory = async () => {
    if (!newKey.trim() || !newValue.trim()) {
      onShowToast?.('Both memory key and value are required.', 'error');
      return;
    }
    setIsSavingMemory(true);
    try {
      const res = await apiClient.saveMemory(newKey.trim(), newValue.trim());
      setMemories((prev) => [
        ...prev.filter((m) => m.key_name !== res.memory.key_name),
        res.memory
      ]);
      setNewKey('');
      setNewValue('');
      onShowToast?.('Memory saved to conversational context.');
    } catch (err) {
      onShowToast?.(err.message, 'error');
    } finally {
      setIsSavingMemory(false);
    }
  };

  const handleDeleteMemory = async (id) => {
    try {
      await apiClient.deleteMemory(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
      onShowToast?.('Memory removed.');
    } catch (err) {
      onShowToast?.(err.message, 'error');
    }
  };

  const handleSave = () => {
    // 1. Update theme
    if (localThemeMode !== themeMode) {
      setThemeMode(localThemeMode);
    }

    // 2. Persist preferences
    updatePreferences?.({
      showTimestamps,
      codeLineNumbers,
      soundEffects
    });

    if (soundEffects) {
      soundEffectsManager.playToggle();
    }

    onShowToast?.('Preferences saved successfully.');
    onClose();
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
                  className={`segment-btn ${localThemeMode === 'light' ? 'active' : ''}`}
                  onClick={() => setLocalThemeMode('light')}
                >
                  <FiSun />
                  <span>Light</span>
                </button>
                <button
                  type="button"
                  className={`segment-btn ${localThemeMode === 'dark' ? 'active' : ''}`}
                  onClick={() => setLocalThemeMode('dark')}
                >
                  <FiMoon />
                  <span>Dark</span>
                </button>
                <button
                  type="button"
                  className={`segment-btn ${localThemeMode === 'system' ? 'active' : ''}`}
                  onClick={() => setLocalThemeMode('system')}
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
                  Play subtle auditory chime upon message sent and received
                </span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={soundEffects}
                  onChange={(e) => handleToggleSound(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          {/* Section: Conversational Memory */}
          <div className="settings-section">
            <div className="settings-section-title">
              <FiDatabase style={{ marginRight: '6px' }} />
              Conversational Memory
            </div>

            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.45 }}>
              Saved preferences that Kiaan AI remembers across conversations. Sensitive credentials (passwords, tokens, API keys) are strictly rejected.
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input
                type="text"
                placeholder="Key (e.g. style)"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddMemory();
                }}
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-surface-elevated)',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem'
                }}
              />
              <input
                type="text"
                placeholder="Value (e.g. concise, modern JS)"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddMemory();
                }}
                style={{
                  flex: 2,
                  padding: '7px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-surface-elevated)',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem'
                }}
              />
              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: '7px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={handleAddMemory}
                disabled={isSavingMemory}
              >
                {isSavingMemory ? <FiLoader className="spinning-icon" /> : <FiPlus />}
                <span>Add</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '150px', overflowY: 'auto' }}>
              {memories.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.82rem'
                  }}
                >
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '10px' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{m.key_name}:</strong>{' '}
                    <span style={{ color: 'var(--text-secondary)' }}>{m.value_text}</span>
                  </div>
                  <button
                    type="button"
                    style={{
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      border: 'none',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: 'var(--radius-xs)'
                    }}
                    onClick={() => handleDeleteMemory(m.id)}
                    title="Delete memory"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              ))}
              {memories.length === 0 && !loadingMemories && (
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No persistent memories saved yet.
                </span>
              )}
              {loadingMemories && (
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Loading memories...
                </span>
              )}
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
                  v2.0 Universal
                </span>
              </div>
              <div>
                Full-stack intelligent developer workspace with high-speed streaming inference, MySQL memory persistence, file attachments, and multi-model Ollama support.
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
