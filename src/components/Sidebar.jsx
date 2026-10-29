import React, { useState } from 'react';
import {
  FiPlus,
  FiSearch,
  FiX,
  FiMessageSquare,
  FiEdit2,
  FiTrash2,
  FiSliders,
  FiChevronLeft,
  FiChevronRight,
  FiCheck
} from 'react-icons/fi';

export function Sidebar({
  conversations,
  activeChatId,
  onSelectChat,
  onNewChat,
  onRenameChat,
  onRequestDeleteChat,
  onOpenSettings,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingChatId, setEditingChatId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');

  // Filter conversations
  const filteredConversations = conversations.filter((chat) =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group conversations by period
  const groups = ['Today', 'Yesterday', 'Previous 7 Days'];
  const groupedData = groups.reduce((acc, group) => {
    acc[group] = filteredConversations.filter((c) => c.group === group);
    return acc;
  }, {});

  const handleStartRename = (e, chat) => {
    e.stopPropagation();
    setEditingChatId(chat.id);
    setEditingTitle(chat.title);
  };

  const handleSaveRename = (chatId) => {
    if (editingTitle.trim()) {
      onRenameChat(chatId, editingTitle.trim());
    }
    setEditingChatId(null);
  };

  const handleRenameKeyDown = (e, chatId) => {
    if (e.key === 'Enter') {
      handleSaveRename(chatId);
    } else if (e.key === 'Escape') {
      setEditingChatId(null);
    }
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      <div
        className={`sidebar-backdrop ${isMobileOpen ? 'active' : ''}`}
        onClick={onCloseMobile}
        aria-hidden="true"
      />

      <aside
        className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${
          isMobileOpen ? 'mobile-open' : ''
        }`}
        aria-label="Sidebar Navigation"
      >
        {/* Sidebar Header with Brand */}
        <div className="sidebar-header">
          <div
            className="brand-wrapper"
            onClick={onNewChat}
            title="Start new conversation"
          >
            <div className="brand-logo-container">
              <span className="brand-logo-icon">K</span>
            </div>
            {!isCollapsed && (
              <div className="brand-info">
                <div className="brand-title">
                  <span>Kiaan AI</span>
                  <span className="brand-badge">PRO</span>
                </div>
                <span className="brand-subtitle">Intelligent Workspace</span>
              </div>
            )}
          </div>

          <button
            className="sidebar-toggle-btn"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <FiChevronRight /> : <FiChevronLeft />}
          </button>
        </div>

        {/* Action Area: New Chat & Search */}
        <div className="sidebar-action-area">
          <button
            className="new-chat-btn"
            onClick={() => {
              onNewChat();
              if (isMobileOpen) onCloseMobile();
            }}
            title="New Conversation (Ctrl + K)"
          >
            <FiPlus fontSize={18} />
            {!isCollapsed && (
              <>
                <span>New Chat</span>
                <span className="new-chat-shortcut">⌘K</span>
              </>
            )}
          </button>

          {!isCollapsed && (
            <div className="search-input-wrapper">
              <FiSearch className="search-icon" />
              <input
                type="text"
                className="search-input"
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search conversation history"
              />
              {searchQuery && (
                <button
                  className="search-clear-btn"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search query"
                >
                  <FiX />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Conversation List */}
        <div className="conversation-list-container">
          {groups.map((group) => {
            const items = groupedData[group] || [];
            if (items.length === 0) return null;

            return (
              <div key={group} className="conversation-group">
                <div className="conversation-group-title">{group}</div>

                {items.map((chat) => {
                  const isActive = chat.id === activeChatId;
                  const isEditing = chat.id === editingChatId;

                  return (
                    <div
                      key={chat.id}
                      className={`conversation-item ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        onSelectChat(chat.id);
                        if (isMobileOpen) onCloseMobile();
                      }}
                      title={chat.title}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="conversation-item-content">
                        <FiMessageSquare className="conversation-item-icon" />

                        {!isCollapsed && (
                          <>
                            {isEditing ? (
                              <div
                                style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="text"
                                  className="conversation-edit-input"
                                  value={editingTitle}
                                  onChange={(e) => setEditingTitle(e.target.value)}
                                  onKeyDown={(e) => handleRenameKeyDown(e, chat.id)}
                                  autoFocus
                                />
                                <button
                                  className="conversation-action-btn"
                                  onClick={() => handleSaveRename(chat.id)}
                                  title="Save rename"
                                >
                                  <FiCheck />
                                </button>
                              </div>
                            ) : (
                              <span className="conversation-item-title">{chat.title}</span>
                            )}
                          </>
                        )}
                      </div>

                      {!isCollapsed && !isEditing && (
                        <div className="conversation-actions">
                          <button
                            className="conversation-action-btn"
                            onClick={(e) => handleStartRename(e, chat)}
                            title="Rename chat"
                            aria-label={`Rename ${chat.title}`}
                          >
                            <FiEdit2 />
                          </button>
                          <button
                            className="conversation-action-btn delete"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRequestDeleteChat(chat);
                            }}
                            title="Delete chat"
                            aria-label={`Delete ${chat.title}`}
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {filteredConversations.length === 0 && !isCollapsed && (
            <div style={{ textAlign: 'center', padding: '24px 10px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              No conversations found.
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <button
            className="sidebar-footer-btn"
            onClick={onOpenSettings}
            title="Settings & Preferences"
            aria-label="Open settings"
          >
            <FiSliders fontSize={18} />
            {!isCollapsed && <span>Settings</span>}
          </button>

          {/* User Profile Info Card */}
          <div className="user-profile-card">
            <div className="user-avatar" title="Alex Morgan">
              <span>AM</span>
            </div>
            {!isCollapsed && (
              <div className="user-info">
                <span className="user-name">Alex Morgan</span>
                <span className="user-plan-badge">Workspace Member</span>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

