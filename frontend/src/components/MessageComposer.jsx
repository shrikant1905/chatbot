import React, { useRef, useEffect, useState } from 'react';
import { FiSend, FiPaperclip, FiMic, FiGlobe, FiX, FiSquare, FiFile, FiCheck } from 'react-icons/fi';

export function MessageComposer({
  input,
  setInput,
  onSend,
  onShowToast,
  isGenerating = false,
  onStopGeneration
}) {
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const [attachedFiles, setAttachedFiles] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [webSearchActive, setWebSearchActive] = useState(false);

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

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Check size (25MB limit per file)
    const oversized = files.find((f) => f.size > 25 * 1024 * 1024);
    if (oversized) {
      onShowToast?.(`File "${oversized.name}" exceeds 25MB limit.`);
      return;
    }

    setAttachedFiles((prev) => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onShowToast?.(`Attached ${files.length} file(s).`);
  };

  const handleRemoveFile = (index) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Real voice recording using browser MediaRecorder
  const handleToggleVoiceRecording = async () => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      onShowToast?.('Voice recording is not supported in this browser environment.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], `voice-note-${Date.now()}.webm`, {
          type: 'audio/webm'
        });
        setAttachedFiles((prev) => [...prev, audioFile]);
        onShowToast?.('Voice recording attached.');
      };

      recorder.start();
      setIsRecording(true);
      onShowToast?.('Recording audio... Click mic again to stop.');
    } catch (err) {
      console.error('Microphone access denied:', err);
      onShowToast?.('Could not access microphone: ' + err.message);
      setIsRecording(false);
    }
  };

  const handleSubmit = () => {
    if (isGenerating) {
      onStopGeneration?.();
      return;
    }

    if (!input.trim() && attachedFiles.length === 0) return;

    const messageText = input.trim();
    const filesToSend = [...attachedFiles];

    onSend(messageText, filesToSend);

    setInput('');
    setAttachedFiles([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }
  };

  return (
    <div className="composer-dock">
      <div className="composer-inner-card">
        {/* Hidden File Input for paperclip */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,audio/*,.pdf,.txt,.md,.json,.csv"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />

        {/* Attached Files Preview Bar */}
        {attachedFiles.length > 0 && (
          <div className="composer-attachments-bar">
            {attachedFiles.map((file, idx) => (
              <div key={`${file.name}-${idx}`} className="attachment-chip">
                <FiFile style={{ fontSize: '12px', flexShrink: 0 }} />
                <span className="attachment-chip-name">{file.name}</span>
                <button
                  type="button"
                  className="attachment-chip-remove"
                  onClick={() => handleRemoveFile(idx)}
                  aria-label={`Remove ${file.name}`}
                >
                  <FiX />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Recording active banner */}
        {isRecording && (
          <div style={{ padding: '6px 14px 0' }}>
            <span className="composer-recording-pill">
              <span className="model-status-dot" style={{ background: '#ef4444' }} />
              Recording voice note...
            </span>
          </div>
        )}

        <textarea
          ref={textareaRef}
          className="composer-textarea"
          placeholder={isGenerating ? "Kiaan AI is responding..." : "Message Kiaan AI... (Shift + Enter for new line)"}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isGenerating}
          aria-label="Message Kiaan AI composer"
        />

        <div className="composer-controls-row">
          <div className="composer-aux-buttons">
            <button
              type="button"
              className="composer-icon-btn"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach file"
              title="Attach files (Images, Audio, Video, PDF, Docs)"
            >
              <FiPaperclip />
            </button>
            <button
              type="button"
              className={`composer-icon-btn ${isRecording ? 'active' : ''}`}
              onClick={handleToggleVoiceRecording}
              aria-label={isRecording ? "Stop voice recording" : "Start voice recording"}
              title={isRecording ? "Stop recording" : "Voice input (Microphone)"}
            >
              <FiMic style={isRecording ? { color: '#ef4444' } : {}} />
            </button>
            <button
              type="button"
              className={`composer-icon-btn ${webSearchActive ? 'active' : ''}`}
              onClick={() => {
                setWebSearchActive(!webSearchActive);
                onShowToast?.(`Web search context mode ${!webSearchActive ? 'enabled' : 'disabled'}`);
              }}
              aria-label="Toggle web search context mode"
              title={webSearchActive ? "Web search context enabled" : "Toggle web search"}
            >
              <FiGlobe style={webSearchActive ? { color: 'var(--brand-primary)' } : {}} />
            </button>
          </div>

          <div className="composer-primary-actions">
            {input.length > 0 && (
              <span className="composer-char-count">{input.length} chars</span>
            )}
            {isGenerating ? (
              <button
                type="button"
                className="stop-message-btn"
                onClick={onStopGeneration}
                aria-label="Stop generation"
                title="Stop generation"
              >
                <FiSquare />
              </button>
            ) : (
              <button
                type="button"
                className="send-message-btn"
                onClick={handleSubmit}
                disabled={!input.trim() && attachedFiles.length === 0}
                aria-label="Send message"
                title={input.trim() || attachedFiles.length > 0 ? "Send message (Enter)" : "Type a message to send"}
              >
                <FiSend />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="composer-disclaimer">
        <span>Enter to send, Shift + Enter for new line</span>
        <span>•</span>
        <span>Kiaan AI Intelligent Workspace</span>
      </div>
    </div>
  );
}
