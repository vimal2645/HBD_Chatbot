import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { UI_TRANSLATIONS } from '../constants/Translations';

export function useChatMemory({ session, toast }) {
  // Guest User ID (for backend session isolation and database storage)
  const [guestUserId] = useState(() => {
    let gid = localStorage.getItem('guest_user_id');
    if (!gid) {
      gid = 'guest_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
      localStorage.setItem('guest_user_id', gid);
    }
    return gid;
  });

  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [chatList, setChatList] = useState([]);
  const [chatListLoading, setChatListLoading] = useState(false);

  // Active chat messages list (shared globally across Sidebar, Pages, and Widgets)
  const [localMessages, setLocalMessages] = useState([
    { id: 'init', role: 'bot', type: 'text', content: 'Hi 👋 How can I help you today? You can search for local businesses or manage your listing.' }
  ]);
  
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [flowMode, setFlowMode] = useState('QUERY');
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardData, setWizardData] = useState({});
  const [pendingUpdateField, setPendingUpdateField] = useState(null);
  const [syncedUserId, setSyncedUserId] = useState(null);

  const getUserId = useCallback(() => session.phone || session.email || guestUserId, [session, guestUserId]);

  // Load chat list on startup or session change
  useEffect(() => {
    const userId = getUserId();
    if (userId) {
      setChatListLoading(true);
      api.listChatSessions(userId)
        .then(list => setChatList(Array.isArray(list) ? list : []))
        .catch(err => console.error('Error loading chats:', err))
        .finally(() => setChatListLoading(false));
    }
  }, [session, getUserId]);

  // Synchronize guest chats to user account on login
  const handleSyncGuestChats = useCallback(async (registeredUserId) => {
    try {
      const res = await api.syncChats(guestUserId, registeredUserId);

      const list = await api.listChatSessions(registeredUserId);
      setChatList(Array.isArray(list) ? list : []);
      if (res && res.success && res.count > 0) {
        toast?.success('Conversations imported successfully');
      }
    } catch (e) {
      console.error('Error syncing guest chats:', e);
    }
  }, [guestUserId, toast]);

  useEffect(() => {
    const userId = session.phone || session.email;
    if (userId) {
      if (userId !== syncedUserId) {
        setSyncedUserId(userId);
        handleSyncGuestChats(userId);
      }
    } else {
      if (syncedUserId !== null) {
        setSyncedUserId(null);
      }
    }
  }, [session, syncedUserId, handleSyncGuestChats]);

  // Handlers
  const startNewSession = useCallback(async () => {
    const userId = getUserId();
    if (!userId) return null;
    try {
      const res = await api.createChatSession(userId);
      if (res.success) {
        setCurrentSessionId(res.session_id);
        const list = await api.listChatSessions(userId);
        setChatList(Array.isArray(list) ? list : []);
        return res.session_id;
      }
    } catch (e) {
      console.error('Failed to create chat session:', e);
    }
    return null;
  }, [getUserId]);

  const handleNewChat = useCallback(async () => {
    const userId = getUserId();
    
    setFlowMode('QUERY');
    setWizardStep(0);
    setWizardData({});
    setPendingUpdateField(null);
    
    const trans = UI_TRANSLATIONS[currentLanguage] || UI_TRANSLATIONS.en;
    const hint = trans.menu_hint || "💡 Note: Click the three-dot (⋮) menu at the top-right for more options.";
    setLocalMessages([
      { id: 'init', role: 'bot', type: 'text', content: trans.welcome || trans.welcome_message },
      { id: 'hint', role: 'bot', type: 'text', content: hint }
    ]);
    
    if (userId) {
      try {
        const res = await api.createChatSession(userId);
        if (res.success) {
          setCurrentSessionId(res.session_id);
          const list = await api.listChatSessions(userId);
          setChatList(Array.isArray(list) ? list : []);
        }
      } catch (e) {
        console.error('New chat session error:', e);
      }
    }
  }, [session, getUserId, currentLanguage]);

  const handleLoadSession = useCallback(async (sessionId) => {
    setCurrentSessionId(sessionId);
    if (!sessionId) return;
    
    const userId = getUserId();
    if (!userId) return;
    
    setChatListLoading(true);
    try {
      const history = await api.getChatHistory(sessionId, userId);
      if (Array.isArray(history)) {
        const mapped = history.map((h, i) => {
          let parsedContent = h.content;
          let msgType = 'text';
          let intro = null;
          let suggestions = null;
          let prompt = null;

          if (typeof h.content === 'string' && (h.content.trim().startsWith('{') || h.content.trim().startsWith('['))) {
            try {
              const data = JSON.parse(h.content);
              if (data && typeof data === 'object') {
                msgType = data.type || 'text';
                parsedContent = data.content ?? data.data ?? data.detail ?? data;
                intro = data.intro;
                suggestions = data.suggestions;
                prompt = data.prompt;
              }
            } catch (e) {}
          }

          return {
            id: `history_${i}_${Date.now()}`,
            role: h.role === 'assistant' ? 'bot' : 'user',
            type: msgType,
            content: parsedContent,
            intro: intro,
            suggestions: suggestions,
            prompt: prompt
          };
        });
        
        setFlowMode('QUERY');
        setWizardStep(0);
        setWizardData({});
        setPendingUpdateField(null);
        
        setLocalMessages(mapped.length ? mapped : [{ id: 'init', role: 'bot', type: 'text', content: 'No messages in this session.' }]);
      }
    } catch (e) {
      console.error('Failed to load past session:', e);
      if (sessionId && sessionId.toString().startsWith('guest_')) {
        try {
          const saved = localStorage.getItem('guest_chat_messages_' + sessionId);
          if (saved) {
            setLocalMessages(JSON.parse(saved));
            setFlowMode('QUERY');
            setWizardStep(0);
            setWizardData({});
            setPendingUpdateField(null);
            toast?.info('Loaded offline chat backup');
            setChatListLoading(false);
            return;
          }
        } catch (storageErr) {
          console.error('Failed to load guest history from local storage:', storageErr);
        }
      }
      toast?.error('Failed to load chat history');
    } finally {
      setChatListLoading(false);
    }
  }, [session, getUserId, toast]);

  const handleDeleteSession = useCallback(async (e, sessionId) => {
    if (e) e.stopPropagation();
    const userId = getUserId();
    if (!userId) return;
    try {
      await api.deleteChatSession(sessionId, userId);
      setChatList(prev => prev.filter(s => s.session_id !== sessionId));
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        const trans = UI_TRANSLATIONS[currentLanguage] || UI_TRANSLATIONS.en;
        setLocalMessages([
          { id: 'init', role: 'bot', type: 'text', content: trans.welcome || trans.welcome_message }
        ]);
      }
      toast?.success('Chat deleted');
    } catch {
      toast?.error('Failed to delete chat');
    }
  }, [session, getUserId, currentSessionId, currentLanguage, toast]);

  const handleRenameSession = useCallback(async (sessionId, title) => {
    const userId = getUserId();
    if (!userId) return;
    try {
      await api.renameChatSession(sessionId, title, userId);
      setChatList(prev => prev.map(s => s.session_id === sessionId ? { ...s, title } : s));
      toast?.success('Chat renamed');
    } catch {
      toast?.error('Failed to rename chat');
    }
  }, [session, getUserId, toast]);

  const handlePinSession = useCallback(async (sessionId, isPinned) => {
    const userId = getUserId();
    if (!userId) return;
    try {
      await api.pinChatSession(sessionId, isPinned, userId);
      setChatList(prev => {
        const updated = prev.map(s => s.session_id === sessionId ? { ...s, is_pinned: isPinned } : s);
        return updated.sort((a, b) => {
          const aPin = a.is_pinned ? 1 : 0;
          const bPin = b.is_pinned ? 1 : 0;
          if (aPin !== bPin) return bPin - aPin;
          return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
        });
      });
      toast?.success(isPinned ? 'Chat pinned' : 'Chat unpinned');
    } catch {
      toast?.error('Failed to update pin');
    }
  }, [session, getUserId, toast]);

  return {
    guestUserId,
    currentSessionId,
    setCurrentSessionId,
    chatList,
    setChatList,
    chatListLoading,
    setChatListLoading,
    localMessages,
    setLocalMessages,
    currentLanguage,
    setCurrentLanguage,
    flowMode,
    setFlowMode,
    wizardStep,
    setWizardStep,
    wizardData,
    setWizardData,
    pendingUpdateField,
    setPendingUpdateField,
    getUserId,
    startNewSession,
    handleNewChat,
    handleLoadSession,
    handleDeleteSession,
    handleRenameSession,
    handlePinSession
  };
}
