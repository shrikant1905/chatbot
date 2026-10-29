import React, { useState } from 'react';
import { FiUser, FiZap, FiCopy, FiCheck, FiRefreshCw, FiRotateCcw, FiInfo } from 'react-icons/fi';
import { MarkdownRenderer } from './MarkdownRenderer';

export function ChatMessage({ message, onRetry, onRegenerate }) {
  const isAssistant = message.role === 'assistant';
  const isSystemNotice = message.role === 'system';
  const [copied, setCopied] = useState(false);

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement('textarea');
      el.value = message.content;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isSystemNotice) {
    return (
      <div className="demo-banner-box">
        <FiInfo className="demo-banner-icon" />
        <div>{message.content}</div>
      </div>
    );
  }

  return (
    <div className={`message-row ${isAssistant ? 'assistant' : 'user'}`}>
      <div className={`message-avatar ${isAssistant ? 'assistant' : 'user'}`}>
        {isAssistant ? <FiZap /> : <FiUser />}
      </div>

      <div className="message-body-wrapper">
        <div className="message-meta">
          <span className="message-author-name">
            {isAssistant ? 'Kiaan AI' : 'You'}
          </span>
          {isAssistant && <span className="message-badge">AI Assistant</span>}
          {message.timestamp && <span>{message.timestamp}</span>}
        </div>

        <div className="message-bubble">
          {isAssistant ? (
            <MarkdownRenderer content={message.content} />
          ) : (
            <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
          )}
        </div>

        {/* Message Actions */}
        <div className="message-actions-toolbar">
          <button
            className="message-action-pill"
            onClick={handleCopyMessage}
            title="Copy message text"
            aria-label="Copy message text"
          >
            {copied ? (
              <>
                <FiCheck style={{ color: '#10b981' }} />
                <span style={{ color: '#10b981' }}>Copied</span>
              </>
            ) : (
              <>
                <FiCopy />
                <span>Copy</span>
              </>
            )}
          </button>

          {!isAssistant && onRetry && (
            <button
              className="message-action-pill"
              onClick={() => onRetry(message.content)}
              title="Edit in composer"
              aria-label="Edit in composer"
            >
              <FiRotateCcw />
              <span>Edit</span>
            </button>
          )}

          {isAssistant && onRegenerate && (
            <button
              className="message-action-pill"
              onClick={() => onRegenerate(message.id)}
              title="Demonstration regenerate action"
              aria-label="Regenerate UI demo"
            >
              <FiRefreshCw />
              <span>Regenerate (UI Demo)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
