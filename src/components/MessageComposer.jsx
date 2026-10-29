import React, { useRef, useEffect } from 'react';
import { FiSend, FiPaperclip, FiMic, FiGlobe } from 'react-icons/fi';

export function MessageComposer({
  input,
  setInput,
  onSend,
  onShowToast
}) {
  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (!input.trim()) return;
    onSend(input.trim());
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }
  };

  const handlePlaceholderAction = (actionName) => {
    if (onShowToast) {
      onShowToast(`${actionName} is a placeholder and will be enabled in the backend integration phase.`);
    }
  };

  return (
    <div className="composer-dock">
      <div className="composer-inner-card">
        <textarea
          ref={textareaRef}
          className="composer-textarea"
          placeholder="Message Kiaan AI... (Shift + Enter for new line)"
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Message Kiaan AI composer"
        />

        <div className="composer-controls-row">
          <div className="composer-aux-buttons">
            <button
              type="button"
              className="composer-icon-btn"
              onClick={() => handlePlaceholderAction('File upload')}
              aria-label="Attach file (UI preview placeholder)"
              title="Attach files (Frontend placeholder)"
            >
              <FiPaperclip />
            </button>
            <button
              type="button"
              className="composer-icon-btn"
              onClick={() => handlePlaceholderAction('Voice input')}
              aria-label="Voice input (UI preview placeholder)"
              title="Voice input (Frontend placeholder)"
            >
              <FiMic />
            </button>
            <button
              type="button"
              className="composer-icon-btn"
              onClick={() => handlePlaceholderAction('Web search')}
              aria-label="Web search toggle (UI preview placeholder)"
              title="Web search (Frontend placeholder)"
            >
              <FiGlobe />
            </button>
          </div>

          <div className="composer-primary-actions">
            {input.length > 0 && (
              <span className="composer-char-count">{input.length} chars</span>
            )}
            <button
              type="button"
              className="send-message-btn"
              onClick={handleSubmit}
              disabled={!input.trim()}
              aria-label="Send message"
              title={input.trim() ? "Send message (Enter)" : "Type a message to send"}
            >
              <FiSend />
            </button>
          </div>
        </div>
      </div>

      <div className="composer-disclaimer">
        <span>Enter to send, Shift + Enter for new line</span>
        <span>•</span>
        <span>Kiaan AI Frontend Preview — Responses are demonstration-only</span>
      </div>
    </div>
  );
}
