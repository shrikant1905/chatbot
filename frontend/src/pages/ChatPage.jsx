import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sidebar } from '../components/Sidebar';
import { ChatHeader } from '../components/ChatHeader';
import { WelcomeScreen } from '../components/WelcomeScreen';
import { ChatMessage } from '../components/ChatMessage';
import { MessageComposer } from '../components/MessageComposer';
import { SettingsModal } from '../components/SettingsModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import { apiClient } from '../api/client';

export function ChatPage({ activeTheme, themeMode, setThemeMode, onToggleTheme }) {
  // Real Conversations State
  const [conversations, setConversations] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [activeConversation, setActiveConversation] = useState({
    id: null,
    title: 'New Conversation',
    messages: []
  });
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);

  // Model Selection
  const [selectedModel, setSelectedModel] = useState({
    id: 'qwen3:1.7b',
    name: 'Qwen 3 (1.7B)'
  });

  // Composer & Generation State
  const [composerInput, setComposerInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const abortControllerRef = useRef(null);

  // UI Drawer & Collapse States
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Modals & Popups State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [deleteTargetChat, setDeleteTargetChat] = useState(null);
  const [isClearChatConfirmOpen, setIsClearChatConfirmOpen] = useState(false);

  // Toast System
  const [toasts, setToasts] = useState([]);
  const messagesEndRef = useRef(null);

  const showToast = (message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  // 1. Fetch conversations list from backend on mount
  const refreshConversations = useCallback(async (selectId = null) => {
    try {
      const data = await apiClient.getConversations();
      const list = data.conversations || [];
      setConversations(list);

      if (selectId) {
        loadConversation(selectId);
      } else if (!activeChatId && list.length > 0) {
        loadConversation(list[0].id);
      } else if (list.length === 0) {
        handleNewChat();
      }
    } catch (err) {
      console.warn('Could not load conversations from backend:', err.message);
    }
  }, [activeChatId]);

  useEffect(() => {
    refreshConversations();
  }, []);

  // 2. Load single conversation with messages
  const loadConversation = async (chatId) => {
    if (!chatId || chatId.startsWith('pending-')) {
      setActiveChatId(chatId);
      setActiveConversation({ id: chatId, title: 'New Conversation', messages: [] });
      return;
    }

    setIsLoadingConversation(true);
    try {
      const data = await apiClient.getConversation(chatId);
      if (data.conversation) {
        setActiveChatId(data.conversation.id);
        setActiveConversation(data.conversation);
      }
    } catch (err) {
      console.error('Failed to load conversation:', err);
      showToast('Failed to load conversation: ' + err.message, 'error');
    } finally {
      setIsLoadingConversation(false);
    }
  };

  // Auto-scroll to bottom on new messages or streaming chunks
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeConversation.messages]);

  // Keyboard shortcut Ctrl + K or Cmd + K for New Chat
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        handleNewChat();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle New Chat Creation
  const handleNewChat = () => {
    const newChatId = `pending-${Date.now()}`;
    setActiveChatId(newChatId);
    setActiveConversation({
      id: newChatId,
      title: 'New Conversation',
      messages: []
    });
    setComposerInput('');
    showToast('Started new conversation.');
  };

  // Handle Sending a Message (with real backend, attachments & SSE streaming)
  const handleSendMessage = async (text, files = []) => {
    if (isGenerating) return;

    let targetConvId = activeChatId;
    if (!targetConvId || targetConvId.startsWith('pending-')) {
      targetConvId = `conv-${Date.now()}`;
      setActiveChatId(targetConvId);
    }

    // Upload files if any
    let attachmentIds = [];
    if (files && files.length > 0) {
      try {
        showToast(`Uploading ${files.length} attachment(s)...`);
        const uploadRes = await apiClient.uploadFiles(targetConvId, files);
        attachmentIds = (uploadRes.attachments || []).map((a) => a.id);
      } catch (uploadErr) {
        showToast(`Attachment upload error: ${uploadErr.message}`, 'error');
        return;
      }
    }

    const optimisticUserMsg = {
      id: `temp-user-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
      attachments: files.map((f, i) => ({
        id: `temp-att-${i}`,
        original_name: f.name,
        mime_type: f.type,
        file_size: f.size
      }))
    };

    const streamingAssistantId = `temp-assist-${Date.now()}`;
    const initialAssistantMsg = {
      id: streamingAssistantId,
      role: 'assistant',
      content: '',
      isStreaming: true,
      created_at: new Date().toISOString(),
      model: selectedModel.name
    };

    setActiveConversation((prev) => ({
      ...prev,
      id: targetConvId,
      messages: [...prev.messages, optimisticUserMsg, initialAssistantMsg]
    }));

    setIsGenerating(true);
    abortControllerRef.current = new AbortController();

    try {
      let accumulated = '';

      const result = await apiClient.sendMessage({
        conversationId: targetConvId,
        content: text,
        model: selectedModel.id,
        stream: true,
        attachmentIds,
        signal: abortControllerRef.current.signal,
        onChunk: (delta) => {
          accumulated += delta;
          setActiveConversation((prev) => ({
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === streamingAssistantId
                ? { ...m, content: accumulated, isStreaming: true }
                : m
            )
          }));
        }
      });

      // Update assistant message with completed record
      setActiveConversation((prev) => ({
        ...prev,
        messages: prev.messages.map((m) =>
          m.id === streamingAssistantId
            ? {
                ...m,
                id: result.assistantMessage?.id || streamingAssistantId,
                content: result.assistantMessage?.content || accumulated,
                isStreaming: false,
                status: 'completed'
              }
            : m
        )
      }));

      // Refresh sidebar list to reflect any new titles
      await refreshConversations();
    } catch (err) {
      console.error('Send message failed:', err);

      const isAborted = abortControllerRef.current?.signal.aborted;
      const failureMessage = isAborted
        ? 'Generation was stopped by user.'
        : err.message || 'Generation failed. Verify AI provider is running.';

      setActiveConversation((prev) => ({
        ...prev,
        messages: prev.messages.map((m) =>
          m.id === streamingAssistantId
            ? {
                ...m,
                content: failureMessage,
                isStreaming: false,
                status: isAborted ? 'cancelled' : 'failed'
              }
            : m
        )
      }));

      showToast(failureMessage, 'error');
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  // Stop Generation Handler
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
      showToast('Generation stopped.');
    }
  };

  // Handle Selecting a Suggestion Card
  const handleSelectSuggestionPrompt = (promptText) => {
    setComposerInput(promptText);
  };

  // Handle Renaming a Conversation
  const handleRenameChat = async (chatId, newTitle) => {
    try {
      await apiClient.renameConversation(chatId, newTitle);
      setConversations((prev) =>
        prev.map((c) => (c.id === chatId ? { ...c, title: newTitle } : c))
      );
      if (activeChatId === chatId) {
        setActiveConversation((prev) => ({ ...prev, title: newTitle }));
      }
      showToast('Conversation renamed.');
    } catch (err) {
      showToast('Failed to rename: ' + err.message, 'error');
    }
  };

  // Handle Confirming Deletion of a Conversation
  const handleConfirmDelete = async () => {
    if (!deleteTargetChat) return;
    const targetId = deleteTargetChat.id;

    try {
      await apiClient.deleteConversation(targetId);
      const remaining = conversations.filter((c) => c.id !== targetId);
      setConversations(remaining);
      setDeleteTargetChat(null);
      showToast('Conversation deleted.');

      if (activeChatId === targetId) {
        if (remaining.length > 0) {
          loadConversation(remaining[0].id);
        } else {
          handleNewChat();
        }
      }
    } catch (err) {
      showToast('Failed to delete conversation: ' + err.message, 'error');
    }
  };

  // Handle Clearing Chat Messages in current conversation
  const handleConfirmClearMessages = async () => {
    if (!activeChatId) return;
    try {
      await apiClient.clearMessages(activeChatId);
      setActiveConversation((prev) => ({ ...prev, messages: [] }));
      setIsClearChatConfirmOpen(false);
      showToast('Conversation messages cleared.');
    } catch (err) {
      showToast('Failed to clear messages: ' + err.message, 'error');
    }
  };

  // Handle Retry / Edit
  const handleRetryPrompt = (content) => {
    setComposerInput(content);
    showToast('Prompt loaded into composer.');
  };

  // Handle Regenerate Response
  const handleRegenerate = async () => {
    if (!activeChatId || isGenerating) return;

    setIsGenerating(true);
    showToast('Regenerating assistant response...');
    try {
      const res = await apiClient.regenerateMessage(activeChatId, selectedModel.id);
      if (res.assistantMessage) {
        setActiveConversation((prev) => ({
          ...prev,
          messages: [...prev.messages, res.assistantMessage]
        }));
        showToast('Response regenerated.');
      }
    } catch (err) {
      showToast('Regenerate failed: ' + err.message, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="app-container">
      {/* Left Navigation Sidebar */}
      <Sidebar
        conversations={conversations}
        activeChatId={activeChatId}
        onSelectChat={(id) => loadConversation(id)}
        onNewChat={handleNewChat}
        onRenameChat={handleRenameChat}
        onRequestDeleteChat={(chat) => setDeleteTargetChat(chat)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Workspace Area */}
      <main className="main-workspace">
        <ChatHeader
          activeConversation={activeConversation}
          activeTheme={activeTheme}
          onToggleTheme={onToggleTheme}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onClearChat={() => setIsClearChatConfirmOpen(true)}
          onShowToast={showToast}
          selectedModel={selectedModel}
          onSelectModel={setSelectedModel}
        />

        {/* Scrollable Conversation Viewport */}
        <div className="chat-viewport">
          <div className="chat-content-container">
            {activeConversation.messages.length === 0 ? (
              <WelcomeScreen onSelectPrompt={handleSelectSuggestionPrompt} />
            ) : (
              activeConversation.messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  onRetry={handleRetryPrompt}
                  onRegenerate={handleRegenerate}
                  onShowToast={showToast}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Bottom Message Composer */}
        <MessageComposer
          input={composerInput}
          setInput={setComposerInput}
          onSend={handleSendMessage}
          onShowToast={showToast}
          isGenerating={isGenerating}
          onStopGeneration={handleStopGeneration}
        />
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        themeMode={themeMode}
        setThemeMode={setThemeMode}
        onShowToast={showToast}
      />

      {/* Delete Conversation Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTargetChat)}
        title="Delete Conversation"
        message={`Are you sure you want to delete "${deleteTargetChat?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTargetChat(null)}
      />

      {/* Clear Chat Confirmation Modal */}
      <ConfirmModal
        isOpen={isClearChatConfirmOpen}
        title="Clear Messages"
        message="Are you sure you want to clear all messages in this conversation?"
        confirmLabel="Clear All"
        onConfirm={handleConfirmClearMessages}
        onCancel={() => setIsClearChatConfirmOpen(false)}
      />

      {/* Toast Feedback Notifications */}
      <div className="toast-container" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast-item">
            {toast.type === 'error' ? (
              <FiAlertCircle className="toast-icon" style={{ color: '#ef4444' }} />
            ) : (
              <FiCheckCircle className="toast-icon" />
            )}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
