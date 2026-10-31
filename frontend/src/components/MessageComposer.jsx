import React, { useRef, useEffect, useState } from 'react';
import {
  FiSend,
  FiPaperclip,
  FiMic,
  FiGlobe,
  FiX,
  FiSquare,
  FiFile,
  FiCheck
} from 'react-icons/fi';

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

  // Speech-to-Text (Voice Typing) References
  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const baseInputRef = useRef('');
  const accumulatedFinalRef = useRef('');

  const [attachedFiles, setAttachedFiles] = useState([]);
  const [webSearchActive, setWebSearchActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState('en-IN'); // Default to English (India) / Hinglish

  // Check if Web Speech API is supported
  const isSpeechSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // Auto-resize textarea to fit content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  // Clean up recognition instance on unmount
  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

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

  /**
   * Stop voice speech recognition
   */
  const handleStopListening = () => {
    isListeningRef.current = false;
    setIsListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    textareaRef.current?.focus();
  };

  /**
   * Switch recognition language (en-IN, hi-IN, en-US)
   */
  const handleSwitchVoiceLang = (newLang) => {
    setVoiceLang(newLang);

    // If currently listening, update and restart instance with the new language
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.lang = newLang;
        recognitionRef.current.stop();
        // onend will automatically restart with new lang if isListeningRef is true
      } catch {}
    }
  };

  /**
   * Toggle Speech-to-Text Voice Typing
   */
  const handleToggleVoiceInput = async () => {
    if (isListening) {
      handleStopListening();
      return;
    }

    if (!isSpeechSupported) {
      onShowToast?.(
        'Speech recognition is supported in Google Chrome, Microsoft Edge, and Safari.',
        'error'
      );
      return;
    }

    // Pre-flight check: trigger browser's native microphone permission prompt if not yet allowed
    if (navigator?.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Immediately release tracks so SpeechRecognition has hardware access
        stream.getTracks().forEach((track) => track.stop());
      } catch (micErr) {
        console.warn('Microphone permission check:', micErr);
        if (micErr.name === 'NotAllowedError' || micErr.name === 'PermissionDeniedError') {
          onShowToast?.(
            'Microphone access blocked. Click the lock/settings icon in the browser URL bar and change Microphone to "Allow".',
            'error'
          );
          return;
        }
      }
    }

    try {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = voiceLang;
      recognition.maxAlternatives = 1;

      // Preserve existing text in composer
      baseInputRef.current = input ? input.trim() : '';
      accumulatedFinalRef.current = '';
      isListeningRef.current = true;
      setIsListening(true);

      recognition.onstart = () => {
        setIsListening(true);
        isListeningRef.current = true;
        // Do NOT call toast here to avoid loop on Chrome speech pauses/restarts
      };

      recognition.onresult = (event) => {
        let currentFinal = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            currentFinal += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (currentFinal) {
          accumulatedFinalRef.current +=
            (accumulatedFinalRef.current ? ' ' : '') + currentFinal.trim();
        }

        const base = baseInputRef.current;
        const spokenFinal = accumulatedFinalRef.current.trim();
        const spokenInterim = interimTranscript.trim();

        const combinedSpoken = [spokenFinal, spokenInterim]
          .filter(Boolean)
          .join(' ');
        const fullResult = base
          ? `${base} ${combinedSpoken}`
          : combinedSpoken;

        setInput(fullResult);
      };

      recognition.onerror = (event) => {
        console.warn('SpeechRecognition error:', event.error);
        if (event.error === 'not-allowed') {
          isListeningRef.current = false;
          setIsListening(false);

          const isHttpInsecure =
            window.location.protocol === 'http:' &&
            window.location.hostname !== 'localhost' &&
            window.location.hostname !== '127.0.0.1';

          if (isHttpInsecure) {
            onShowToast?.(
              'Chrome blocks microphone on HTTP IP addresses. Please use localhost or enable insecure origin in chrome://flags.',
              'error'
            );
          } else {
            onShowToast?.(
              'Microphone access blocked. Click the lock/tune icon next to the URL in the address bar and Allow microphone.',
              'error'
            );
          }
        } else if (event.error === 'network') {
          isListeningRef.current = false;
          setIsListening(false);
          onShowToast?.(
            'Speech recognition network error. Please check your internet connection.',
            'error'
          );
        }
      };

      recognition.onend = () => {
        // Auto-restart if user has not explicitly clicked Stop (handles browser pause/silence)
        if (isListeningRef.current) {
          try {
            recognition.start();
          } catch {
            setIsListening(false);
            isListeningRef.current = false;
          }
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start voice typing:', err);
      setIsListening(false);
      isListeningRef.current = false;
      onShowToast?.(`Could not start microphone: ${err.message}`, 'error');
    }
  };

  const handleSubmit = () => {
    if (isGenerating) {
      onStopGeneration?.();
      return;
    }

    // Stop voice listening on send
    if (isListening) {
      handleStopListening();
    }

    if (!input.trim() && attachedFiles.length === 0) return;

    const messageText = input.trim();
    const filesToSend = [...attachedFiles];

    onSend(messageText, filesToSend, webSearchActive);

    setInput('');
    setAttachedFiles([]);
    baseInputRef.current = '';
    accumulatedFinalRef.current = '';
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

        {/* Real-time Voice Typing (Speech-to-Text) Active Bar */}
        {isListening && (
          <div className="composer-speech-active-bar">
            <div className="speech-wave-animation">
              <span className="wave-bar bar-1"></span>
              <span className="wave-bar bar-2"></span>
              <span className="wave-bar bar-3"></span>
              <span className="wave-bar bar-4"></span>
              <span className="wave-bar bar-5"></span>
            </div>
            <span className="speech-status-text">
              Listening... Speak now (Bolna shuru karein)
            </span>
            <div className="speech-lang-pill">
              <button
                type="button"
                className={`speech-lang-btn ${voiceLang === 'en-IN' ? 'active' : ''}`}
                onClick={() => handleSwitchVoiceLang('en-IN')}
                title="English (India) / Hinglish"
              >
                EN (India)
              </button>
              <button
                type="button"
                className={`speech-lang-btn ${voiceLang === 'hi-IN' ? 'active' : ''}`}
                onClick={() => handleSwitchVoiceLang('hi-IN')}
                title="हिन्दी (Hindi)"
              >
                हिन्दी
              </button>
              <button
                type="button"
                className={`speech-lang-btn ${voiceLang === 'en-US' ? 'active' : ''}`}
                onClick={() => handleSwitchVoiceLang('en-US')}
                title="English (US)"
              >
                EN (US)
              </button>
            </div>
            <button
              type="button"
              className="speech-done-btn"
              onClick={handleStopListening}
              title="Done speaking"
            >
              <FiCheck /> Done
            </button>
          </div>
        )}

        <textarea
          ref={textareaRef}
          className="composer-textarea"
          placeholder={
            isGenerating
              ? 'Kiaan AI is responding...'
              : isListening
              ? 'Listening... Speak now, your words will appear here...'
              : 'Message Kiaan AI... (Shift + Enter for new line)'
          }
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
              className={`composer-icon-btn ${isListening ? 'speech-active' : ''}`}
              onClick={handleToggleVoiceInput}
              aria-label={
                isListening
                  ? 'Stop voice typing'
                  : 'Start voice typing (Speak to type)'
              }
              title={
                isListening
                  ? 'Stop voice typing (Listening...)'
                  : 'Voice typing (Bol ke type karein)'
              }
            >
              <FiMic />
              {isListening && <span className="mic-pulse-ring" />}
            </button>
            <button
              type="button"
              className={`composer-icon-btn ${webSearchActive ? 'active' : ''}`}
              onClick={() => {
                setWebSearchActive(!webSearchActive);
                onShowToast?.(
                  `Web search context mode ${!webSearchActive ? 'enabled' : 'disabled'}`
                );
              }}
              aria-label="Toggle web search context mode"
              title={
                webSearchActive
                  ? 'Web search context enabled'
                  : 'Toggle web search'
              }
            >
              <FiGlobe
                style={webSearchActive ? { color: 'var(--brand-primary)' } : {}}
              />
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
                title={
                  input.trim() || attachedFiles.length > 0
                    ? 'Send message (Enter)'
                    : 'Type a message to send'
                }
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
