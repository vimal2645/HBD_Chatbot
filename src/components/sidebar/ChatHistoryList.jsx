import React, { useState } from 'react';
import { MessageSquare, Clock, Trash2, Pin, Edit2, Check } from 'lucide-react';
import { SidebarItemSkeleton } from '../ui/Skeleton';

// Group sessions by date
function groupByDate(sessions) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today - 86400000);
  const lastWeek = new Date(today - 7 * 86400000);
  const lastMonth = new Date(today - 30 * 86400000);

  const groups = { Today: [], Yesterday: [], 'Last 7 Days': [], 'Last Month': [], Older: [] };
  sessions.forEach(s => {
    const d = new Date(s.updated_at || s.created_at);
    if (d >= today) groups.Today.push(s);
    else if (d >= yesterday) groups.Yesterday.push(s);
    else if (d >= lastWeek) groups['Last 7 Days'].push(s);
    else if (d >= lastMonth) groups['Last Month'].push(s);
    else groups.Older.push(s);
  });
  return groups;
}

export default function ChatHistoryList({
  sessions,
  currentSessionId,
  loading,
  onLoad,
  onDelete,
  onRename,
  onPin,
  collapsed = false,
}) {
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  if (loading) {
    return (
      <div style={{ padding: '0 8px' }}>
        {[...Array(5)].map((_, i) => <SidebarItemSkeleton key={i} />)}
      </div>
    );
  }

  if (sessions.length === 0) {
    if (collapsed) return null;
    return (
      <div style={{
        textAlign: 'center',
        padding: '32px 16px',
        color: 'var(--text-muted)',
      }}>
        <MessageSquare size={28} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
        <p style={{ fontSize: '0.75rem', fontWeight: 500 }}>No chat history yet</p>
        <p style={{ fontSize: '0.6875rem', marginTop: 4, opacity: 0.7 }}>
          Start a conversation to save it here
        </p>
      </div>
    );
  }

  if (collapsed) {
    return (
      <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {sessions.slice(0, 8).map(s => (
          <button
            key={s.session_id}
            onClick={() => onLoad(s.session_id)}
            title={s.title}
            className={`chat-history-item ${currentSessionId === s.session_id ? 'active' : ''}`}
            style={{ justifyContent: 'center', padding: '8px', position: 'relative' }}
          >
            <MessageSquare size={15} className="item-icon" />
            {s.is_pinned && (
              <Pin size={6} style={{ position: 'absolute', top: 4, right: 4, color: 'var(--color-primary)' }} />
            )}
          </button>
        ))}
      </div>
    );
  }

  const groups = groupByDate(sessions);

  const startEditing = (e, session) => {
    e.stopPropagation();
    setEditingId(session.session_id);
    setEditTitle(session.title || 'New Chat');
  };

  const handleSaveRename = (e, sessionId) => {
    e.stopPropagation();
    if (editTitle.trim()) {
      onRename(sessionId, editTitle.trim());
    }
    setEditingId(null);
  };

  const handlePinClick = (e, session) => {
    e.stopPropagation();
    onPin(session.session_id, !session.is_pinned);
  };

  return (
    <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {Object.entries(groups).map(([label, items]) => {
        if (items.length === 0) return null;
        return (
          <div key={label}>
            <div style={{
              fontSize: '0.625rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--text-muted)',
              padding: '10px 10px 4px',
            }}>
              {label}
            </div>
            {items.map(session => {
              const isEditing = editingId === session.session_id;
              const isSelected = currentSessionId === session.session_id;

              return (
                <div
                  key={session.session_id}
                  className={`chat-history-item ${isSelected ? 'active' : ''}`}
                  onClick={() => !isEditing && onLoad(session.session_id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && !isEditing && onLoad(session.session_id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    position: 'relative'
                  }}
                >
                  <MessageSquare size={13} className="item-icon" style={{ flexShrink: 0, color: session.is_pinned ? 'var(--color-primary)' : 'inherit' }} />
                  
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={e => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={e => setEditTitle(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSaveRename(e, session.session_id)}
                          style={{
                            width: '100%',
                            fontSize: '0.8rem',
                            border: '1px solid var(--color-primary)',
                            borderRadius: 4,
                            padding: '2px 6px',
                            background: 'var(--bg-surface-2)',
                            color: 'var(--text-primary)',
                            outline: 'none'
                          }}
                          autoFocus
                        />
                        <button
                          onClick={e => handleSaveRename(e, session.session_id)}
                          style={{
                            border: 'none',
                            background: 'var(--color-primary)',
                            color: 'white',
                            borderRadius: 4,
                            padding: 3,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          <Check size={12} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <p 
                          onDoubleClick={e => startEditing(e, session)}
                          style={{
                            fontSize: '0.8rem',
                            fontWeight: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            lineHeight: 1.2,
                            color: 'var(--text-primary)'
                          }}
                        >
                          {session.title || 'New Chat'}
                        </p>
                      </>
                    )}
                  </div>

                  {!isEditing && (
                    <div className="action-buttons-container" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      {/* Pin button */}
                      <button
                        onClick={e => handlePinClick(e, session)}
                        title={session.is_pinned ? "Unpin chat" : "Pin chat"}
                        style={{
                          padding: 4,
                          borderRadius: 6,
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          color: session.is_pinned ? 'var(--color-primary)' : 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          flexShrink: 0
                        }}
                      >
                        <Pin size={12} style={{ transform: session.is_pinned ? 'none' : 'rotate(45deg)' }} />
                      </button>

                      {/* Rename edit button */}
                      <button
                        onClick={e => startEditing(e, session)}
                        title="Rename chat"
                        style={{
                          padding: 4,
                          borderRadius: 6,
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          flexShrink: 0
                        }}
                      >
                        <Edit2 size={12} />
                      </button>

                      {/* Delete button */}
                      <button
                        className="delete-btn"
                        onClick={e => onDelete(e, session.session_id)}
                        title="Delete chat"
                        style={{
                          padding: 4,
                          borderRadius: 6,
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          flexShrink: 0,
                          transition: 'color 150ms ease, background 150ms ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fee2e2'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
