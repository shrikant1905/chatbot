import React, { useState, useRef, useEffect } from 'react';
import {
  FiMenu,
  FiChevronDown,
  FiMoreVertical,
  FiTrash2,
  FiDownload,
  FiSliders,
  FiInfo,
  FiCheck
} from 'react-icons/fi';
import { ThemeToggle } from './ThemeToggle';
import { AVAILABLE_MODELS } from '../utils/sampleData';

export function ChatHeader({
  conversationTitle,
  activeTheme,
  onToggleTheme,
  onOpenMobileSidebar,
  onOpenSettings,
  onClearChat,
  onShowToast
}) {
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0]);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);

  const modelRef = useRef(null);
  const optionsRef = useRef(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modelRef.current && !modelRef.current.contains(e.target)) {
        setIsModelDropdownOpen(false);
      }
      if (optionsRef.current && !optionsRef.current.contains(e.target)) {
        setIsOptionsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExport = (format) => {
    setIsOptionsMenuOpen(false);
    if (onShowToast) {
      onShowToast(`Exported conversation as ${format.toUpperCase()} (UI Demo).`);
    }
  };

  return (
    <header className="chat-header">
      <div className="chat-header-left">
        <button
          className="mobile-menu-btn"
          onClick={onOpenMobileSidebar}
          aria-label="Open sidebar menu"
        >
          <FiMenu fontSize={18} />
        </button>

        <div className="chat-header-title-box">
          <div className="chat-title-heading">
            <span>{conversationTitle || 'New Conversation'}</span>
          </div>
        </div>

        {/* Model Selector Pill */}
        <div className="dropdown-menu-wrapper" ref={modelRef}>
          <button
            className="model-selector-pill"
            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
            aria-label="Select AI model"
            aria-expanded={isModelDropdownOpen}
          >
            <span className="model-status-dot"></span>
            <span>{selectedModel.name}</span>
            <FiChevronDown fontSize={12} />
          </button>

          {isModelDropdownOpen && (
            <div className="dropdown-popover" style={{ left: 0, right: 'auto', minWidth: '260px' }}>
              <div style={{ padding: '6px 10px', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                Select AI Model (UI Preview)
              </div>
              {AVAILABLE_MODELS.map((model) => (
                <div
                  key={model.id}
                  className="dropdown-item"
                  onClick={() => {
                    setSelectedModel(model);
                    setIsModelDropdownOpen(false);
                    onShowToast && onShowToast(`Switched active model view to ${model.name}`);
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.84rem' }}>
                      {model.name}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      {model.description}
                    </div>
                  </div>
                  {selectedModel.id === model.id && (
                    <FiCheck style={{ color: 'var(--brand-primary)', fontSize: '15px' }} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="chat-header-right">
        {/* Theme Toggle Button */}
        <ThemeToggle
          activeTheme={activeTheme}
          onToggle={onToggleTheme}
        />

        {/* Options Dropdown Menu */}
        <div className="dropdown-menu-wrapper" ref={optionsRef}>
          <button
            className="header-icon-btn"
            onClick={() => setIsOptionsMenuOpen(!isOptionsMenuOpen)}
            aria-label="More conversation options"
            aria-expanded={isOptionsMenuOpen}
            title="Conversation Options"
          >
            <FiMoreVertical fontSize={16} />
          </button>

          {isOptionsMenuOpen && (
            <div className="dropdown-popover">
              <button
                className="dropdown-item"
                onClick={() => {
                  setIsOptionsMenuOpen(false);
                  onOpenSettings();
                }}
              >
                <FiSliders />
                <span>Settings</span>
              </button>
              <button
                className="dropdown-item"
                onClick={() => handleExport('markdown')}
              >
                <FiDownload />
                <span>Export as Markdown</span>
              </button>
              <button
                className="dropdown-item"
                onClick={() => {
                  setIsOptionsMenuOpen(false);
                  onShowToast && onShowToast('Kiaan AI v1.0.0 (Frontend Only Architecture)');
                }}
              >
                <FiInfo />
                <span>System Info</span>
              </button>
              <div className="dropdown-divider" />
              <button
                className="dropdown-item danger"
                onClick={() => {
                  setIsOptionsMenuOpen(false);
                  onClearChat();
                }}
              >
                <FiTrash2 />
                <span>Clear Messages</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
