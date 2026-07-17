import React, { useEffect, useRef, useState, useCallback } from 'react'
import { X, Globe, ChevronDown, MoreVertical, Plus, Search, RefreshCw, LogIn, Settings, MessageSquare, Trash2, Clock } from 'lucide-react'
import MessageItem from './MessageItem'
import LoginPopup from './LoginPopup'
import { INDIAN_LANGUAGES } from '../constants/Languages'
import { UI_TRANSLATIONS } from '../constants/Translations'
import { api } from '../services/api'
import { useChatMemory } from '../hooks/useChatMemory'
import { useChatWizards, ADD_BIZ_STEPS, getAddProductSteps, getAddDealSteps } from '../hooks/useChatWizards'

const ChatWidget = ({ onClose, initialQuery, onClearInitialQuery, initialAction, onClearInitialAction }) => {
  const [inputText, setInputText] = useState('')
  const [quickActionsView, setQuickActionsView] = useState('welcome_screen')
  const [currentLanguage, setCurrentLanguage] = useState('en')
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false)
  const [resetConfirmCount, setResetConfirmCount] = useState(0)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [msgHistory, setMsgHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  const [session, setSession] = useState({ type: 'GUEST', phone: null, businessId: null })
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [showLoginPopup, setShowLoginPopup] = useState(false)

  const [localMessages, setLocalMessages] = useState([
    {
      id: 'init',
      role: 'bot',
      type: 'explore_welcome',
      content: UI_TRANSLATIONS.en.welcome,
      suggestions: [
        { title: '🏢 Business Listings', action: 'query_rewrite', query: 'explore business listings' },
        { title: '🛍️ Products', action: 'query_rewrite', query: 'explore products' }
      ]
    }
  ])
  const messagesEndRef = useRef(null)

  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false)
  const [backendHealth, setBackendHealth] = useState('checking')

  const hasThinking = (msgs) => msgs.some(m => m.type === 'thinking')
  const addThinking = () => setLocalMessages(prev => hasThinking(prev) ? prev : [...prev, { id: 'thinking', role: 'bot', type: 'thinking' }])
  const removeThinking = () => setLocalMessages(prev => prev.filter(m => m.type !== 'thinking'))

  // Initialize Custom Hooks
  const wizards = useChatWizards({
    session,
    currentLanguage,
    setLocalMessages,
    addThinking,
    removeThinking,
    setSession,
    setIsLoggedIn,
    setQuickActionsView
  });

  const memory = useChatMemory({
    session,
    currentLanguage,
    setLocalMessages,
    setFlowMode: wizards.setFlowMode,
    setWizardStep: wizards.setWizardStep,
    setWizardData: wizards.setWizardData
  });

  const { flowMode, setFlowMode, wizardStep, setWizardStep, wizardData, setWizardData, pendingUpdateField, setPendingUpdateField } = wizards;
  const { currentSessionId, setCurrentSessionId, chatList, setChatList, showChatSidebar, setShowChatSidebar, chatListLoading, setChatListLoading, getUserId, startNewSession, loadChatList, loadPastSession, deleteSession, handleNewChat } = memory;

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [localMessages])

  useEffect(() => {
    const lang = currentLanguage || 'en';
    const trans = UI_TRANSLATIONS[lang] || UI_TRANSLATIONS.en;
    const hint = trans.menu_hint || "💡 Note: Click the three-dot (⋮) menu at the top-right for more options.";

    if (localMessages.length <= 2 && localMessages.every(m => m.id === 'init' || m.id === 'hint')) {
      setLocalMessages([
        {
          id: 'init',
          role: 'bot',
          type: 'explore_welcome',
          content: trans.welcome || trans.welcome_message,
          suggestions: [
            { title: '🏢 Business Listings', action: 'query_rewrite', query: 'explore business listings' },
            { title: '🛍\uFE0F Products', action: 'query_rewrite', query: 'explore products' }
          ]
        }
      ])
    }
  }, [currentLanguage])

  // AUTO-INITIALIZE SESSION ON LOGIN
  useEffect(() => {
    if (isLoggedIn && !currentSessionId && getUserId()) {
      startNewSession().then(() => loadChatList());
    }
  }, [isLoggedIn, session, currentSessionId])

  const checkHealth = useCallback(async () => {
    try {
      await api.checkHealth()
      setBackendHealth('Connected')
    } catch (error) {
      setBackendHealth('Offline')
    }
  }, [])

  useEffect(() => {
    checkHealth()
    const interval = setInterval(checkHealth, 10000)
    return () => clearInterval(interval)
  }, [checkHealth])

  // Process initialQuery
  useEffect(() => {
    if (initialQuery) {
      handleSend(null, initialQuery)
      if (onClearInitialQuery) {
        onClearInitialQuery()
      }
    }
  }, [initialQuery, onClearInitialQuery])

  // Process initialAction
  useEffect(() => {
    if (initialAction) {
      handleAction(initialAction)
      if (onClearInitialAction) {
        onClearInitialAction()
      }
    }
  }, [initialAction, onClearInitialAction])

  const handleBack = () => {
    const lang = currentLanguage || 'en';
    const trans = UI_TRANSLATIONS[lang] || UI_TRANSLATIONS.en;

    if (flowMode === 'ADD_WIZARD' || flowMode === 'ADD_PRODUCT' || flowMode === 'ADD_DEAL') {
      if (wizardStep > 0) {
        setWizardStep(prev => prev - 1)
        const stepList = flowMode === 'ADD_WIZARD' ? ADD_BIZ_STEPS : (flowMode === 'ADD_PRODUCT' ? getAddProductSteps(trans) : getAddDealSteps(trans));
        const prevStep = stepList[wizardStep - 1];
        setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: prevStep.prompt || trans[prevStep.promptKey] || prevStep.promptKey }])
        console.log("FLOW MODE:", flowMode);
        console.log("STEP:", wizardStep);
        console.log("CURRENT:", currentStep.key);
        console.log("INPUT:", text);
      } else {
        setFlowMode('QUERY')
        setQuickActionsView(isLoggedIn ? 'main' : 'welcome_screen')
      }
      console.log("Leaving wizard...");
      return
    }

    if (flowMode === 'SEARCH_NAME' || flowMode === 'SEARCH_ADDR') {
      setLocalMessages(prev => [...prev, { id: Date.now(), role: 'user', type: 'text', content: trans.btn_back }])
      setFlowMode('QUERY')
      setQuickActionsView('search_sub_menu')
      setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: trans.cancel_search }])
      return
    }

    if (flowMode === 'UPDATE_VALUE') {
      setLocalMessages(prev => [...prev, { id: Date.now(), role: 'user', type: 'text', content: trans.btn_back }])
      setFlowMode('QUERY')
      setPendingUpdateField(null)
      setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: trans.cancel_update }])
      return
    }

    if (quickActionsView === 'search_sub_menu') {
      setLocalMessages(prev => [...prev, { id: Date.now(), role: 'user', type: 'text', content: trans.btn_back }])
      setQuickActionsView('welcome_screen')
      setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: trans.back_menu }])
      return
    }

    if (quickActionsView === 'main' || quickActionsView === 'no_business') {
      setLocalMessages(prev => [...prev, { id: Date.now(), role: 'user', type: 'text', content: trans.btn_back }])
      setIsLoggedIn(false)
      setSession({ type: 'GUEST', phone: null, businessId: null })
      setQuickActionsView('welcome_screen')
      setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: trans.session_ended }])
      return
    }

    if (quickActionsView === 'welcome_screen') {
      onClose()
      return
    }
  }

  const handleLogout = () => {
    const lang = currentLanguage || 'en'
    const trans = UI_TRANSLATIONS[lang] || UI_TRANSLATIONS.en

    setIsLoggedIn(false)
    setSession({ type: 'GUEST', phone: null, businessId: null })
    setCurrentSessionId(null)
    setChatList([])
    setQuickActionsView('welcome_screen')
    setFlowMode('QUERY')
    setWizardStep(0)
    setWizardData({})

    setLocalMessages([
      { id: 'init', role: 'bot', type: 'text', content: trans.welcome || trans.welcome_message },
      { id: 'hint', role: 'bot', type: 'text', content: trans.menu_hint || "💡 Note: Click the three-dot (⋮) menu at the top-right for more options." }
    ])
  }

  const handleLoginSuccess = async (identifier, method = 'phone') => {
    try {
      const res = await api.login(identifier, method)
      if (res.status === 'error') {
        throw new Error(res.message);
      }

      setShowLoginPopup(false)
      const trans = UI_TRANSLATIONS[currentLanguage || 'en'] || UI_TRANSLATIONS.en;
      if (res.status === 'logged_in' && res.businesses?.length) {
        const biz = res.businesses[0]
        const sessionData = {
          type: 'BUSINESS',
          businessId: biz.global_business_id,
          businessName: biz.business_name,
          city: biz.city
        }
        if (method === 'phone') sessionData.phone = identifier;
        else {
          sessionData.email = identifier;
          if (biz.phone_number) sessionData.phone = biz.phone_number;
        }

        setSession(sessionData)
        setIsLoggedIn(true)
        setQuickActionsView('main')
        const welcomeMsg = `👋 ${trans.welcome_back}, ${biz.business_name}!`
        setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: welcomeMsg }])

        const userId = method === 'phone' ? identifier : (sessionData.email || identifier)
        try {
          const sRes = await api.createChatSession(userId)
          if (sRes.success) setCurrentSessionId(sRes.session_id)
          const list = await api.listChatSessions(userId)
          setChatList(Array.isArray(list) ? list : [])
        } catch (err) { console.error('Chat session init error:', err) }
      } else {
        const sessionData = { type: 'REGISTERED' }
        if (method === 'phone') sessionData.phone = identifier;
        else sessionData.email = identifier;

        setSession(sessionData)
        setIsLoggedIn(true)
        setQuickActionsView('no_business')
        const welcomeMsg = trans.welcome;
        const menuHint = trans.menu_hint || "💡 Note: Click the three-dot (⋮) menu at the top-right for more actions.";

        setLocalMessages(prev => [
          ...prev,
          { id: Date.now(), role: 'bot', type: 'text', content: welcomeMsg },
          { id: Date.now() + 1, role: 'bot', type: 'text', content: menuHint }
        ])

        try {
          const sRes = await api.createChatSession(identifier)
          if (sRes.success) setCurrentSessionId(sRes.session_id)
          const list = await api.listChatSessions(identifier)
          setChatList(Array.isArray(list) ? list : [])
        } catch (err) { console.error('Chat session init error:', err) }
      }
    } catch (e) {
      alert(`Login error: ${e.message}`);
    }
  }

  const handleSend = async (e, overrideText = null) => {
    if (e) e.preventDefault()
    const text = (overrideText || inputText).trim()
    if (!text || hasThinking(localMessages)) return

    setInputText('')
    setLocalMessages(prev => [...prev, { id: Date.now(), role: 'user', type: 'text', content: text }])

    setMsgHistory(prev => {
      if (prev[prev.length - 1] === text) return prev;
      return [...prev, text];
    })
    setHistoryIndex(-1)

    addThinking()

    try {
      const lang = currentLanguage || 'en';
      const trans = UI_TRANSLATIONS[lang] || UI_TRANSLATIONS.en;

      // Delegate to Wizards Hook
      const wasWizardFlow = await wizards.handleWizardSend(text, trans);
      if (wasWizardFlow) {
        return;
      }

      // DEFAULT QUERY FLOW
      let activeSessionId = currentSessionId;
      if (isLoggedIn && !activeSessionId) {
        activeSessionId = await startNewSession();
        await loadChatList();
      }

      const data = await api.query({
        query: text,
        session,
        language: lang,
        session_id: activeSessionId
      })
      removeThinking()

      const responseType = data.type || 'text'
      if (responseType === 'command') {
        handleAction(data.command);
        return;
      }

      const fallbackResponse = trans.fallback_response || 'I am not sure about that.';
      setLocalMessages(prev => [...prev, {
        id: Date.now(),
        role: 'bot',
        type: responseType,
        content: data.data || data.content || fallbackResponse,
        intro: data.intro,
        suggestions: data.suggestions || [],
        search_metadata: data.search_metadata || null,
        context: data.context || null
      }])

    } catch (e) {
      removeThinking()
      const lang = currentLanguage || 'en';
      const trans = UI_TRANSLATIONS[lang] || UI_TRANSLATIONS.en;
      console.error("handleSend Error:", e);
      setLocalMessages(prev => [...prev, {
        id: Date.now(),
        role: 'bot',
        type: 'text',
        content: `⚠️ ${trans.generic_error || 'Something went wrong.'} (${e.message})`
      }])
    }
  }

  const handleKeyDown = (e) => {
    if (msgHistory.length === 0) return;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const nextIndex = historyIndex + 1;
      if (nextIndex < msgHistory.length) {
        setHistoryIndex(nextIndex);
        setInputText(msgHistory[msgHistory.length - 1 - nextIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = historyIndex - 1;
      if (nextIndex >= 0) {
        setHistoryIndex(nextIndex);
        setInputText(msgHistory[msgHistory.length - 1 - nextIndex]);
      } else if (nextIndex === -1) {
        setHistoryIndex(-1);
        setInputText('');
      }
    }
  }

  const handleAction = async (action, payload) => {
    const lang = currentLanguage || 'en';
    const trans = UI_TRANSLATIONS[lang] || UI_TRANSLATIONS.en;

    const actionLabels = {
      'search': trans.btn_show_biz,
      'update': trans.btn_update_biz,
      'add_new_business': trans.btn_add,
      'search_by_name': trans.btn_name,
      'search_by_address': trans.btn_address,
      'update_specific': `Update ${payload}`,
      'claim_business': `Claim ${payload?.business_name}`,
      'go_back': trans.btn_back,
      'close': 'Minimize Chat',
      'reset_chat': trans.btn_reset
    }

    if (actionLabels[action]) {
      setLocalMessages(prev => [...prev, { id: Date.now(), role: 'user', type: 'text', content: actionLabels[action] }])
    }

    if (action === 'go_back') return handleBack()
    if (action === 'close') return onClose()
    if (action === 'login_trigger') return setShowLoginPopup(true)
    if (action === 'cancel_sub_menu') return setQuickActionsView('welcome_screen')

    // ── Suggestion Chip Actions (query_rewrite / pagination) ──────────────────
    if (action === 'query_rewrite' || action === 'next_option' || action === 'prev_option' || action === 'set_city' || action === 'set_category') {
      const queryText = typeof payload === 'string' ? payload : (payload?.query || payload);
      if (!queryText) return;
      // Show the chip label as a user message
      await handleSend(null, queryText);
      return;
    }


    if (action === 'search_method') {
      setLocalMessages(prev => [...prev, { id: Date.now(), role: 'user', type: 'text', content: trans.btn_find }])
      setLocalMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'bot',
        type: 'search_options',
        content: trans.search_by,
        labels: { name: trans.btn_name, address: trans.btn_address }
      }])
      return
    }

    if (action === 'search_by_name') {
      setFlowMode('SEARCH_NAME')
      setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: trans.search_prompt }])
    }
    if (action === 'search_by_address') {
      setFlowMode('SEARCH_ADDR')
      setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: trans.address_prompt }])
    }
    if (action === 'add_new_business') {
      setFlowMode('ADD_WIZARD')
      setWizardStep(0)
      const initialData = {}
      if (session.phone) initialData.phone = session.phone
      if (session.email) initialData.email = session.email
      setWizardData(initialData)
      setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: trans.prompt_phone }])
    }

    if (action === 'start_add_product') {
      if (!session.businessId) return setShowLoginPopup(true)
      const ADD_PRODUCT_STEPS = getAddProductSteps(trans)
      setFlowMode('ADD_PRODUCT')
      setWizardStep(0)
      setWizardData({})
      setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: ADD_PRODUCT_STEPS[0].prompt }])
      return
    }

    if (action === 'start_add_deal') {
      if (!session.businessId) return setShowLoginPopup(true)
      const ADD_DEAL_STEPS = getAddDealSteps(trans)
      setFlowMode('ADD_DEAL')
      setWizardStep(0)
      setWizardData({})
      setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: ADD_DEAL_STEPS[0].prompt }])
      return
    }

    if (action === 'reset_chat') {
      setShowResetConfirm(true)
      return
    }

    if (action === 'confirm_reset') {
      if (currentSessionId && getUserId()) {
        api.deleteChatSession(currentSessionId, getUserId()).then(() => loadChatList());
      }

      setShowResetConfirm(false)
      setLocalMessages([
        {
          id: 'init',
          role: 'bot',
          type: 'explore_welcome',
          content: trans.chat_cleared || '👋 Chat cleared. Welcome back!',
          suggestions: [
            { title: '🏢 Business Listings', action: 'query_rewrite', query: 'explore business listings' },
            { title: '🛍️ Products', action: 'query_rewrite', query: 'explore products' }
          ]
        }
      ])
      setResetConfirmCount(0)
      setFlowMode('QUERY')
      setQuickActionsView(isLoggedIn ? (session.type === 'BUSINESS' ? 'main' : 'no_business') : 'welcome_screen')
      setWizardStep(0)
      setWizardData({})
      setCurrentSessionId(null)
      return
    }


    if (action !== 'reset_chat') setResetConfirmCount(0)

    if (action === 'search') {
      addThinking()
      try {
        const data = await api.query({
          query: "show my business",
          session,
          language: lang,
          session_id: currentSessionId
        })
        removeThinking()
        if (!data || (!data.type && data.detail)) {
          setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: '❌ Could not load your business. Please try again.' }])
          return
        }
        setLocalMessages(prev => [...prev, {
          id: Date.now(),
          role: 'bot',
          type: data.type || 'text',
          content: data.content ?? data.data ?? data.detail ?? 'No data found.',
          intro: data.intro,
          prompt: data.prompt,
          suggestions: data.suggestions
        }])
      } catch (e) {
        removeThinking()
        setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: '❌ Error loading business. Please restart the backend and try again.' }])
      }
    }
    if (action === 'update') {
      addThinking()
      try {
        const data = await api.query({
          query: "update my business",
          session,
          language: lang,
          session_id: currentSessionId
        })
        removeThinking()
        setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'suggestions', intro: data.intro, suggestions: data.suggestions || data.content }])
      } catch (e) { removeThinking() }
    }
    if (action === 'update_specific') {
      const field = payload;
      setPendingUpdateField(field);
      setFlowMode('UPDATE_VALUE');
      setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: `${trans.update_prompt || 'Please enter your new'} ${field.replace('_', ' ')}:` }]);
    }
    if (action?.startsWith('Update ')) {
      const field = action.replace('Update ', '').toLowerCase().replace(' ', '_')
      setPendingUpdateField(field)
      setFlowMode('UPDATE_VALUE')
      const trans = UI_TRANSLATIONS[lang] || UI_TRANSLATIONS.en;
      setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: `${trans.update_prompt} ${field.replace('_', ' ')}:` }])
    }
    if (action === 'claim_business') {
      const trans = UI_TRANSLATIONS[lang] || UI_TRANSLATIONS.en;
      const verificationMsg = trans.claim_verification
        ? trans.claim_verification.replace('this business', `"${payload.business_name}"`)
        : `Great! To manage "${payload.business_name}", we first need to verify your ownership via phone.`;
      setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: verificationMsg }])
      setShowLoginPopup(true)
    }

    if (action === 'manage_products') {
      addThinking();
      try {
        const lang2 = currentLanguage || 'en';
        const data = await api.query({
          query: 'manage product',
          session,
          language: lang2,
          session_id: currentSessionId
        })
        removeThinking();
        setLocalMessages(prev => [...prev, {
          id: Date.now(), role: 'bot',
          type: data.type === 'manage_products' ? 'manage_products' : 'text',
          content: data.content !== undefined ? data.content : (data.data || (data.type === 'faq' ? data.data : '')),
          intro: data.intro
        }])
        if (data.type === 'faq') {
          setLocalMessages(prev => { const msgs = [...prev]; msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], type: 'text', content: data.data || 'No products found.' }; return msgs; })
        }
      } catch (e) { removeThinking(); console.error('manage_products error:', e); }
    }
    if (action === 'manage_deals') {
      addThinking();
      try {
        const lang2 = currentLanguage || 'en';
        const data = await api.query({
          query: 'manage deal',
          session,
          language: lang2,
          session_id: currentSessionId
        })
        removeThinking();
        setLocalMessages(prev => [...prev, {
          id: Date.now(), role: 'bot',
          type: data.type === 'manage_deals' ? 'manage_deals' : 'text',
          content: data.content !== undefined ? data.content : (data.data || (data.type === 'faq' ? data.data : '')),
          intro: data.intro
        }])
        if (data.type === 'faq') {
          setLocalMessages(prev => { const msgs = [...prev]; msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], type: 'text', content: data.data || 'No deals found.' }; return msgs; })
        }
      } catch (e) { removeThinking(); console.error('manage_deals error:', e); }
    }
    if (action === 'delete_product') {
      const res = await api.deleteProduct(payload);
      if (res.success) {
        setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: "🗑️ Product removed successfully!" }])
        setTimeout(() => handleAction('manage_products'), 300)
      }
    }
    if (action === 'delete_deal') {
      const res = await api.deleteDeal(payload);
      if (res.success) {
        setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: "🗑️ Deal removed successfully!" }])
        setTimeout(() => handleAction('manage_deals'), 300)
      }
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] relative overflow-hidden">

      {/* CHAT HISTORY SIDEBAR */}
      {showChatSidebar && (
        <>
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 z-30"
            onClick={() => setShowChatSidebar(false)}
          />
          {/* Slider */}
          <div
            className="absolute left-0 top-0 bottom-0 w-[260px] bg-white z-40 flex flex-col shadow-2xl"
            style={{ borderRadius: '0 16px 16px 0' }}
          >
            {/* Sidebar Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare size={15} className="text-white" />
                <span className="text-white font-bold text-sm">Chat History</span>
              </div>
              <button
                onClick={() => setShowChatSidebar(false)}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors text-white"
              >
                <X size={14} />
              </button>
            </div>

            {/* New Chat Button */}
            <button
              onClick={handleNewChat}
              className="mx-3 mt-3 mb-2 flex items-center gap-2 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-700 transition-all active:scale-95"
            >
              <Plus size={13} />
              New Chat
            </button>

            {/* Sessions List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-3">
              {chatListLoading ? (
                <div className="text-center py-6 text-xs text-gray-400">Loading...</div>
              ) : chatList.length === 0 ? (
                <div className="text-center py-8 px-3">
                  <MessageSquare size={28} className="mx-auto text-gray-200 mb-2" />
                  <p className="text-[11px] text-gray-400">No chat history yet.</p>
                  <p className="text-[10px] text-gray-300 mt-1">Your conversations will appear here.</p>
                </div>
              ) : (
                chatList.map(chat => (
                  <div
                    key={chat.session_id}
                    onClick={() => loadPastSession(chat.session_id)}
                    className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer mb-1 transition-all hover:bg-indigo-50 ${currentSessionId === chat.session_id ? 'bg-indigo-50 border border-indigo-100' : ''
                      }`}
                  >
                    <MessageSquare size={12} className="text-indigo-300 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-gray-700 truncate">{chat.title}</p>
                      <p className="text-[9px] text-gray-400 mt-0.5">
                        <Clock size={8} className="inline mr-0.5" />
                        {chat.updated_at ? new Date(chat.updated_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : ''}
                      </p>
                    </div>
                    <button
                      onClick={(e) => deleteSession(e, chat.session_id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded-lg transition-all text-red-400 flex-shrink-0"
                      title="Delete chat"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* HEADER */}
      <div className="p-4 bg-white border-b border-gray-100 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {isLoggedIn && (
            <button
              onClick={() => { setShowChatSidebar(true); loadChatList(); }}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-indigo-500"
              title="Chat History"
            >
              <MessageSquare size={16} />
            </button>
          )}
          <div className="w-8 h-8 bg-[#4F46E5] rounded-lg flex items-center justify-center text-white font-bold">C</div>
          <div>
            <h2 className="text-sm font-bold text-gray-800">CityHangAround</h2>
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${backendHealth === 'Connected' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
              <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">
                {backendHealth === 'Connected' ? 'Connected' : 'Offline'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-100"
            >
              <Globe size={14} className="text-[#4F46E5]" />
              <span className="text-[11px] font-bold text-gray-700 uppercase">{currentLanguage}</span>
              <ChevronDown size={12} className={`text-gray-400 transition-transform ${isLangMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isLangMenuOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                <div className="max-h-60 overflow-y-auto custom-scrollbar">
                  {INDIAN_LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setCurrentLanguage(lang.code)
                        setIsLangMenuOpen(false)
                      }}
                      className={`w-full flex items-center justify-between px-4 py-2 text-left text-xs hover:bg-gray-50 transition-colors ${currentLanguage === lang.code ? 'text-[#4F46E5] font-bold bg-indigo-50/50' : 'text-gray-600'}`}
                    >
                      <span>{lang.name}</span>
                      <span className="text-[10px] text-gray-400 opacity-70">{lang.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => setIsActionsMenuOpen(!isActionsMenuOpen)}
              className={`p-2 hover:bg-gray-100 rounded-lg transition-all duration-200 ${isActionsMenuOpen ? 'text-[#4F46E5] bg-indigo-50 rotate-90' : 'text-gray-400'}`}
            >
              <MoreVertical size={18} />
            </button>

            {isActionsMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsActionsMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl z-50 overflow-hidden" style={{ boxShadow: '0 10px 40px rgba(79,70,229,0.15), 0 2px 10px rgba(0,0,0,0.08)' }}>
                  <div className="px-4 py-3 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED]">
                    <p className="text-[11px] font-bold text-white/90 tracking-wide">{UI_TRANSLATIONS[currentLanguage || 'en']?.how_continue || "Actions"}</p>
                  </div>

                  <div className="py-1.5">
                    {!isLoggedIn ? (
                      <>
                        <button onClick={() => { setIsActionsMenuOpen(false); handleAction('login_trigger') }} className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-gray-700 hover:bg-indigo-50/60 transition-all duration-150 group">
                          <span className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100 group-hover:scale-110 transition-all duration-200">
                            <LogIn size={14} className="text-[#4F46E5]" />
                          </span>
                          <span className="font-semibold">{UI_TRANSLATIONS[currentLanguage || 'en']?.btn_phone}</span>
                        </button>
                        <button onClick={() => { setIsActionsMenuOpen(false); handleAction('search_method') }} className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-gray-700 hover:bg-blue-50/60 transition-all duration-150 group">
                          <span className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 group-hover:scale-110 transition-all duration-200">
                            <Search size={14} className="text-blue-500" />
                          </span>
                          <span className="font-semibold">{UI_TRANSLATIONS[currentLanguage || 'en']?.btn_find}</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setIsActionsMenuOpen(false); handleAction('search') }} className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-gray-700 hover:bg-blue-50/60 transition-all duration-150 group">
                          <span className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 group-hover:scale-110 transition-all duration-200">
                            <Search size={14} className="text-blue-500" />
                          </span>
                          <span className="font-semibold">{UI_TRANSLATIONS[currentLanguage || 'en']?.btn_show_biz}</span>
                        </button>
                        <button onClick={() => { setIsActionsMenuOpen(false); handleAction('update') }} className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-gray-700 hover:bg-green-50/60 transition-all duration-150 group">
                          <span className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center group-hover:bg-green-100 group-hover:scale-110 transition-all duration-200">
                            <RefreshCw size={14} className="text-green-500" />
                          </span>
                          <span className="font-semibold">{UI_TRANSLATIONS[currentLanguage || 'en']?.btn_update_biz}</span>
                        </button>
                      </>
                    )}

                    <button onClick={() => { setIsActionsMenuOpen(false); handleAction('add_new_business') }} className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-emerald-700 hover:bg-emerald-50/60 transition-all duration-150 group">
                      <span className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 group-hover:scale-110 transition-all duration-200">
                        <Plus size={14} className="text-emerald-600" />
                      </span>
                      <span className="font-bold">{UI_TRANSLATIONS[currentLanguage || 'en']?.btn_add}</span>
                    </button>
                  </div>

                  <div className="mx-3 border-t border-gray-100"></div>

                  <div className="py-1.5">
                    <button onClick={() => { setIsActionsMenuOpen(false); handleAction('reset_chat') }} className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-red-500 hover:bg-red-50/60 transition-all duration-150 group">
                      <span className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center group-hover:bg-red-100 group-hover:scale-110 transition-all duration-200">
                        <RefreshCw size={14} className="text-red-400" />
                      </span>
                      <span className="font-semibold">{UI_TRANSLATIONS[currentLanguage || 'en']?.btn_reset}</span>
                    </button>

                    {isLoggedIn && (
                      <button onClick={() => { setIsActionsMenuOpen(false); handleLogout() }} className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-gray-500 hover:bg-gray-100/60 transition-all duration-150 group">
                        <span className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center group-hover:bg-gray-200 group-hover:scale-110 transition-all duration-200">
                          <LogIn size={14} className="text-gray-500 rotate-180" />
                        </span>
                        <span className="font-semibold">{UI_TRANSLATIONS[currentLanguage || 'en']?.logout || "Logout"}</span>
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400"><X size={18} /></button>
        </div>
      </div>

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {backendHealth === 'Offline' && (
          <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl flex flex-col gap-2 shadow-sm animate-in fade-in duration-300">
            <p className="text-xs font-bold">⚠️ Connection Issue</p>
            <p className="text-[11px] leading-relaxed text-amber-700">
              The backend server appears to be offline. Make sure `START_SERVER.bat` in the backend folder is running and serving on port 5000.
            </p>
            <button
              onClick={checkHealth}
              className="w-fit text-[10px] font-bold bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-all active:scale-95 mt-1"
            >
              Retry Connection
            </button>
          </div>
        )}
        {localMessages.map((msg) => (
          <MessageItem key={msg.id} message={msg} onAction={handleAction} isLoggedIn={isLoggedIn} session={session} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* PREMIUM ACTIONS TRAY / CURRENCY SHORTCUTS */}
      {isLoggedIn && session.businessId && (flowMode === 'ADD_PRODUCT' && wizardStep === 1) && (
        <div className="flex gap-2 px-3 py-2 bg-gray-50/50 border-t border-gray-100 overflow-x-auto no-scrollbar animate-in slide-in-from-bottom-2 duration-300">
          {flowMode === 'ADD_PRODUCT' && wizardStep === 1 && (
            <div className="flex gap-2 items-center">
              <span className="text-[10px] font-bold text-gray-400 mr-1 uppercase">Price Helpers:</span>
              {['₹', 'Rs.', '$'].map(sym => (
                <button
                  key={sym}
                  onClick={() => setInputText(prev => sym + ' ' + (prev || ''))}
                  className="px-2.5 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[11px] font-bold hover:bg-indigo-100 transition-all shadow-sm border border-indigo-100"
                >
                  {sym}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* INPUT AREA */}
      <form onSubmit={handleSend} className="p-3 border-t border-gray-200 flex gap-2 bg-white">
        {flowMode === 'ADD_PRODUCT' && wizardStep === 4 ? (
          <div className="flex-1 flex items-center gap-2 animate-in slide-in-from-bottom-2 duration-300">
            <input
              type="file"
              accept="image/*"
              id="product-image-upload"
              className="hidden"
              onChange={(e) => wizards.handleImageUpload(e)}
            />
            <label
              htmlFor="product-image-upload"
              className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl cursor-pointer hover:bg-indigo-100 transition-all font-bold text-xs shadow-sm"
            >
              <Plus size={16} /> Choose Image from Device
            </label>
            <button
              type="button"
              onClick={() => wizards.handleImageSkip()}
              className="text-gray-400 text-[11px] font-bold px-3 py-2 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors capitalize"
            >
              Skip
            </button>
          </div>
        ) : (
          <>
            <input
              value={inputText}
              onChange={(e) => {
                let val = e.target.value;
                const currentStepKey = flowMode === 'ADD_WIZARD' ? ADD_BIZ_STEPS[wizardStep]?.key : null;
                if (currentStepKey === 'phone') {
                  val = val.replace(/\D/g, '').slice(0, 10);
                }
                setInputText(val);
              }}
              onKeyDown={handleKeyDown}
              placeholder={UI_TRANSLATIONS[currentLanguage || 'en']?.input_placeholder || UI_TRANSLATIONS.en.input_placeholder}
              className="flex-1 bg-transparent border-none focus:outline-none text-[13px] text-gray-700 disabled:opacity-50"
              disabled={hasThinking(localMessages)}
            />
            <button
              type="submit"
              disabled={!inputText.trim() || hasThinking(localMessages)}
              className="bg-[#4F46E5] text-white p-2 rounded-full px-4 hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:hover:bg-[#4F46E5]"
            >
              ➤
            </button>
          </>
        )}
      </form>

      {showLoginPopup && <LoginPopup onClose={() => setShowLoginPopup(false)} onSuccess={handleLoginSuccess} />}

      {/* RESET CONFIRMATION POPUP */}
      {showResetConfirm && (
        <>
          <div className="absolute inset-0 bg-black/30 z-40 rounded-2xl" onClick={() => setShowResetConfirm(false)} />
          <div className="absolute inset-0 flex items-center justify-center z-50 p-6">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[280px] overflow-hidden" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
              <div className="px-5 pt-5 pb-3 text-center">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
                  <RefreshCw size={22} className="text-red-500" />
                </div>
                <h3 className="text-sm font-bold text-gray-800 mb-1">{UI_TRANSLATIONS[currentLanguage || 'en']?.btn_reset}</h3>
                <p className="text-[11px] text-gray-500 leading-relaxed">{UI_TRANSLATIONS[currentLanguage || 'en']?.reset_warn?.replace('⚠️ ', '').split('?')[0]}?</p>
              </div>
              <div className="flex border-t border-gray-100">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 py-3 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors border-r border-gray-100"
                >
                  {UI_TRANSLATIONS[currentLanguage || 'en']?.btn_back}
                </button>
                <button
                  onClick={() => handleAction('confirm_reset')}
                  className="flex-1 py-3 text-xs font-bold text-red-500 hover:bg-red-50 transition-colors"
                >
                  {UI_TRANSLATIONS[currentLanguage || 'en']?.btn_reset}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default ChatWidget