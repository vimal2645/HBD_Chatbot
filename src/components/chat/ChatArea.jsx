import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  X, Globe, ChevronDown, MoreVertical, Plus, Search, RefreshCw, LogIn,
  Settings, MessageSquare, Trash2, Clock, Mic, MicOff, Send, ArrowUp
} from 'lucide-react';
import MessageItem from '../MessageItem';
import LoginPopup from '../LoginPopup';
import TypingIndicator from './TypingIndicator';
import { INDIAN_LANGUAGES } from '../../constants/Languages';
import { UI_TRANSLATIONS } from '../../constants/Translations';
import { api } from '../../services/api';
import { useChatMemory } from '../../hooks/useChatMemory';
import { useChatWizards, ADD_BIZ_STEPS, getAddProductSteps, getAddDealSteps } from '../../hooks/useChatWizards';

const ChatArea = (props) => {
  const {
    // Sidebar integration
    isLoggedIn, setIsLoggedIn,
    session, setSession,
    currentSessionId, setCurrentSessionId,
    chatList, setChatList,
    chatListLoading, setChatListLoading,
    // Toast
    toast,
    // Initial query (from home page search)
    initialQuery,
    onClearInitialQuery,
    initialAction,
    onClearInitialAction,
    // Floating widget support
    isFloating = false,
    onClose,

    // Lifted memory states and handlers from props (originally from useChatMemory)
    localMessages, setLocalMessages,
    currentLanguage, setCurrentLanguage,
    flowMode, setFlowMode,
    wizardStep, setWizardStep,
    wizardData, setWizardData,
    pendingUpdateField, setPendingUpdateField,
    getUserId,
    startNewSession,
    handleNewChat,
    handleLoadSession,
    handleDeleteSession,
    handleRenameSession,
    handlePinSession,
  } = props;

  const [inputText, setInputText] = useState('');
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [resetConfirmCount, setResetConfirmCount] = useState(0);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [msgHistory, setMsgHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const [backendHealth, setBackendHealth] = useState('checking');
  const [autocompleteOptions, setAutocompleteOptions] = useState([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [compareList, setCompareList] = useState([]);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [comparisonData, setComparisonData] = useState([]);
  const [isComparingLoading, setIsComparingLoading] = useState(false);
  const [thinkingStatus, setThinkingStatus] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [otpResent, setOtpResent] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const hasThinking = (msgs) => msgs.some(m => m.type === 'thinking');
  const isThinking = hasThinking(localMessages);

  const addThinking = () => setLocalMessages(prev =>
    prev.some(m => m.type === 'thinking') ? prev : [...prev, { id: 'thinking', role: 'bot', type: 'thinking' }]
  );
  const removeThinking = () => setLocalMessages(prev => prev.filter(m => m.type !== 'thinking'));

  // ── HOOKS ─────────────────────────────────────────────
  const wizards = useChatWizards({
    session, currentLanguage, setLocalMessages, addThinking, removeThinking,
    setSession, setIsLoggedIn, setQuickActionsView: () => { },
    flowMode, setFlowMode,
    wizardStep, setWizardStep,
    wizardData, setWizardData,
    pendingUpdateField, setPendingUpdateField,
    selectedBusiness,
  });

  // ── SCROLL TO BOTTOM ─────────────────────────────────
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [localMessages]);

  // ── LANGUAGE CHANGE & INITIAL MESSAGE ───────────────────────────────────
  useEffect(() => {
    const lang = currentLanguage || 'en';
    const trans = UI_TRANSLATIONS[lang] || UI_TRANSLATIONS.en;

    if (localMessages.length <= 2 && localMessages.every(m => m.id === 'init' || m.id === 'hint')) {
      setLocalMessages([
        {
          id: 'init',
          role: 'bot',
          type: 'faq',
          content: "👋 Welcome to HoneyBee Digital!\n\nI'm your AI Customer Support Assistant.\n\nI can help you explore businesses, products and other information available in our database.\n\nHow can I help you today?",
          suggestions: [
            { title: "🏢 Explore Listings", action: "query_rewrite", query: "Explore Listings" },
            { title: "📦 Browse Products", action: "query_rewrite", query: "Browse Products" },
            { title: "📂 Browse Categories", action: "query_rewrite", query: "Browse Categories" },
            { title: "📍 Browse Locations", action: "query_rewrite", query: "Browse Locations" },
            { title: "⭐ Top Rated Businesses", action: "query_rewrite", query: "Top Rated Businesses" },
            { title: "🔥 Trending Products", action: "query_rewrite", query: "Trending Products" },
            { title: "🆕 Recently Added", action: "query_rewrite", query: "Recently Added" },
            { title: "❓ Help", action: "query_rewrite", query: "Help" }
          ]
        }
      ]);
    }
  }, [currentLanguage]);

  // Autocomplete debounce effect
  useEffect(() => {
    if (!inputText.trim()) {
      setAutocompleteOptions([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      try {
        const res = await api.getAiSuggestions(inputText, currentLanguage, "QUERY");
        if (res && res.suggestions) {
          setAutocompleteOptions(res.suggestions);
        }
      } catch (err) {
        // Silently ignore autocomplete errors (404, network, etc.)
        setAutocompleteOptions([]);
      }
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [inputText, currentLanguage]);

  const handleCompareSubmit = async () => {
    if (compareList.length < 2) {
      toast?.warning("Select at least 2 businesses to compare");
      return;
    }
    setIsCompareOpen(true);
    setIsComparingLoading(true);
    try {
      const ids = compareList.map(b => b.global_business_id);
      const data = await api.compareBusinesses(ids);
      setComparisonData(data);
    } catch (err) {
      toast?.error("Failed to fetch comparison data");
      setIsCompareOpen(false);
    } finally {
      setIsComparingLoading(false);
    }
  };

  // ── AUTO SESSION ON LOGIN ─────────────────────────────
  useEffect(() => {
    if (isLoggedIn && !currentSessionId && getUserId()) {
      startNewSession();
    }
  }, [isLoggedIn, session, currentSessionId, startNewSession, getUserId]);

  // ── AUTO-SYNC SELECTED BUSINESS STATE ─────────────────
  useEffect(() => {
    if (session && session.businessId && (!selectedBusiness || selectedBusiness.global_business_id !== session.businessId)) {
      setSelectedBusiness({
        global_business_id: session.businessId,
        business_name: session.businessName || "My Business",
        city: session.city || ""
      });
    }
  }, [session, selectedBusiness]);

  // ── HEALTH CHECK ──────────────────────────────────────
  const checkHealth = useCallback(async () => {
    try { await api.checkHealth(); setBackendHealth('Connected'); }
    catch { setBackendHealth('Offline'); }
  }, []);

  useEffect(() => {
    checkHealth();
    const i = setInterval(checkHealth, 10000);
    return () => clearInterval(i);
  }, [checkHealth]);

  // ── AUTO-SAVE GUEST MESSAGES & TITLE ─────────────────
  useEffect(() => {
    if (currentSessionId && currentSessionId.toString().startsWith('guest_')) {
      // 1. Save messages to localStorage
      try {
        localStorage.setItem('guest_chat_messages_' + currentSessionId, JSON.stringify(localMessages));
      } catch (e) {
        console.error('Error saving guest messages to localStorage:', e);
      }

      // 2. Auto-update session title from first user message if title is still 'New Chat'
      const userMsgs = localMessages.filter(m => m.role === 'user');
      if (userMsgs.length > 0) {
        try {
          const savedChats = localStorage.getItem('guest_chat_list');
          const chats = savedChats ? JSON.parse(savedChats) : [];
          const currentChat = chats.find(c => c.session_id === currentSessionId);

          if (currentChat && currentChat.title === 'New Chat') {
            const firstMsg = userMsgs[0].content || '';
            const newTitle = firstMsg.trim().substring(0, 30) || 'New Chat';
            const updatedChats = chats.map(c =>
              c.session_id === currentSessionId ? { ...c, title: newTitle, updated_at: new Date().toISOString() } : c
            );
            localStorage.setItem('guest_chat_list', JSON.stringify(updatedChats));

            // Sync the sidebar chatList state
            if (setChatList) {
              setChatList(updatedChats);
            }
          }
        } catch (e) {
          console.error('Error updating guest session title:', e);
        }
      }
    }
  }, [localMessages, currentSessionId, setChatList]);

  // ── INITIAL QUERY ─────────────────────────────────────
  useEffect(() => {
    if (initialQuery) {
      setFlowMode('QUERY');
      setWizardStep(0);
      setWizardData({});
      setPendingUpdateField(null);
      handleSend(null, initialQuery);
      onClearInitialQuery?.();
    }
  }, [initialQuery]);

  useEffect(() => {
    if (initialAction) {
      handleAction(initialAction);
      onClearInitialAction?.();
    }
  }, [initialAction]);

  // ── VOICE INPUT ───────────────────────────────────────
  const toggleVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast?.warning('Voice input is not supported in this browser.');
      return;
    }
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = currentLanguage === 'hi' ? 'hi-IN' : 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInputText(prev => prev + transcript);
      setIsRecording(false);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
  };

  // ── BACK HANDLER ──────────────────────────────────────
  const handleBack = () => {
    const lang = currentLanguage || 'en';
    const trans = UI_TRANSLATIONS[lang] || UI_TRANSLATIONS.en;

    if (flowMode === 'ADD_WIZARD' || flowMode === 'ADD_PRODUCT' || flowMode === 'ADD_DEAL') {
      if (wizardStep > 0) {
        setWizardStep(prev => prev - 1);
        const stepList = flowMode === 'ADD_WIZARD' ? ADD_BIZ_STEPS
          : flowMode === 'ADD_PRODUCT' ? getAddProductSteps(trans) : getAddDealSteps(trans);
        const prevStep = stepList[wizardStep - 1];
        setLocalMessages(prev => [...prev, {
          id: Date.now(), role: 'bot', type: 'text',
          content: prevStep.prompt || trans[prevStep.promptKey] || prevStep.promptKey
        }]);
      } else {
        setFlowMode('QUERY');
      }
      return;
    }
    if (flowMode === 'SEARCH_NAME' || flowMode === 'SEARCH_ADDR') {
      setLocalMessages(prev => [...prev, { id: Date.now(), role: 'user', type: 'text', content: trans.btn_back }]);
      setFlowMode('QUERY');
      setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: trans.cancel_search }]);
      return;
    }
    if (flowMode === 'UPDATE_VALUE') {
      setLocalMessages(prev => [...prev, { id: Date.now(), role: 'user', type: 'text', content: trans.btn_back }]);
      setFlowMode('QUERY');
      setPendingUpdateField(null);
      setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: trans.cancel_update }]);
    }
  };

  // ── LOGOUT ─────────────────────────────────────────────
  const handleLogout = () => {
    const lang = currentLanguage || 'en';
    const trans = UI_TRANSLATIONS[lang] || UI_TRANSLATIONS.en;
    setIsLoggedIn(false);
    setSession({ type: 'GUEST', phone: null, businessId: null });
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('session');
    setCurrentSessionId(null);
    setChatList([]);
    setFlowMode('QUERY');
    setWizardStep(0);
    setWizardData({});
    setLocalMessages([
      { id: 'init', role: 'bot', type: 'text', content: trans.welcome || trans.welcome_message },
      { id: 'hint', role: 'bot', type: 'text', content: trans.menu_hint || "💡 Click the ⋮ menu at the top for more options." }
    ]);
    toast?.success('Logged out successfully');
  };

  // ── EXPORT CHAT CONVERSATION ────────────────────────────
  const handleExportChat = () => {
    try {
      let textContent = `==================================================\n`;
      textContent += `          CITYHANGAROUNDS CHAT CONVERSATION LOG   \n`;
      textContent += `==================================================\n`;
      textContent += `Export Date: ${new Date().toLocaleString()}\n`;
      textContent += `Session ID: ${currentSessionId || 'N/A'}\n`;
      textContent += `Language: ${currentLanguage || 'en'}\n`;
      textContent += `User: ${session?.phone || session?.email || 'Guest'}\n`;
      textContent += `==================================================\n\n`;

      localMessages.forEach((msg, idx) => {
        if (msg.type === 'thinking') return;
        const roleName = msg.role === 'user' ? 'USER' : 'AI ASSISTANT';

        // Simple human-readable representation of time
        textContent += `[${roleName}]:\n`;

        if (msg.type === 'text' || msg.type === 'faq') {
          textContent += `${msg.content}\n`;
        } else if (msg.type === 'database') {
          textContent += `${msg.intro || 'Results found:'}\n`;
          const items = Array.isArray(msg.content) ? msg.content : Array.isArray(msg.data) ? msg.data : [];
          items.forEach((biz, bidx) => {
            textContent += `  ${bidx + 1}. ${biz.business_name} | ${biz.business_category || 'Business'} | Rating: ${biz.ratings || '0.0'} (${biz.reviews_count || 0} reviews)\n`;
            textContent += `     Address: ${biz.address || 'N/A'} | Phone: ${biz.phone_number || 'N/A'}\n`;
            if (biz.website_url) textContent += `     Website: ${biz.website_url}\n`;
          });
        } else if (msg.type === 'suggestions') {
          textContent += `${msg.intro || 'Suggested profile updates:'}\n`;
          (msg.content || []).forEach((s, sidx) => {
            textContent += `  - ${s.title}: ${s.reason}\n`;
          });
        } else if (msg.type === 'manage_products') {
          textContent += `${msg.intro || 'Products list:'}\n`;
          (msg.content || []).forEach((p, pidx) => {
            textContent += `  - ${p.name} (Price: ₹${p.price}) | ${p.description || ''}\n`;
          });
        } else if (msg.type === 'manage_deals') {
          textContent += `${msg.intro || 'Deals list:'}\n`;
          (msg.content || []).forEach((d, didx) => {
            textContent += `  - ${d.title} (${d.discount_pct}% OFF) | Expires: ${d.expiry_date || 'N/A'}\n`;
          });
        } else {
          textContent += `${String(msg.content || '')}\n`;
        }
        textContent += `\n--------------------------------------------------\n\n`;
      });

      textContent += `==================================================\n`;
      textContent += `             END OF CONVERSATION LOG              \n`;
      textContent += `==================================================\n`;

      // Trigger download
      const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `HBD_Chat_Session_${currentSessionId || 'export'}_${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast?.success('Conversation exported successfully!');
    } catch (e) {
      console.error('Export failed:', e);
      toast?.error('Failed to export conversation.');
    }
  };

  // ── LOGIN SUCCESS ─────────────────────────────────────
  const handleLoginSuccess = async (identifier, method = 'phone') => {
    try {
      const res = await api.login(identifier, method);
      if (res.status === 'error') throw new Error(res.message);
      setShowLoginPopup(false);
      const trans = UI_TRANSLATIONS[currentLanguage || 'en'] || UI_TRANSLATIONS.en;
      if (res.status === 'logged_in' && res.businesses?.length) {
        const biz = res.businesses[0];
        const sessionData = {
          type: 'BUSINESS',
          businessId: biz.global_business_id,
          businessName: biz.business_name,
          city: biz.city
        };
        if (method === 'phone') sessionData.phone = identifier;
        else { sessionData.email = identifier; if (biz.phone_number) sessionData.phone = biz.phone_number; }
        setSession(sessionData);
        setIsLoggedIn(true);
        setLocalMessages(prev => [...prev, {
          id: Date.now(), role: 'bot', type: 'text',
          content: `👋 ${trans.welcome_back || 'Welcome back'}, ${biz.business_name}!`
        }]);
        toast?.success(`Welcome back, ${biz.business_name}!`);
      } else {
        const sessionData = { type: 'REGISTERED' };
        if (method === 'phone') sessionData.phone = identifier;
        else sessionData.email = identifier;
        setSession(sessionData);
        setIsLoggedIn(true);
        setLocalMessages(prev => [...prev,
        { id: Date.now(), role: 'bot', type: 'text', content: trans.welcome },
        { id: Date.now() + 1, role: 'bot', type: 'text', content: trans.menu_hint || "💡 Click the ⋮ menu for more actions." }
        ]);
        toast?.info('Logged in. No business found — you can add one!');
      }
    } catch (e) {
      toast?.error(`Login error: ${e.message}`);
    }
  };

  // ── SEND MESSAGE ──────────────────────────────────────
  const handleSend = async (e, overrideText = null) => {
    if (e) e.preventDefault();
    const text = (overrideText || inputText).trim();
    if (!text || isThinking) return;
    setInputText('');
    setLocalMessages(prev => [...prev, { id: Date.now(), role: 'user', type: 'text', content: text }]);
    setMsgHistory(prev => prev[prev.length - 1] === text ? prev : [...prev, text]);
    setHistoryIndex(-1);

    // Set status and add thinking
    setThinkingStatus('Analyzing query...');
    addThinking();

    let statusInterval = null;
    let elapsed = 0;
    statusInterval = setInterval(() => {
      elapsed += 0.5;
      if (elapsed >= 5.0) {
        setThinkingStatus('Finalizing response...');
      } else if (elapsed >= 2.5) {
        const isSearch = /restaurant|gym|hotel|shop|store|doctor|dentist|salon|spa|listing|business|in|near|find|search|where|online|scrape/i.test(text);
        if (isSearch) {
          setThinkingStatus('Scraping online web listings...');
        } else {
          setThinkingStatus('Synthesizing answer...');
        }
      } else if (elapsed >= 1.0) {
        setThinkingStatus('Searching database...');
      }
    }, 500);

    try {
      const lang = currentLanguage || 'en';
      const trans = UI_TRANSLATIONS[lang] || UI_TRANSLATIONS.en;
      console.log("BEFORE", {
        flowMode,
        wizardStep,
        text
      });
      const wasWizardFlow = await wizards.handleWizardSend(text, trans);
      console.log("AFTER", {
        flowMode,
        wizardStep,
        wasWizardFlow
      });
      if (wasWizardFlow) {
        clearInterval(statusInterval);
        setThinkingStatus('');
        return;
      }

      let activeSessionId = currentSessionId;
      if (!activeSessionId) {
        activeSessionId = await startNewSession();
      }

      const data = await api.query({ query: text, session, language: lang, session_id: activeSessionId });
      clearInterval(statusInterval);
      setThinkingStatus('');
      removeThinking();

      // Re-fetch chat list to update sidebar titles in real-time
      if (setChatList && activeSessionId) {
        const uId = getUserId();
        if (uId) {
          api.listChatSessions(uId)
            .then(list => setChatList(Array.isArray(list) ? list : []))
            .catch(err => console.error("Error updating sidebar list:", err));
        }
      }

      const responseType = data.type || 'text';
      if (responseType === 'command') { handleAction(data.command); return; }

      setLocalMessages(prev => [...prev, {
        id: Date.now(), role: 'bot', type: responseType,
        content: data.data || data.content || (trans.fallback_response || 'I am not sure about that.'),
        intro: data.intro, suggestions: data.suggestions, prompt: data.prompt,
        search_metadata: data.search_metadata || null,
        context: data.context || null
      }]);
    } catch (e) {
      clearInterval(statusInterval);
      setThinkingStatus('');
      removeThinking();
      const lang = currentLanguage || 'en';
      const trans = UI_TRANSLATIONS[lang] || UI_TRANSLATIONS.en;
      setLocalMessages(prev => [...prev, {
        id: Date.now(), role: 'bot', type: 'text',
        content: `⚠️ ${trans.generic_error || 'Something went wrong.'} (${e.message})`
      }]);
      toast?.error('Failed to get response. Check your connection.');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowUp' && msgHistory.length > 0) {
      e.preventDefault();
      const nextIdx = historyIndex + 1;
      if (nextIdx < msgHistory.length) {
        setHistoryIndex(nextIdx);
        setInputText(msgHistory[msgHistory.length - 1 - nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = historyIndex - 1;
      if (nextIdx >= 0) {
        setHistoryIndex(nextIdx);
        setInputText(msgHistory[msgHistory.length - 1 - nextIdx]);
      } else {
        setHistoryIndex(-1);
        setInputText('');
      }
    }
  };

  // ── ACTION HANDLER ────────────────────────────────────
  const handleAction = async (action, payload) => {
    console.log(action);
    // Reset wizard states if starting a new top-level action
    if (['search', 'update', 'add_new_business', 'search_method', 'search_by_name', 'search_by_address', 'start_add_product', 'start_add_deal', 'reset_chat', 'login_trigger'].includes(action)) {
      setFlowMode('QUERY');
      setWizardStep(0);
      setWizardData({});
      setPendingUpdateField(null);
    }

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
      'reset_chat': trans.btn_reset
    };

    if (actionLabels[action]) {
      setLocalMessages(prev => [...prev, { id: Date.now(), role: 'user', type: 'text', content: actionLabels[action] }]);
    }

    if (action === 'next_option' || action === 'prev_option' || action === 'filter_area' || action === 'filter_rating' || action === 'search_another' || action === 'query_rewrite') {
      handleSend(null, payload);
      return;
    }

    if (action === 'toggle_compare') {
      const biz = payload;
      setCompareList(prev => {
        const exists = prev.some(c => Number(c.global_business_id) === Number(biz.global_business_id));
        if (exists) {
          toast?.info(`${biz.business_name} removed from comparison`);
          return prev.filter(c => Number(c.global_business_id) !== Number(biz.global_business_id));
        } else {
          if (prev.length >= 3) {
            toast?.warning("You can compare up to 3 businesses at a time");
            return prev;
          }
          toast?.success(`${biz.business_name} added to comparison`);
          return [...prev, biz];
        }
      });
      return;
    }

    if (action === 'delete_business') {
      if (window.confirm("Are you sure you want to permanently delete this business listing? This will also delete all products and deals associated with it.")) {
        setThinkingStatus('Deleting business listing...');
        addThinking();
        try {
          const res = await api.deleteBusiness(payload);
          setThinkingStatus('');
          removeThinking();
          if (res.success) {
            toast?.success("Business deleted successfully!");
            handleLogout();
          } else {
            toast?.error(res.message || "Failed to delete business.");
          }
        } catch (e) {
          setThinkingStatus('');
          removeThinking();
          toast?.error(e.message || "Failed to delete business.");
        }
      }
      return;
    }

    if (action === 'go_back') return handleBack();
    if (action === 'resend') {
      wizards.handleWizardSend('resend');
      return;
    }
    if (action === 'login_trigger') return setShowLoginPopup(true);
    if (action === 'cancel_sub_menu') return;
    if (action === 'wizard_confirm') {
      wizards.confirmBusinessOnboarding(trans);
      return;
    }
    if (action === 'wizard_edit') {
      wizards.cancelBusinessOnboarding(trans);
      return;
    }

    if (action === 'search_method') {
      setLocalMessages(prev => [...prev, { id: Date.now(), role: 'user', type: 'text', content: trans.btn_find }]);
      setLocalMessages(prev => [...prev, {
        id: Date.now() + 1, role: 'bot', type: 'search_options',
        content: trans.search_by,
        labels: { name: trans.btn_name, address: trans.btn_address }
      }]);
      return;
    }
    if (action === 'search_by_name') { setFlowMode('SEARCH_NAME'); setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: trans.search_prompt }]); }
    if (action === 'search_by_address') { setFlowMode('SEARCH_ADDR'); setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: trans.address_prompt }]); }
    if (action === 'add_new_business') {
      console.log("ADD BUSINESS FIRED");
      console.trace();
      wizards.setWizardStep(ADD_BIZ_STEPS);
      setFlowMode('ADD_WIZARD'); setWizardStep(0);
      const initialData = {};
      if (session.phone) initialData.phone = session.phone;
      if (session.email) initialData.email = session.email;
      setWizardData(initialData);
      setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: trans.prompt_phone }]);
    }

    if (action === 'resend_otp') {
      setOtpResent(true);
      await handleSend(null, 'resend');
      setTimeout(() => setOtpResent(false), 2000);
      return;
    }

    if (action === 'change_email') {
      setWizardData(prev => ({ ...prev, email: '' }));
      setWizardStep(1);
      setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: '📧 Please enter your email address again.' }]);
      return;
    }

    if (action === "cancel_wizard") {
      setFlowMode("QUERY");
      setWizardStep(0);
      setWizardData({});
      setPendingUpdateField(null);
      setLocalMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "bot",
          type: "text",
          content: "✅ Setup cancelled."
        }]);
      return;
    }

    if (action === 'start_add_product') {
      const business = payload || selectedBusiness;
      if (!business) {
        return setShowLoginPopup(true);
      }
      setSelectedBusiness(business);
      const steps = getAddProductSteps(trans);
      setFlowMode('ADD_PRODUCT');
      setWizardStep(0);
      setWizardData({
        business_id: business.global_business_id,
        business_name: business.business_name
      });
      setLocalMessages(prev => [
        ...prev,
        {
          id: Date.now(),
          role: 'bot',
          type: 'text',
          content: steps[0].prompt
        }
      ]);
      return;
    }

    if (action === 'start_add_deal') {
      const business = payload || selectedBusiness;
      if (!business) {
        return setShowLoginPopup(true);
      }
      setSelectedBusiness(business);
      const steps = getAddDealSteps(trans);

      setFlowMode('ADD_DEAL');
      setWizardStep(0);
      setWizardData({
        business_id: business.global_business_id,
        business_name: business.business_name
      });
      setLocalMessages(prev => [
        ...prev,
        {
          id: Date.now(),
          role: 'bot',
          type: 'text',
          content: steps[0].prompt
        }
      ]);

      return;
    }

    if (action === 'reset_chat') { setShowResetConfirm(true); return; }
    if (action === 'confirm_reset') {
      if (currentSessionId && getUserId()) {
        await handleDeleteSession(null, currentSessionId);
      }
      setShowResetConfirm(false);
      // Restore the EXACT same welcome message as the initial load
      setLocalMessages([
        {
          id: 'init',
          role: 'bot',
          type: 'faq',
          content: "👋 Welcome to HoneyBee Digital!\n\nI'm your AI Customer Support Assistant.\n\nI can help you explore businesses, products and other information available in our database.\n\nHow can I help you today?",
          suggestions: [
            { title: "🏢 Explore Listings", action: "query_rewrite", query: "Explore Listings" },
            { title: "📦 Browse Products", action: "query_rewrite", query: "Browse Products" },
            { title: "📂 Browse Categories", action: "query_rewrite", query: "Browse Categories" },
            { title: "📍 Browse Locations", action: "query_rewrite", query: "Browse Locations" },
            { title: "⭐ Top Rated Businesses", action: "query_rewrite", query: "Top Rated Businesses" },
            { title: "🔥 Trending Products", action: "query_rewrite", query: "Trending Products" },
            { title: "🆕 Recently Added", action: "query_rewrite", query: "Recently Added" },
            { title: "❓ Help", action: "query_rewrite", query: "Help" }
          ]
        }
      ]);
      // Reset ALL local state
      setResetConfirmCount(0);
      setFlowMode('QUERY');
      setWizardStep(0);
      setWizardData({});
      setCompareList([]);
      setComparisonData([]);
      setIsCompareOpen(false);
      setIsComparingLoading(false);
      setSelectedBusiness(null);
      setOtpResent(false);
      setAutocompleteOptions([]);
      setShowAutocomplete(false);
      setInputText('');
      return;
    }
    if (action !== 'reset_chat') setResetConfirmCount(0);

    if (action === 'search') {
      setThinkingStatus('Fetching business profile...');
      addThinking();
      try {
        const data = await api.query({ query: 'Show my business', session, language: lang, session_id: currentSessionId });
        setThinkingStatus('');
        removeThinking();
        if (!data || (!data.type && data.detail)) {
          setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: '❌ Could not load your business.' }]);
          return;
        }
        setLocalMessages(prev => [...prev, {
          id: Date.now(), role: 'bot', type: data.type || 'text',
          content: data.content ?? data.data ?? data.detail ?? 'No data found.',
          intro: data.intro, prompt: data.prompt, suggestions: data.suggestions
        }]);
      } catch { setThinkingStatus(''); removeThinking(); toast?.error('Error loading business'); }
    }
    if (action === 'update') {
      //Admin dashboard update
      if (payload) {
        setSelectedBusiness(payload);
        const fields = ["Business Name", "Category", "Phone Number", "Address", "Area", "City", "State", "Website"];
        setLocalMessages(prev => [...prev, {
          id: Date.now(), role: "bot", type: "suggestions",
          intro: `✏️ Updating: ${payload.business_name}\n\n What would you like to update?`, content: fields.map(f => ({ title: `Update ${f}`, action: `Update ${f}` }))
        }
        ]);
        return;
      }

      // Existing quick-action flow
      setThinkingStatus('Loading your businesses...');
      addThinking();
      try {
        const data = await api.query({ query: 'Update my business', session, language: lang, session_id: currentSessionId });
        removeThinking();
        setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: data.type, content: data.data, intro: data.intro, mode: data.mode }]);
      } catch (e) {
        removeThinking();
      }
      return;
    }

    if (action === 'select_business_for_update') {
      setSelectedBusiness(payload);
      const fields = ["Business Name", "Category", "Phone Number", "Address", "Area", "City", "State", "Website"];
      setLocalMessages(prev => [...prev, {
        id: Date.now(), role: "bot", type: "suggestions", intro: `✏️Updating: ${payload.business_name}\n\n What would you like to update?`, content: fields.map(f => ({ title: `Update ${f}`, action: `Update ${f}` }))
      }]);
      return;
    }

    if (action === 'update_specific') {
      const field = payload;
      setPendingUpdateField(field);
      setFlowMode('UPDATE_VALUE');
      setLocalMessages(prev => [...prev, {
        id: Date.now(), role: 'bot', type: 'text',
        content: `${trans.update_prompt || 'Please enter your new'} ${field.replace('_', ' ')}:`
      }]);
    }
    if (action?.startsWith('Update ')) {
      const field = action.replace('Update ', '').toLowerCase().replace(' ', '_');
      setPendingUpdateField(field);
      setFlowMode('UPDATE_VALUE');
      setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: `${trans.update_prompt} ${field.replace('_', ' ')}:` }]);
    }
    if (action === 'claim_business') {
      const verMsg = trans.claim_verification
        ? trans.claim_verification.replace('this business', `"${payload.business_name}"`)
        : `To manage "${payload.business_name}", we need to verify your ownership via phone.`;
      setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: verMsg }]);
      setShowLoginPopup(true);
    }
    if (action === 'manage_products') {
      addThinking();
      try {
        const business = payload || selectedBusiness;
        const data = await api.query({ query: 'manage product', business_id: business.global_business_id, session, language: lang, session_id: currentSessionId });
        removeThinking();
        setLocalMessages(prev => [...prev, {
          id: Date.now(), role: 'bot',
          type: data.type === 'manage_products' ? 'manage_products' : 'text',
          content: data.content !== undefined ? data.content : (data.data || ''),
          intro: data.intro
        }]);
      } catch { removeThinking(); }
    }
    if (action === 'manage_deals') {
      addThinking();
      try {
        const business = payload || selectedBusiness;
        const data = await api.query({ query: 'manage deal', business_id: business.global_business_id, session, language: lang, session_id: currentSessionId });
        removeThinking();
        setLocalMessages(prev => [...prev, {
          id: Date.now(), role: 'bot',
          type: data.type === 'manage_deals' ? 'manage_deals' : 'text',
          content: data.content !== undefined ? data.content : (data.data || ''),
          intro: data.intro
        }]);
      } catch { removeThinking(); }
    }
    if (action === 'delete_product') {
      const res = await api.deleteProduct(payload);
      if (res.success) {
        setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: '🗑️ Product removed successfully!' }]);
        toast?.success('Product deleted');
        setTimeout(() => handleAction('manage_products'), 300);
      }
    }
    if (action === 'delete_deal') {
      const res = await api.deleteDeal(payload);
      if (res.success) {
        setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: '🗑️ Deal removed successfully!' }]);
        toast?.success('Deal deleted');
        setTimeout(() => handleAction('manage_deals'), 300);
      }
    }
  };

  // Only messages that are visible (filter out thinking — shown by TypingIndicator)
  const visibleMessages = localMessages.filter(m => m.type !== 'thinking');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', position: 'relative' }}>

      {/* ── HEADER ─────────────────────────────────── */}
      <div style={{
        padding: '12px 16px',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        flexShrink: 0,
      }}>
        {/* Left: Brand + Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
            borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, boxShadow: '0 4px 12px rgba(79,70,229,0.3)',
          }}>
            🐝
          </div>
          <div>
            <h2 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
              CityHangAround AI
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <div className={`status-dot ${backendHealth === 'Connected' ? 'online' : backendHealth === 'Offline' ? 'offline' : 'checking'}`} />
              <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {backendHealth === 'Connected' ? 'Online' : backendHealth === 'Offline' ? 'Offline' : 'Connecting...'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Language selector */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)',
                borderRadius: 8, cursor: 'pointer', transition: 'all var(--transition-fast)',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
              aria-label="Change language"
            >
              <Globe size={13} style={{ color: 'var(--color-primary)' }} />
              <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase' }}>{currentLanguage}</span>
              <ChevronDown size={11} style={{ color: 'var(--text-muted)', transform: isLangMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }} />
            </button>
            {isLangMenuOpen && (
              <div style={{
                position: 'absolute', right: 0, top: '100%', marginTop: 6,
                width: 160, background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-xl)',
                overflow: 'hidden', zIndex: 50, animation: 'scaleIn 150ms ease',
              }}>
                <div style={{ maxHeight: 220, overflowY: 'auto' }} className="no-scrollbar">
                  {INDIAN_LANGUAGES.map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => { setCurrentLanguage(lang.code); setIsLangMenuOpen(false); }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 14px', border: 'none', background: currentLanguage === lang.code ? 'var(--color-primary-light)' : 'transparent',
                        cursor: 'pointer', fontSize: '0.8rem',
                        fontWeight: currentLanguage === lang.code ? 700 : 500,
                        color: currentLanguage === lang.code ? 'var(--color-primary)' : 'var(--text-secondary)',
                        transition: 'background var(--transition-fast)',
                      }}
                      onMouseEnter={e => { if (currentLanguage !== lang.code) e.currentTarget.style.background = 'var(--bg-surface-2)'; }}
                      onMouseLeave={e => { if (currentLanguage !== lang.code) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span>{lang.name}</span>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', opacity: 0.7 }}>{lang.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions menu */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setIsActionsMenuOpen(!isActionsMenuOpen)}
              style={{
                padding: 7, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: isActionsMenuOpen ? 'var(--color-primary-light)' : 'transparent',
                color: isActionsMenuOpen ? 'var(--color-primary)' : 'var(--text-muted)',
                transition: 'all var(--transition-fast)',
              }}
              onMouseEnter={e => { if (!isActionsMenuOpen) { e.currentTarget.style.background = 'var(--bg-surface-2)'; } }}
              onMouseLeave={e => { if (!isActionsMenuOpen) { e.currentTarget.style.background = 'transparent'; } }}
              aria-label="More actions"
            >
              <MoreVertical size={17} />
            </button>
            {isActionsMenuOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setIsActionsMenuOpen(false)} />
                <div style={{
                  position: 'absolute', right: 0, top: '100%', marginTop: 6,
                  width: 220, background: 'var(--bg-surface)', borderRadius: 'var(--radius-xl)',
                  border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-xl)', zIndex: 50,
                  overflow: 'hidden', animation: 'scaleIn 150ms ease',
                }}>
                  <div style={{ padding: '10px 14px 8px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'white' }}>Actions</p>
                  </div>
                  <div style={{ padding: '6px 0' }}>
                    {!isLoggedIn ? (
                      <>
                        <MenuBtn icon={<LogIn size={14} className="text-indigo-500" />} label={UI_TRANSLATIONS[currentLanguage || 'en']?.btn_phone || 'Login'} onClick={() => { setIsActionsMenuOpen(false); handleAction('login_trigger'); }} />
                        <MenuBtn icon={<Search size={14} style={{ color: '#3b82f6' }} />} label={UI_TRANSLATIONS[currentLanguage || 'en']?.btn_find || 'Find Business'} onClick={() => { setIsActionsMenuOpen(false); handleAction('search_method'); }} />
                      </>
                    ) : (
                      <>
                        <MenuBtn icon={<Search size={14} style={{ color: '#3b82f6' }} />} label={UI_TRANSLATIONS[currentLanguage || 'en']?.btn_show_biz || 'Show Business'} onClick={() => { setIsActionsMenuOpen(false); handleAction('search'); }} />
                        <MenuBtn icon={<RefreshCw size={14} style={{ color: '#10b981' }} />} label={UI_TRANSLATIONS[currentLanguage || 'en']?.btn_update_biz || 'Update Business'} onClick={() => { setIsActionsMenuOpen(false); handleAction('update'); }} />
                      </>
                    )}
                    <MenuBtn icon={<Plus size={14} style={{ color: '#10b981' }} />} label={UI_TRANSLATIONS[currentLanguage || 'en']?.btn_add || 'Add Business'} onClick={() => { setIsActionsMenuOpen(false); handleAction('add_new_business'); }} />
                    <MenuBtn icon={<svg viewBox="0 0 24 24" width="14" height="14" stroke="#059669" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>} label="Export Chat" onClick={() => { setIsActionsMenuOpen(false); handleExportChat(); }} />
                    <div style={{ margin: '4px 12px', borderTop: '1px solid var(--border-subtle)' }} />
                    <MenuBtn icon={<RefreshCw size={14} style={{ color: 'var(--color-error)' }} />} label={UI_TRANSLATIONS[currentLanguage || 'en']?.btn_reset || 'Reset Chat'} onClick={() => { setIsActionsMenuOpen(false); handleAction('reset_chat'); }} color="error" />
                    {isLoggedIn && (
                      <MenuBtn icon={<LogIn size={14} style={{ color: 'var(--text-muted)', transform: 'rotate(180deg)' }} />} label={UI_TRANSLATIONS[currentLanguage || 'en']?.logout || 'Logout'} onClick={() => { setIsActionsMenuOpen(false); handleLogout(); }} />
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
          {isFloating && (
            <button
              onClick={onClose}
              style={{
                padding: 7, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: 'transparent', color: 'var(--text-muted)',
                transition: 'all var(--transition-fast)',
                display: 'flex', alignItems: 'center', justifyItems: 'center',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-surface-2)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              aria-label="Close chat"
            >
              <X size={17} />
            </button>
          )}
        </div>
      </div>

      {/* ── BACKEND OFFLINE BANNER ───────────────── */}
      {backendHealth === 'Offline' && (
        <div style={{
          padding: '10px 16px',
          background: '#fef3c7',
          borderBottom: '1px solid #fde68a',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
          animation: 'slideUp 200ms ease',
        }}>
          <div>
            <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#92400e' }}>⚠️ Backend Offline</p>
            <p style={{ fontSize: '0.75rem', color: '#b45309' }}>
              Start the backend server on port 5000 to use the chatbot.
            </p>
          </div>
          <button
            onClick={checkHealth}
            style={{
              padding: '5px 12px', background: '#f59e0b', color: 'white',
              border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* ── MESSAGES AREA ────────────────────────── */}
      <div
        style={{ flex: 1, overflowY: 'auto', padding: '16px' }}
        className="no-scrollbar"
      >
        <>
          {visibleMessages.map(msg => (
            <MessageItem
              key={msg.id}
              message={msg}
              onAction={handleAction}
              isLoggedIn={isLoggedIn}
              session={session}
              language={currentLanguage}
              compareList={compareList}
            />
          ))}
          {isThinking && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <TypingIndicator status={thinkingStatus} />

              {/* Shimmering Skeleton Loader for Business Cards */}
              {(thinkingStatus.includes('Scraping') || thinkingStatus.includes('Searching')) && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: 14,
                  width: '100%',
                  marginTop: 4,
                  animation: 'scaleIn 200ms ease'
                }}>
                  {[...Array(3)].map((_, idx) => (
                    <div key={idx} style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-lg)',
                      height: 180,
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      overflow: 'hidden',
                      position: 'relative'
                    }}>
                      {/* Title shimmer */}
                      <div style={{ height: 16, width: '70%', background: 'var(--bg-surface-2)', borderRadius: 4 }} className="shimmer" />
                      {/* Subtitle shimmer */}
                      <div style={{ height: 12, width: '40%', background: 'var(--bg-surface-2)', borderRadius: 4 }} className="shimmer" />
                      {/* Address shimmer */}
                      <div style={{ height: 10, width: '90%', background: 'var(--bg-surface-2)', borderRadius: 4, marginTop: 'auto' }} className="shimmer" />
                      {/* Actions row shimmer */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
                        {[...Array(4)].map((_, i) => (
                          <div key={i} style={{ height: 20, borderRadius: 6, background: 'var(--bg-surface-2)' }} className="shimmer" />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
        <div ref={messagesEndRef} />
      </div>



      {/* ── INPUT BAR ─────────────────────────────── */}
      {flowMode === 'ADD_PRODUCT' && wizardStep === 4 ? (
        <div style={{
          padding: '12px 16px', borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)', display: 'flex', gap: 8, flexShrink: 0,
        }}>
          <input type="file" accept="image/*" id="product-image-upload" style={{ display: 'none' }}
            onChange={e => wizards.handleImageUpload(e)} />
          <label
            htmlFor="product-image-upload"
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '10px 16px', background: 'var(--color-primary-light)', color: 'var(--color-primary)',
              border: '1px solid var(--color-primary-border)', borderRadius: 'var(--radius-md)',
              cursor: 'pointer', fontWeight: 700, fontSize: '0.8125rem',
            }}
          >
            <Plus size={15} /> Choose Image
          </label>
          <button
            type="button"
            onClick={() => wizards.handleImageSkip()}
            style={{
              padding: '10px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
              background: 'transparent', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
              color: 'var(--text-muted)',
            }}
          >
            Skip
          </button>
        </div>
      ) : (
        <form
          onSubmit={handleSend}
          style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
            flexShrink: 0,
          }}
        >
          {(flowMode === "ADD_WIZARD" || flowMode === "ADD_PRODUCT" || flowMode === "ADD_DEAL" || flowMode === "UPDATE_VALUE") && (<div style={{ display: "flex", gap: "10px", padding: "10px 14px", overflowX: "auto", borderTop: "1px solid var(--border-subtle)", background: "var(--bg-primary)" }}> <button type="button" onClick={() => handleAction("cancel_wizard")} style={{ background: "var(--bg-surface-2)", color: "var(--text-primary)", border: "1px solid var(--border-subtle)", borderRadius: "999px", padding: "10px 90px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", fontSize: "13px", transition: "0.2s" }} onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px) scale(1.04)"; e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.18)"; e.currentTarget.style.background = "var(--color-primary)"; e.currentTarget.style.color = "#fff"; }} onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0) scale(1)"; e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.08)"; e.currentTarget.style.background = "var(--bg-surface-2)"; e.currentTarget.style.color = "var(--text-primary)"; }} onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.97)"; }} onMouseUp={(e) => { e.currentTarget.style.transform = "translateY(-3px) scale(1.04)"; }}> ❌ Cancel Setup </button></div>)}

          <div style={{ display: "flex", gap: "10px", padding: "10px 14px", overflowX: "auto", borderTop: "1px solid var(--border-subtle)", background: "var(--bg-primary)" }}>
            <button type="button" onClick={() => handleAction('add_new_business')} style={{ background: "var(--bg-surface-2)", color: "var(--text-primary)", border: "1px solid var(--border-subtle)", borderRadius: "999px", padding: "10px 90px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", fontSize: "13px", transition: "0.2s" }} onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px) scale(1.04)"; e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.18)"; e.currentTarget.style.background = "var(--color-primary)"; e.currentTarget.style.color = "#fff"; }} onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0) scale(1)"; e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.08)"; e.currentTarget.style.background = "var(--bg-surface-2)"; e.currentTarget.style.color = "var(--text-primary)"; }} onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.97)"; }} onMouseUp={(e) => { e.currentTarget.style.transform = "translateY(-3px) scale(1.04)"; }}>➕ Add Business</button>
            <button type="button" onClick={() => handleAction('search')} style={{ background: "var(--bg-surface-2)", color: "var(--text-primary)", border: "1px solid var(--border-subtle)", borderRadius: "999px", padding: "10px 90px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", fontSize: "13px", transition: "0.2s" }} onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px) scale(1.04)"; e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.18)"; e.currentTarget.style.background = "var(--color-primary)"; e.currentTarget.style.color = "#fff"; }} onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0) scale(1)"; e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.08)"; e.currentTarget.style.background = "var(--bg-surface-2)"; e.currentTarget.style.color = "var(--text-primary)"; }} onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.97)"; }} onMouseUp={(e) => { e.currentTarget.style.transform = "translateY(-3px) scale(1.04)"; }}>🏢 My Businesses</button>
            <button type="button" onClick={() => handleAction('update')} style={{ background: "var(--bg-surface-2)", color: "var(--text-primary)", border: "1px solid var(--border-subtle)", borderRadius: "999px", padding: "10px 90px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", fontSize: "13px", transition: "0.2s" }} onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px) scale(1.04)"; e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.18)"; e.currentTarget.style.background = "var(--color-primary)"; e.currentTarget.style.color = "#fff"; }} onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0) scale(1)"; e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.08)"; e.currentTarget.style.background = "var(--bg-surface-2)"; e.currentTarget.style.color = "var(--text-primary)"; }} onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.97)"; }} onMouseUp={(e) => { e.currentTarget.style.transform = "translateY(-3px) scale(1.04)"; }}>✏️ Update Businesses</button>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--bg-surface-2)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xl)',
            padding: '8px 12px',
            transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
          }}
            onFocusCapture={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(79,70,229,0.12)'; }}
            onBlurCapture={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <input
              ref={inputRef}
              value={inputText}
              onChange={e => {
                let val = e.target.value;
                if (flowMode === 'ADD_WIZARD' && ADD_BIZ_STEPS[wizardStep]?.key === 'phone') {
                  val = val.replace(/\D/g, '').slice(0, 10);
                }
                setInputText(val);
              }}
              onKeyDown={handleKeyDown}
              placeholder={UI_TRANSLATIONS[currentLanguage || 'en']?.input_placeholder || 'Ask anything...'}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontSize: '0.875rem', color: 'var(--text-primary)',
              }}
              disabled={isThinking}
              aria-label="Message input"
            />

            {/* Voice button */}
            <button
              type="button"
              onClick={toggleVoice}
              title={isRecording ? 'Stop recording' : 'Voice input'}
              style={{
                padding: 6, borderRadius: 8, border: 'none', background: 'transparent',
                cursor: 'pointer', color: isRecording ? '#ef4444' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', flexShrink: 0,
                transition: 'color var(--transition-fast)',
              }}
            >
              {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
            </button>

            {/* Send button */}
            <button
              type="submit"
              disabled={!inputText.trim() || isThinking}
              style={{
                width: 34, height: 34, borderRadius: '50%', border: 'none',
                background: inputText.trim() && !isThinking ? 'var(--color-primary)' : 'var(--border-default)',
                color: 'white', cursor: inputText.trim() && !isThinking ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'all var(--transition-fast)',
                boxShadow: inputText.trim() && !isThinking ? 'var(--shadow-primary)' : 'none',
              }}
              onMouseEnter={e => { if (inputText.trim() && !isThinking) e.currentTarget.style.background = 'var(--color-primary-hover)'; }}
              onMouseLeave={e => { if (inputText.trim() && !isThinking) e.currentTarget.style.background = 'var(--color-primary)'; }}
              aria-label="Send message"
            >
              <ArrowUp size={16} />
            </button>
          </div>
        </form>
      )}

      {/* ── LOGIN POPUP ───────────────────────────── */}
      {showLoginPopup && (
        <LoginPopup
          onClose={() => setShowLoginPopup(false)}
          onSuccess={handleLoginSuccess}
        />
      )}


      {/* Sticky Comparison Bar at Bottom */}
      {compareList.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: 76,
          left: 16,
          right: 16,
          background: 'rgba(79, 70, 229, 0.95)',
          backdropFilter: 'blur(8px)',
          borderRadius: 'var(--radius-lg)',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: 'white',
          boxShadow: '0 4px 20px rgba(79, 70, 229, 0.35)',
          zIndex: 80,
          animation: 'slideUp 200ms ease'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>📊</span>
            <span style={{ fontSize: '0.8125rem', fontWeight: 700 }}>
              Compare Businesses ({compareList.length} selected)
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setCompareList([])}
              style={{
                background: 'transparent', border: '1px solid rgba(255,255,255,0.4)',
                color: 'white', padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem',
                fontWeight: 600, cursor: 'pointer'
              }}
            >
              Clear
            </button>
            <button
              onClick={handleCompareSubmit}
              disabled={compareList.length < 2}
              style={{
                background: 'white', border: 'none', color: 'var(--color-primary)',
                padding: '4px 12px', borderRadius: 6, fontSize: '0.75rem',
                fontWeight: 700, cursor: compareList.length < 2 ? 'not-allowed' : 'pointer',
                opacity: compareList.length < 2 ? 0.6 : 1
              }}
            >
              Compare Now
            </button>
          </div>
        </div>
      )}

      {/* Comparison Drawer / Modal */}
      {isCompareOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          padding: 16, animation: 'fadeIn 200ms ease'
        }}>
          <div style={{
            background: 'var(--bg-surface)',
            width: '100%',
            maxWidth: 800,
            maxHeight: '90vh',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-xl)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'scaleIn 250ms ease'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                📊 Side-by-Side Business Comparison
              </h3>
              <button
                onClick={() => setIsCompareOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body / Table */}
            <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
              {isComparingLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px' }} />
                  <p style={{ fontSize: '0.875rem' }}>Loading comparison details...</p>
                </div>
              ) : comparisonData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  No comparison data available.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-subtle)' }}>
                      <th style={{ padding: '10px 8px', fontWeight: 700, width: '25%' }}>Features</th>
                      {comparisonData.map((biz, idx) => (
                        <th key={idx} style={{ padding: '10px 8px', fontWeight: 800, color: 'var(--color-primary)' }}>
                          {biz.business_name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px 8px', fontWeight: 600, color: 'var(--text-secondary)' }}>Category</td>
                      {comparisonData.map((biz, idx) => (
                        <td key={idx} style={{ padding: '10px 8px' }}>
                          <span className="badge badge-primary" style={{ fontSize: '0.625rem' }}>
                            {biz.business_category}
                          </span>
                        </td>
                      ))}
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px 8px', fontWeight: 600, color: 'var(--text-secondary)' }}>Rating</td>
                      {comparisonData.map((biz, idx) => (
                        <td key={idx} style={{ padding: '10px 8px', fontWeight: 700, color: '#f59e0b' }}>
                          ★ {Number(biz.ratings).toFixed(1)} ({biz.reviews_count} reviews)
                        </td>
                      ))}
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px 8px', fontWeight: 600, color: 'var(--text-secondary)' }}>Address</td>
                      {comparisonData.map((biz, idx) => (
                        <td key={idx} style={{ padding: '10px 8px', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                          {biz.area ? `${biz.area}, ` : ''}{biz.address}, {biz.city}
                        </td>
                      ))}
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px 8px', fontWeight: 600, color: 'var(--text-secondary)' }}>Phone</td>
                      {comparisonData.map((biz, idx) => (
                        <td key={idx} style={{ padding: '10px 8px' }}>
                          {biz.phone_number ? <a href={`tel:${biz.phone_number}`} style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>{biz.phone_number}</a> : "N/A"}
                        </td>
                      ))}
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px 8px', fontWeight: 600, color: 'var(--text-secondary)' }}>Website</td>
                      {comparisonData.map((biz, idx) => (
                        <td key={idx} style={{ padding: '10px 8px' }}>
                          {biz.website_url ? <a href={biz.website_url.startsWith('http') ? biz.website_url : `https://${biz.website_url}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>Visit site</a> : "N/A"}
                        </td>
                      ))}
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px 8px', fontWeight: 600, color: 'var(--text-secondary)' }}>Active Deals</td>
                      {comparisonData.map((biz, idx) => (
                        <td key={idx} style={{ padding: '10px 8px' }}>
                          {biz.deals && biz.deals.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              {biz.deals.map((d, didx) => (
                                <div key={didx} style={{ background: '#fce7f3', color: '#be185d', padding: '2px 6px', borderRadius: 4, fontSize: '0.6875rem', fontWeight: 700 }}>
                                  🏷️ {d.discount_pct}% OFF: {d.title}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>No active deals</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ── RESET CONFIRMATION ────────────────────── */}
      {showResetConfirm && (
        <>
          <div
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 40, borderRadius: 'inherit' }}
            onClick={() => setShowResetConfirm(false)}
          />
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24,
          }}>
            <div style={{
              background: 'var(--bg-surface)', borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-xl)', width: '100%', maxWidth: 300, overflow: 'hidden',
              animation: 'scaleIn 200ms ease',
            }}>
              <div style={{ padding: '20px 20px 12px', textAlign: 'center' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%', background: 'var(--color-error-light)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
                }}>
                  <RefreshCw size={22} style={{ color: 'var(--color-error)' }} />
                </div>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                  {UI_TRANSLATIONS[currentLanguage || 'en']?.btn_reset || 'Reset Chat'}
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  This will clear the current chat. Are you sure?
                </p>
              </div>
              <div style={{ display: 'flex', borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  style={{
                    flex: 1, padding: '12px', fontSize: '0.8125rem', fontWeight: 600,
                    color: 'var(--text-secondary)', border: 'none', background: 'transparent',
                    cursor: 'pointer', borderRight: '1px solid var(--border-subtle)',
                    transition: 'background var(--transition-fast)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-surface-2)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleAction('confirm_reset')}
                  style={{
                    flex: 1, padding: '12px', fontSize: '0.8125rem', fontWeight: 700,
                    color: 'var(--color-error)', border: 'none', background: 'transparent',
                    cursor: 'pointer', transition: 'background var(--transition-fast)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-error-light)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Menu button helper
function MenuBtn({ icon, label, onClick, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 14px', border: 'none', background: 'transparent',
        cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 500,
        color: color === 'error' ? 'var(--color-error)' : 'var(--text-secondary)',
        transition: 'background var(--transition-fast)',
        textAlign: 'left',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = color === 'error' ? 'var(--color-error-light)' : 'var(--bg-surface-2)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{
        width: 30, height: 30, borderRadius: 8,
        background: 'var(--bg-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </span>
      {label}
    </button>
  );
}

export default ChatArea;
