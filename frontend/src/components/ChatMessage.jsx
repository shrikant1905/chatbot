import React, { useState } from 'react';
import {
  FiUser,
  FiZap,
  FiCopy,
  FiCheck,
  FiRefreshCw,
  FiRotateCcw,
  FiInfo,
  FiThumbsUp,
  FiThumbsDown,
  FiFileText,
  FiAlertCircle
} from 'react-icons/fi';
import { MarkdownRenderer } from './MarkdownRenderer';
import { apiClient } from '../api/client';

export function ChatMessage({ message, onRetry, onRegenerate, onShowToast }) {
  const isAssistant = message.role === 'assistant';
  const isSystemNotice = message.role === 'system';
  const isFailed = message.status === 'failed';
  const isCancelled = message.status === 'cancelled';

  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState(null); // 'like' | 'dislike'

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

  const handleFeedback = async (rating) => {
    try {
      setFeedback(rating);
      await apiClient.submitFeedback(message.id, rating);
      onShowToast?.(`Feedback recorded: ${rating === 'like' ? 'Helpful' : 'Unhelpful'}`);
    } catch (err) {
      console.warn('Feedback submission error:', err);
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
          {isAssistant && <span className="message-badge">{message.model || 'AI Assistant'}</span>}
          {message.created_at && (
            <span>
              {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        <div className="message-bubble">
          {isFailed ? (
            <div className="error-banner-box">
              <FiAlertCircle fontSize={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>AI Generation Notice:</strong>
                <div>{message.content}</div>
              </div>
            </div>
          ) : isAssistant ? (
            <>
              <MarkdownRenderer content={message.content} />
              {message.isStreaming && <span className="typing-cursor" />}
            </>
          ) : (
            <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
          )}

          {/* Render Media Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="message-attachments-container">
              {message.attachments.map((att) => {
                const fileUrl = att.url || `/api/attachments/${att.id}/file`;
                const isImage = att.mime_type?.startsWith('image/');
                const isAudio = att.mime_type?.startsWith('audio/');
                const isVideo = att.mime_type?.startsWith('video/');

                if (isImage) {
                  return (
                    <img
                      key={att.id}
                      src={fileUrl}
                      alt={att.original_name}
                      className="attachment-media-image"
                      onClick={() => window.open(fileUrl, '_blank')}
                      title="Click to view full image"
                    />
                  );
                }

                if (isAudio) {
                  return (
                    <audio key={att.id} controls className="attachment-media-audio" src={fileUrl}>
                      Your browser does not support audio playback.
                    </audio>
                  );
                }

                if (isVideo) {
                  return (
                    <video key={att.id} controls className="attachment-media-video" src={fileUrl}>
                      Your browser does not support video playback.
                    </video>
                  );
                }

                return (
                  <a
                    key={att.id}
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="attachment-doc-pill"
                    download={att.original_name}
                  >
                    <FiFileText />
                    <span>{att.original_name}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      ({Math.round((att.file_size || 0) / 1024)} KB)
                    </span>
                  </a>
                );
              })}
            </div>
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

          {isAssistant && (
            <>
              {onRegenerate && (
                <button
                  className="message-action-pill"
                  onClick={() => onRegenerate(message.id)}
                  title="Regenerate response"
                  aria-label="Regenerate response"
                >
                  <FiRefreshCw />
                  <span>Regenerate</span>
                </button>
              )}

              <button
                className={`message-action-pill ${feedback === 'like' ? 'active' : ''}`}
                onClick={() => handleFeedback('like')}
                title="Good response"
                aria-label="Thumbs up feedback"
              >
                <FiThumbsUp />
              </button>

              <button
                className={`message-action-pill ${feedback === 'dislike' ? 'active' : ''}`}
                onClick={() => handleFeedback('dislike')}
                title="Bad response"
                aria-label="Thumbs down feedback"
              >
                <FiThumbsDown />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
