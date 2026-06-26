import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  MessageSquare, Home, Settings, Plus, ChevronLeft, ChevronRight,
  Sun, Moon, LogOut, User, Search, X, BarChart2, Info, Grid, PlusCircle,
  Briefcase
} from 'lucide-react';

import ChatHistoryList from './ChatHistoryList';

export default function Sidebar({
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
  // Auth state
  isLoggedIn,
  session,
  onLogout,
  // Chat history
  chatList,
  chatListLoading,
  currentSessionId,
  onNewChat,
  onLoadSession,
  onDeleteSession,
  onRenameSession,
  onPinSession,
  onLoadChatList,
  // Theme
  isDark,
  onToggleTheme,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [historySearch, setHistorySearch] = useState('');

  const filteredSessions = chatList.filter(s =>
    (s.title || '').toLowerCase().includes(historySearch.toLowerCase())
  );

  const handleNewChat = () => {
    onNewChat();
    navigate('/chat');
    setMobileOpen(false);
  };

  const userDisplay = session?.phone || session?.email || 'Guest';
  const userInitial = userDisplay.charAt(0).toUpperCase();

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="sidebar-mobile-overlay" onClick={() => setMobileOpen(false)} />
      )}

      <nav
        className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}
        aria-label="Navigation sidebar"
      >
        {/* ─── HEADER ─────────────────────────────── */}
        <div style={{
          padding: '16px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}>
          {!collapsed && (
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
              <div style={{
                width: 34,
                height: 34,
                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 900,
                fontSize: 18,
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(79,70,229,0.35)',
              }}>
                🐝
              </div>
              <div>
                <p style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                  Honeybee
                </p>
                <p style={{ fontSize: '0.6875rem', color: 'var(--color-primary)', fontWeight: 700 }}>
                  Digital AI
                </p>
              </div>
            </Link>
          )}

          {collapsed && (
            <div style={{
              width: 34,
              height: 34,
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 900,
              fontSize: 18,
              margin: '0 auto',
              boxShadow: '0 4px 12px rgba(79,70,229,0.35)',
            }}>
              🐝
            </div>
          )}

          {/* Mobile close / Desktop collapse toggle */}
          <button
            onClick={() => {
              if (window.innerWidth <= 768) setMobileOpen(false);
              else setCollapsed(!collapsed);
            }}
            style={{
              padding: 6,
              borderRadius: 8,
              border: 'none',
              background: 'var(--bg-surface-2)',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
            }}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {window.innerWidth <= 768
              ? <X size={16} />
              : collapsed
                ? <ChevronRight size={16} />
                : <ChevronLeft size={16} />
            }
          </button>
        </div>

        {/* ─── NEW CHAT BUTTON ─────────────────────── */}
        <div style={{ padding: '12px 10px 8px', flexShrink: 0 }}>
          <button
            onClick={handleNewChat}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap: 8,
              padding: collapsed ? '10px' : '10px 14px',
              background: 'var(--color-primary)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontWeight: 700,
              fontSize: '0.8125rem',
              cursor: 'pointer',
              transition: 'background var(--transition-fast), transform var(--transition-fast)',
              boxShadow: 'var(--shadow-primary)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-primary-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-primary)'; }}
            onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.97)'; }}
            onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            aria-label="Start new chat"
          >
            <Plus size={16} style={{ flexShrink: 0 }} />
            {!collapsed && <span>New Chat</span>}
          </button>
        </div>

        {/* ─── NAV LINKS ────────────────────────────── */}
        <div style={{ padding: '0 10px 8px', flexShrink: 0 }}>
          <NavItem to="/" icon={<Home size={16} />} label="Home" collapsed={collapsed} />
          <NavItem to="/chat" icon={<img src="/avatar.png" alt="Chat Assistant" style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-subtle)' }} />} label="Chat" collapsed={collapsed} />
          {isLoggedIn && session?.type === 'BUSINESS' && session?.businessId ? (
            <NavItem to="/chat?q=show my business" icon={<Briefcase size={16} />} label={session.businessName || "My Business"} collapsed={collapsed} />
          ) : (
            <NavItem to="/chat?action=add_new_business" icon={<PlusCircle size={16} />} label="Add Business" collapsed={collapsed} />
          )}
          <NavItem to="/categories" icon={<Grid size={16} />} label="Categories" collapsed={collapsed} />
          <NavItem to="/analytics" icon={<BarChart2 size={16} />} label="Analytics" collapsed={collapsed} />
          <NavItem to="/about" icon={<Info size={16} />} label="About" collapsed={collapsed} />
        </div>

        {/* ─── SEARCH (always when expanded) ────────── */}
        {!collapsed && (
          <div style={{ padding: '0 10px 8px', flexShrink: 0 }}>
            <div style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
            }}>
              <Search size={13} style={{
                position: 'absolute',
                left: 10,
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }} />
              <input
                type="text"
                placeholder="Search chats..."
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-surface-2)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '7px 10px 7px 30px',
                  fontSize: '0.75rem',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  transition: 'border-color var(--transition-fast)',
                }}
                onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border-subtle)'; }}
              />
            </div>
          </div>
        )}

        {/* ─── CHAT HISTORY ─────────────────────────── */}
        {true && (
          <>
            {!collapsed && (
              <div style={{
                padding: '0 10px 6px',
                flexShrink: 0,
              }}>
                <p style={{
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--text-muted)',
                  padding: '4px 2px 2px',
                }}>
                  Conversations
                </p>
              </div>
            )}
            <div style={{ flex: 1, overflowY: 'auto' }} className="no-scrollbar">
              <ChatHistoryList
                sessions={filteredSessions}
                currentSessionId={currentSessionId}
                loading={chatListLoading}
                onLoad={(id) => { onLoadSession(id); navigate('/chat'); setMobileOpen(false); }}
                onDelete={onDeleteSession}
                onRename={onRenameSession}
                onPin={onPinSession}
                collapsed={collapsed}
              />
            </div>
          </>
        )}

        {!isLoggedIn && (
          <div style={{ flex: 1 }} />
        )}

        {/* ─── BOTTOM BAR ─────────────────────────── */}
        <div style={{
          borderTop: '1px solid var(--border-subtle)',
          padding: '10px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}>
          {/* Settings */}
          <NavItem to="/settings" icon={<Settings size={16} />} label="Settings" collapsed={collapsed} />

          {/* Theme toggle */}
          <button
            onClick={onToggleTheme}
            className="sidebar-item"
            style={{ border: 'none', background: 'transparent', width: '100%', cursor: 'pointer', justifyContent: collapsed ? 'center' : 'flex-start' }}
            aria-label="Toggle theme"
          >
            <span className="item-icon">{isDark ? <Sun size={16} /> : <Moon size={16} />}</span>
            {!collapsed && <span className="item-label">{isDark ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>

          {/* User profile / Login */}
          {/* User profile / Login */}
          {isLoggedIn ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: collapsed ? '8px' : '8px 10px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface-2)',
              justifyContent: collapsed ? 'center' : 'flex-start',
              marginTop: 4,
            }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '0.8125rem',
                fontWeight: 700,
                flexShrink: 0,
              }}>
                {userInitial}
              </div>
              {!collapsed && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {userDisplay}
                  </p>
                  <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                    {session?.type === 'BUSINESS' ? 'Business Owner' : 'Registered'}
                  </p>
                </div>
              )}
              {!collapsed && (
                <button
                  onClick={onLogout}
                  title="Logout"
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
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-error)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                  aria-label="Logout"
                >
                  <LogOut size={14} />
                </button>
              )}
            </div>
          ) : (
            <Link to="/login" style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: collapsed ? '8px' : '8px 10px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface-2)',
              justifyContent: collapsed ? 'center' : 'flex-start',
              marginTop: 4,
              textDecoration: 'none',
              cursor: 'pointer',
              border: '1px solid var(--border-subtle)',
              transition: 'border-color 0.2s ease',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
            >
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'var(--border-default)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary)',
                fontSize: '0.8125rem',
                fontWeight: 700,
                flexShrink: 0,
              }}>
                <User size={16} />
              </div>
              {!collapsed && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    Guest User
                  </p>
                  <p style={{ fontSize: '0.625rem', color: 'var(--color-primary)', fontWeight: 700 }}>
                    Sign In / Register
                  </p>
                </div>
              )}
            </Link>
          )}
        </div>
      </nav>
    </>
  );
}

function NavItem({ to, icon, label, collapsed }) {
  const location = useLocation();
  const cleanToPath = to.split('?')[0];
  const isActive = location.pathname === cleanToPath || (cleanToPath === '/chat' && location.pathname.startsWith('/chat') && (to.includes('action') ? location.search.includes('action') : !location.search.includes('action')));

  return (
    <Link
      to={to}
      className={`sidebar-item ${isActive ? 'active' : ''}`}
      style={{
        textDecoration: 'none',
        justifyContent: collapsed ? 'center' : 'flex-start',
      }}
      aria-current={isActive ? 'page' : undefined}
    >
      <span className="item-icon">{icon}</span>
      {!collapsed && <span className="item-label">{label}</span>}
    </Link>
  );
}
