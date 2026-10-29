import React, { useEffect, useState } from 'react';
import { FiX, FiSliders, FiSun, FiMoon, FiMonitor, FiCheck, FiTrash2, FiPlus, FiDatabase } from 'react-icons/fi';
import { apiClient } from '../api/client';

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

  // Conversational Memory State
  const [memories, setMemories] = useState([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [loadingMemories, setLoadingMemories] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Load memories on open
  useEffect(() => {
    if (isOpen) {
      setLoadingMemories(true);
      apiClient.getMemories()
        .then((res) => setMemories(res.memories || []))
        .catch(() => {})
        .finally(() => setLoadingMemories(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddMemory = async () => {
    if (!newKey.trim() || !newValue.trim()) {
      onShowToast?.('Both memory key and value are required.');
      return;
    }
    try {
      const res = await apiClient.saveMemory(newKey.trim(), newValue.trim());
      setMemories((prev) => [...prev.filter((m) => m.key_name !== res.memory.key_name), res.memory]);
      setNewKey('');
      setNewValue('');
      onShowToast?.('Memory saved to conversational context.');
    } catch (err) {
      onShowToast?.(err.message);
    }
  };

  const handleDeleteMemory = async (id) => {
    try {
      await apiClient.deleteMemory(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
      onShowToast?.('Memory removed.');
    } catch (err) {
      onShowToast?.(err.message);
    }
  };

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
                  Play subtle auditory chime upon local interaction
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

          {/* Section: Conversational Memory */}
          <div className="settings-section">
            <div className="settings-section-title">
              <FiDatabase style={{ marginRight: '6px' }} />
              Conversational Memory
            </div>

            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
              Saved preferences that Kiaan AI remembers across conversations. Sensitive credentials (passwords, tokens, API keys) are strictly rejected.
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input
                type="text"
                placeholder="Key (e.g. style)"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem'
                }}
              />
              <input
                type="text"
                placeholder="Value (e.g. concise, modern JS)"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                style={{
                  flex: 2,
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem'
                }}
              />
              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                onClick={handleAddMemory}
              >
                <FiPlus />
                <span>Add</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto' }}>
              {memories.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.8rem'
                  }}
                >
                  <div>
                    <strong style={{ color: 'var(--text-primary)' }}>{m.key_name}:</strong>{' '}
                    <span style={{ color: 'var(--text-secondary)' }}>{m.value_text}</span>
                  </div>
                  <button
                    type="button"
                    style={{ background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
                    onClick={() => handleDeleteMemory(m.id)}
                    title="Delete memory"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              ))}
              {memories.length === 0 && !loadingMemories && (
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No persistent memories saved yet.</span>
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
                  v1.0.0 Integrated
                </span>
              </div>
              <div>
                Full-stack intelligent developer workspace with Express API, MySQL persistence, real file attachments, and Ollama AI provider abstraction.
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
