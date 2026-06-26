const handleResponse = async (response) => {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.detail || errorBody.message || `HTTP Error ${response.status}`);
  }
  return response.json();
};

export const api = {
  query: (payload) => fetch('/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(handleResponse),

  login: (phoneOrEmail, method = 'phone') => {
    const body = method === 'phone' ? { phone: phoneOrEmail } : { email: phoneOrEmail };
    return fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(handleResponse);
  },

  updateBusiness: (bizId, field, value) => fetch(`/api/business/${bizId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ field, value })
  }).then(handleResponse),

  addBusiness: (data) => fetch('/api/business', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handleResponse),

  searchByName: (name) =>
    fetch(`/api/business/search-name?name=${encodeURIComponent(name)}`).then(handleResponse),

  searchByAddress: (addr) =>
    fetch(`/api/business/search-address?address=${encodeURIComponent(addr)}`).then(handleResponse),

  sendEmailOtp: (email, type = 'login') => fetch('/api/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, type })
  }).then(handleResponse),

  verifyEmailOtp: (email, otp) => fetch('/api/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp })
  }).then(handleResponse),

  getAiSuggestions: (text, lang, flow) => fetch('/api/smart-suggestions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language: lang, flow })
  }).then(handleResponse),

  addProduct: (data) => fetch('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handleResponse),

  addDeal: (data) => fetch('/api/deals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handleResponse),

  deleteProduct: (id) =>
    fetch(`/api/products/${id}`, { method: 'DELETE' }).then(handleResponse),

  deleteDeal: (id) =>
    fetch(`/api/deals/${id}`, { method: 'DELETE' }).then(handleResponse),

  deleteBusiness: (id) =>
    fetch(`/api/business/${id}`, { method: 'DELETE' }).then(handleResponse),

  // ── CHAT SESSIONS ─────────────────────────────────────────────────────
  createChatSession: (userId) => fetch('/api/chats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, title: 'New Chat' })
  }).then(handleResponse),

  listChatSessions: (userId) =>
    fetch(`/api/chats?user_id=${encodeURIComponent(userId)}`).then(handleResponse),

  getChatHistory: (sessionId, userId) =>
    fetch(`/api/chats/${sessionId}?user_id=${encodeURIComponent(userId)}`).then(handleResponse),

  deleteChatSession: (sessionId, userId) =>
    fetch(`/api/chats/${sessionId}?user_id=${encodeURIComponent(userId)}`, {
      method: 'DELETE'
    }).then(handleResponse),

  renameChatSession: (sessionId, title, userId) =>
    fetch(`/api/chats/${sessionId}?user_id=${encodeURIComponent(userId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    }).then(handleResponse),

  pinChatSession: (sessionId, isPinned, userId) =>
    fetch(`/api/chats/${sessionId}/pin?user_id=${encodeURIComponent(userId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_pinned: isPinned })
    }).then(handleResponse),

  // ── HOME / DISCOVERY ─────────────────────────────────────────────────
  getCategories: (hierarchy = false) =>
    fetch(`/api/categories?hierarchy=${hierarchy}`).then(handleResponse),

  getTrending: () =>
    fetch('/api/trending').then(handleResponse),

  // ── ANALYTICS ────────────────────────────────────────────────────────
  getAnalytics: () =>
    fetch('/api/analytics').then(handleResponse),

  // ── HEALTH ────────────────────────────────────────────────────────────
  checkHealth: () =>
    fetch('/api/health').then(handleResponse),

  // ── BOOKMARKS ─────────────────────────────────────────────────────────
  addBookmark: (userId, businessId) => fetch('/api/bookmarks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, business_id: businessId })
  }).then(handleResponse),

  getBookmarks: (userId) =>
    fetch(`/api/bookmarks?user_id=${encodeURIComponent(userId)}`).then(handleResponse),

  deleteBookmark: (businessId, userId) =>
    fetch(`/api/bookmarks/${businessId}?user_id=${encodeURIComponent(userId)}`, {
      method: 'DELETE'
    }).then(handleResponse),

  // ── COMPARE ───────────────────────────────────────────────────────────
  compareBusinesses: (businessIds) => fetch('/api/business/compare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ business_ids: businessIds })
  }).then(handleResponse),

  // ── REVIEWS & RATINGS ──────────────────────────────────────────────────
  getReviews: (businessId) => fetch(`/api/reviews/${businessId}`).then(handleResponse),

  addReview: (reviewData) => fetch('/api/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reviewData)
  }).then(handleResponse),

  deleteReview: (reviewId, userId) => fetch(`/api/reviews/${reviewId}?user_id=${encodeURIComponent(userId)}`, {
    method: 'DELETE'
  }).then(handleResponse),
};

export default api;
