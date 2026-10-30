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

  const getConversationGroup = (chat) => {
    if (chat.group) return chat.group;
    if (!chat.updated_at) return 'TODAY';
    let str = String(chat.updated_at).trim();
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(str) && !str.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(str)) {
      str = str.replace(' ', 'T') + 'Z';
    }
    const date = new Date(str);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'TODAY';
    if (diffDays === 1) return 'YESTERDAY';
    if (diffDays <= 7) return 'PREVIOUS 7 DAYS';
    return 'EARLIER';
  };

  const filteredConversations = conversations.filter((chat) =>
    (chat.title || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groups = ['TODAY', 'YESTERDAY', 'PREVIOUS 7 DAYS', 'EARLIER'];
  const groupedData = groups.reduce((acc, group) => {
    acc[group] = filteredConversations.filter((c) => getConversationGroup(c) === group);
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
            onClick={() => {
              onNewChat();
              if (isMobileOpen) onCloseMobile();
            }}
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

          {/* Close button for Mobile Drawer */}
          <button
            className="sidebar-mobile-close-btn"
            onClick={onCloseMobile}
            aria-label="Close sidebar"
            title="Close sidebar"
          >
            <FiX fontSize={20} />
          </button>

          {/* Desktop Collapse Toggle (< / >) */}
          <button
            className="sidebar-toggle-btn desktop-only"
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
                <span className="new-chat-text">New Chat</span>
                <span className="new-chat-shortcut">⌘K</span>
              </>
            )}
          </button>

          {!isCollapsed && (
            <div className="search-box">
              <FiSearch className="search-icon" />
              <input
                type="text"
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              {searchQuery && (
                <button
                  className="search-clear-btn"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <FiX />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Conversation List Groups */}
        <div className="conversation-list-viewport">
          {groups.map((group) => {
            const items = groupedData[group] || [];
            if (items.length === 0) return null;

            return (
              <div key={group} className="conversation-group">
                {!isCollapsed && (
                  <div className="conversation-group-title">{group}</div>
                )}
                {items.map((chat) => {
                  const isActive = chat.id === activeChatId;
                  const isEditing = editingChatId === chat.id;

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
            <div className="sidebar-empty-state">
              <span>{searchQuery ? 'No matching chats found' : 'No conversations yet'}</span>
            </div>
          )}
        </div>

        {/* Sidebar Footer with dedicated Settings row & Profile Card */}
        <div className="sidebar-footer">
          {/* Settings Row (matches screenshot) */}
          <button
            className="sidebar-settings-btn"
            onClick={onOpenSettings}
            title="Settings"
          >
            <FiSliders className="sidebar-settings-icon" />
            {!isCollapsed && <span>Settings</span>}
          </button>

          {/* User Profile Card (matches screenshot) */}
          <div
            className="user-profile-tile"
            onClick={onOpenSettings}
            role="button"
            tabIndex={0}
            title="Account & Settings"
          >
            <div className="user-avatar">
              <span>AM</span>
            </div>
            {!isCollapsed && (
              <div className="user-details">
                <span className="user-name">Alex Morgan</span>
                <span className="user-role">Workspace Member</span>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
