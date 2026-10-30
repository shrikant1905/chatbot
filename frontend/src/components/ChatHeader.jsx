import React, { useState, useRef, useEffect } from 'react';
import {
  FiMenu,
  FiChevronDown,
  FiMoreVertical,
  FiTrash2,
  FiDownload,
  FiSliders,
  FiInfo,
  FiCheck,
  FiPlus
} from 'react-icons/fi';
import { ThemeToggle } from './ThemeToggle';
import { apiClient } from '../api/client';

export function ChatHeader({
  activeConversation,
  activeTheme,
  onToggleTheme,
  onOpenMobileSidebar,
  onNewChat,
  onOpenSettings,
  onClearChat,
  onShowToast,
  selectedModel,
  onSelectModel
}) {
  const [models, setModels] = useState([
    { id: 'gemma3:4b', name: 'Gemma 3 (4B) 🌟 [Default]', description: 'Google Gemma 3 - Deep reasoning, rich formatting & high quality', tag: 'Default' },
    { id: 'qwen2.5:3b', name: 'Qwen 2.5 (3B) ⚡ [Fast]', description: 'Ultra-fast conversational model with instant replies', tag: 'Fast' },
    { id: 'qwen3:1.7b', name: 'Qwen 3 (1.7B) 💡 [Fast Reasoning]', description: 'Fast local reasoning model on VPS', tag: 'Smart' },
    { id: 'qwen3:4b', name: 'Qwen 3 (4B) 🧠 [Deep Reasoning]', description: 'Heavy 4B model (complex logic)', tag: 'Deep' },
    { id: 'qwen2.5vl:3b', name: 'Qwen 2.5-VL (3B) 👁️ [Vision & OCR]', description: 'Multimodal Vision-Language for Image Analysis & OCR', tag: 'Vision' },
    { id: 'kiaan-pro', name: 'Kiaan Pro 3.5', description: 'Optimized for high-speed conversational workflows', tag: 'Balanced' }
  ]);
  const [providerStatus, setProviderStatus] = useState({ available: false });
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);

  const modelRef = useRef(null);
  const optionsRef = useRef(null);

  // Fetch real model list from backend
  useEffect(() => {
    let isMounted = true;
    apiClient.getModels()
      .then((data) => {
        if (!isMounted) return;
        if (data.models && data.models.length > 0) {
          setModels(data.models);
          const matching = data.models.find((m) => m.id === selectedModel?.id);
          if (matching) {
            onSelectModel?.(matching);
          } else if (!selectedModel?.id || selectedModel.id.startsWith('kiaan-')) {
            onSelectModel?.(data.models[0]);
          }
        }
        setProviderStatus({
          provider: data.provider,
          available: data.available,
          error: data.error
        });
      })
      .catch((err) => {
        console.warn('Could not fetch backend models:', err.message);
      });
    return () => { isMounted = false; };
  }, []);

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

  // Real Export as Markdown file download
  const handleExport = (format) => {
    setIsOptionsMenuOpen(false);
    if (!activeConversation || !activeConversation.messages || activeConversation.messages.length === 0) {
      onShowToast?.('No messages to export in current conversation.');
      return;
    }

    const title = activeConversation.title || 'Conversation';
    let mdContent = `# ${title}\n\n*Exported from Kiaan AI Workspace — ${new Date().toLocaleString()}*\n\n---\n\n`;

    for (const msg of activeConversation.messages) {
      const author = msg.role === 'assistant' ? 'Kiaan AI' : 'User';
      const time = msg.created_at ? new Date(msg.created_at).toLocaleString() : '';
      mdContent += `### ${author} ${time ? `(${time})` : ''}\n\n${msg.content}\n\n---\n\n`;
    }

    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const sanitizedTitle = title.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').slice(0, 40);
    link.download = `${sanitizedTitle || 'kiaan-chat'}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    onShowToast?.(`Exported "${title}" as Markdown file.`);
  };

  // Real System Info from backend
  const handleSystemInfo = async () => {
    setIsOptionsMenuOpen(false);
    try {
      const health = await apiClient.getHealth();
      const dbStatus = health.database?.connected ? 'MySQL Connected' : 'MySQL Error';
      const aiStatus = health.aiProvider?.available ? `AI Provider (${health.aiProvider.configuredProvider}) Online` : `AI Provider (${health.aiProvider?.configuredProvider || 'None'}) Offline`;
      onShowToast?.(`Kiaan AI: ${dbStatus} • ${aiStatus} (Uptime: ${health.system?.uptimeSeconds}s)`);
    } catch (err) {
      onShowToast?.(`Kiaan AI Backend: ${err.message}`);
    }
  };

  const currentModel = selectedModel || models[0];

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
            <span>{activeConversation?.title || 'New Conversation'}</span>
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
            <span
              className="model-status-dot"
              style={{
                background: providerStatus.available ? '#10b981' : '#f59e0b'
              }}
              title={providerStatus.available ? 'AI Provider Connected' : 'AI Provider Offline (VPS/Local Ollama not running)'}
            />
            <span>{currentModel.name}</span>
            <FiChevronDown fontSize={12} />
          </button>

          {isModelDropdownOpen && (
            <div className="dropdown-popover" style={{ left: 0, right: 'auto', minWidth: '320px' }}>
              <div style={{ padding: '8px 12px', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                Select Model ({providerStatus.available ? 'Online' : 'Offline Mode'})
              </div>
              {models.map((m) => (
                <div
                  key={m.id}
                  className="dropdown-item"
                  onClick={() => {
                    onSelectModel?.(m);
                    setIsModelDropdownOpen(false);
                    onShowToast?.(`Switched active model to ${m.name}`);
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.84rem' }}>
                      {m.name}
                    </div>
                    {m.description && (
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.35 }}>
                        {m.description}
                      </div>
                    )}
                  </div>
                  {currentModel.id === m.id && (
                    <FiCheck style={{ color: 'var(--brand-primary)', fontSize: '15px', marginLeft: '8px' }} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="chat-header-right">
        {/* Theme Toggle Button */}
        <button
          className="header-icon-btn mobile-new-chat-btn"
          onClick={onNewChat}
          aria-label="New chat"
          title="Start new conversation"
        >
          <FiPlus fontSize={18} />
        </button>
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
                onClick={handleSystemInfo}
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
