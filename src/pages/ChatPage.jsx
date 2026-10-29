import React, { useState, useRef, useEffect } from 'react';
import { Sidebar } from '../components/Sidebar';
import { ChatHeader } from '../components/ChatHeader';
import { WelcomeScreen } from '../components/WelcomeScreen';
import { ChatMessage } from '../components/ChatMessage';
import { MessageComposer } from '../components/MessageComposer';
import { SettingsModal } from '../components/SettingsModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { INITIAL_CONVERSATIONS } from '../utils/sampleData';
import { FiCheckCircle } from 'react-icons/fi';

export function ChatPage({ activeTheme, themeMode, setThemeMode, onToggleTheme }) {
  // Conversations State (Isolated client-side demonstration state)
  const [conversations, setConversations] = useState(INITIAL_CONVERSATIONS);
  const [activeChatId, setActiveChatId] = useState(INITIAL_CONVERSATIONS[0].id);

  // Composer Input State
  const [composerInput, setComposerInput] = useState('');

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

  const showToast = (message) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  };

  // Find active conversation
  const activeConversation = conversations.find((c) => c.id === activeChatId) || {
    id: 'empty',
    title: 'New Chat',
    messages: []
  };

  // Auto-scroll to bottom on new messages
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
    const newChatId = `chat-${Date.now()}`;
    const newChat = {
      id: newChatId,
      title: 'New Conversation',
      group: 'Today',
      updatedAt: 'Just now',
      messages: []
    };
    setConversations((prev) => [newChat, ...prev]);
    setActiveChatId(newChatId);
    setComposerInput('');
    showToast('Started new conversation.');
  };

  // Handle Local UI Demonstration Message Send
  const handleSendMessage = (text) => {
    const userMsg = {
      id: `msg-${Date.now()}`,
      role: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content: text
    };

    // System demonstration banner informing user this is client-only preview
    const systemNoticeMsg = {
      id: `notice-${Date.now() + 1}`,
      role: 'system',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content: '⚡ UI Demonstration Preview: Your message was added to local state. In the upcoming backend phase, real streaming responses from Kiaan AI will appear here.'
    };

    setConversations((prev) =>
      prev.map((conv) => {
        if (conv.id === activeChatId) {
          const isFirstMessage = conv.messages.length === 0;
          // Generate a concise title from the prompt if it was a new conversation
          const updatedTitle = isFirstMessage
            ? text.slice(0, 32) + (text.length > 32 ? '...' : '')
            : conv.title;

          return {
            ...conv,
            title: updatedTitle,
            updatedAt: 'Just now',
            messages: [...conv.messages, userMsg, systemNoticeMsg]
          };
        }
        return conv;
      })
    );
  };

  // Handle Selecting a Suggestion Card
  const handleSelectSuggestionPrompt = (promptText) => {
    setComposerInput(promptText);
  };

  // Handle Renaming a Conversation
  const handleRenameChat = (chatId, newTitle) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, title: newTitle } : c))
    );
    showToast('Conversation renamed.');
  };

  // Handle Requesting Deletion of a Conversation
  const handleConfirmDelete = () => {
    if (!deleteTargetChat) return;
    const targetId = deleteTargetChat.id;
    const remaining = conversations.filter((c) => c.id !== targetId);

    setConversations(remaining);
    setDeleteTargetChat(null);
    showToast('Conversation deleted.');

    if (activeChatId === targetId) {
      if (remaining.length > 0) {
        setActiveChatId(remaining[0].id);
      } else {
        handleNewChat();
      }
    }
  };

  // Handle Clearing Chat Messages in current conversation
  const handleConfirmClearMessages = () => {
    setConversations((prev) =>
      prev.map((c) => (c.id === activeChatId ? { ...c, messages: [] } : c))
    );
    setIsClearChatConfirmOpen(false);
    showToast('Conversation messages cleared.');
  };

  // Handle Retry / Edit
  const handleRetryPrompt = (content) => {
    setComposerInput(content);
    showToast('Prompt loaded into composer.');
  };

  // Handle Regenerate
  const handleRegenerate = () => {
    showToast('Regenerate is in UI Preview mode.');
  };

  return (
    <div className="app-container">
      {/* Left Navigation Sidebar */}
      <Sidebar
        conversations={conversations}
        activeChatId={activeChatId}
        onSelectChat={(id) => setActiveChatId(id)}
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
          conversationTitle={activeConversation.title}
          activeTheme={activeTheme}
          onToggleTheme={onToggleTheme}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onClearChat={() => setIsClearChatConfirmOpen(true)}
          onShowToast={showToast}
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
            <FiCheckCircle className="toast-icon" />
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

