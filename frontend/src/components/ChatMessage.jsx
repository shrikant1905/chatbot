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
  FiAlertCircle,
  FiVolume2,
  FiVolumeX
} from 'react-icons/fi';
import { MarkdownRenderer } from './MarkdownRenderer';
import { apiClient } from '../api/client';

export function formatMessageTime(timestamp) {
  if (!timestamp) return '';
  try {
    let str = String(timestamp).trim();
    // Fix timezone: If raw SQL string without timezone indicator, treat as UTC
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(str) && !str.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(str)) {
      str = str.replace(' ', 'T') + 'Z';
    }
    const d = new Date(str);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return '';
  }
}

export function ChatMessage({
  message,
  onRetry,
  onRegenerate,
  onShowToast,
  showTimestamps = true,
  codeLineNumbers = false
}) {
  const isAssistant = message.role === 'assistant';
  const isSystemNotice = message.role === 'system';
  const isFailed = message.status === 'failed';
  const isCancelled = message.status === 'cancelled';

  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState(null); // 'like' | 'dislike'
  const [isSpeaking, setIsSpeaking] = useState(false);

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

  /**
   * Text-to-Speech (Audio Read Aloud) for assistant messages
   */
  const handleToggleSpeak = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      onShowToast?.('Audio speech playback is not supported in this browser.', 'error');
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      onShowToast?.('Voice playback stopped.');
      return;
    }

    window.speechSynthesis.cancel();

    // Clean markdown before speaking
    const textToSpeak = (message.content || '')
      .replace(/```[\s\S]*?```/g, 'Code block omitted.')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[#*_~>]/g, '')
      .replace(/:::[\s\S]*?:::/g, '')
      .replace(/\n+/g, ' ')
      .trim();

    if (!textToSpeak) return;

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      (v) =>
        v.lang.startsWith('en-IN') ||
        v.lang.startsWith('hi-IN') ||
        v.lang.startsWith('en-US') ||
        v.lang.startsWith('en')
    );
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
    onShowToast?.('Reading response aloud...');
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
        {isAssistant ? (
          <img
            src="/assets/kiaan-orb-3d.png"
            alt="Kiaan AI"
            className="assistant-avatar-orb"
          />
        ) : (
          <FiUser />
        )}
      </div>

      <div className="message-body-wrapper">
        <div className="message-meta">
          <span className="message-author-name">
            {isAssistant ? 'Kiaan AI' : 'You'}
          </span>
          {isAssistant && <span className="message-badge">{message.model || 'AI Assistant'}</span>}
          {showTimestamps && message.created_at && (
            <span>
              {formatMessageTime(message.created_at)}
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
              {message.isStreaming && !message.content && (
                <div className="streaming-thinking-indicator">
                  <div className="thinking-dots">
                    <span className="dot"></span>
                    <span className="dot"></span>
                    <span className="dot"></span>
                  </div>
                  <span className="thinking-label">Thinking...</span>
                </div>
              )}
              <MarkdownRenderer content={message.content} showLineNumbers={codeLineNumbers} />
              {message.isStreaming && Boolean(message.content) && <span className="typing-cursor" />}
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
              {/* Speaker / Read Aloud audio playback */}
              <button
                className={`message-action-pill ${isSpeaking ? 'active' : ''}`}
                onClick={handleToggleSpeak}
                title={isSpeaking ? 'Stop reading aloud' : 'Read response aloud (Voice)'}
                aria-label={isSpeaking ? 'Stop reading aloud' : 'Read response aloud'}
              >
                {isSpeaking ? (
                  <>
                    <FiVolumeX style={{ color: '#ef4444' }} />
                    <span style={{ color: '#ef4444' }}>Stop</span>
                  </>
                ) : (
                  <>
                    <FiVolume2 />
                    <span>Listen</span>
                  </>
                )}
              </button>

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
