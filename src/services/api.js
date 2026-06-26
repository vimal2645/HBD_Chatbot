const makeRequest = async (url, options = {}) => {
  const token = localStorage.getItem('token');
  const headers = {
    ...options.headers,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(url, {
    ...options,
    headers,
  });
  
  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.setItem('isLoggedIn', 'false');
    localStorage.removeItem('session');
    // Reload page to reset state cleanly
    window.location.reload();
    throw new Error('Unauthorized');
  }
  
  return response;
};

const handleResponse = async (response) => {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.detail || errorBody.message || `HTTP Error ${response.status}`);
  }
  return response.json();
};

export const api = {
  query: (payload) => makeRequest('/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(handleResponse),

  login: (phoneOrEmail, method = 'phone') => {
    const body = method === 'phone' ? { phone: phoneOrEmail } : { email: phoneOrEmail };
    return makeRequest('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(handleResponse).then(res => {
      if (res.token) {
        localStorage.setItem('token', res.token);
      }
      return res;
    });
  },

  authRegister: (email, phone, password, role) => makeRequest('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, phone, password, role })
  }).then(handleResponse).then(res => {
    if (res.token) {
      localStorage.setItem('token', res.token);
    }
    return res;
  }),

  authLogin: (email, phone, password) => makeRequest('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, phone, password })
  }).then(handleResponse).then(res => {
    if (res.token) {
      localStorage.setItem('token', res.token);
    }
    return res;
  }),

  getMerchantBusinesses: () => makeRequest('/api/merchant/businesses').then(handleResponse),

  updateBusiness: (bizId, field, value) => makeRequest(`/api/business/${bizId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ field, value })
  }).then(handleResponse),

  addBusiness: (data) => makeRequest('/api/business', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handleResponse),

  searchByName: (name) =>
    makeRequest(`/api/business/search-name?name=${encodeURIComponent(name)}`).then(handleResponse),

  searchByAddress: (addr) =>
    makeRequest(`/api/business/search-address?address=${encodeURIComponent(addr)}`).then(handleResponse),

  sendEmailOtp: (email, type = 'login') => makeRequest('/api/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, type })
  }).then(handleResponse),

  verifyEmailOtp: (email, otp) => makeRequest('/api/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp })
  }).then(handleResponse).then(res => {
    if (res.token) {
      localStorage.setItem('token', res.token);
    }
    return res;
  }),

  getAiSuggestions: (text, lang, flow) => makeRequest('/api/smart-suggestions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language: lang, flow })
  }).then(handleResponse),

  addProduct: (data) => makeRequest('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handleResponse),

  addDeal: (data) => makeRequest('/api/deals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handleResponse),

  deleteProduct: (id) =>
    makeRequest(`/api/products/${id}`, { method: 'DELETE' }).then(handleResponse),

  deleteDeal: (id) =>
    makeRequest(`/api/deals/${id}`, { method: 'DELETE' }).then(handleResponse),

  deleteBusiness: (id) =>
    makeRequest(`/api/business/${id}`, { method: 'DELETE' }).then(handleResponse),

  uploadImage: (formData) => makeRequest('/api/upload', {
    method: 'POST',
    body: formData
  }).then(handleResponse),

  syncChats: (guestUserId, userId) => makeRequest('/api/chats/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guest_user_id: guestUserId, user_id: userId })
  }).then(handleResponse),

  // ── CHAT SESSIONS ─────────────────────────────────────────────────────
  createChatSession: (userId) => makeRequest('/api/chats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, title: 'New Chat' })
  }).then(handleResponse),

  listChatSessions: (userId) =>
    makeRequest(`/api/chats?user_id=${encodeURIComponent(userId)}`).then(handleResponse),

  getChatHistory: (sessionId, userId) =>
    makeRequest(`/api/chats/${sessionId}?user_id=${encodeURIComponent(userId)}`).then(handleResponse),

  deleteChatSession: (sessionId, userId) =>
    makeRequest(`/api/chats/${sessionId}?user_id=${encodeURIComponent(userId)}`, {
      method: 'DELETE'
    }).then(handleResponse),

  renameChatSession: (sessionId, title, userId) =>
    makeRequest(`/api/chats/${sessionId}?user_id=${encodeURIComponent(userId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    }).then(handleResponse),

  pinChatSession: (sessionId, isPinned, userId) =>
    makeRequest(`/api/chats/${sessionId}/pin?user_id=${encodeURIComponent(userId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_pinned: isPinned })
    }).then(handleResponse),

  // ── HOME / DISCOVERY ─────────────────────────────────────────────────
  getCategories: (hierarchy = false) =>
    makeRequest(`/api/categories?hierarchy=${hierarchy}`).then(handleResponse),

  getTrending: () =>
    makeRequest('/api/trending').then(handleResponse),

  // ── ANALYTICS ────────────────────────────────────────────────────────
  getAnalytics: () =>
    makeRequest('/api/analytics').then(handleResponse),

  // ── HEALTH ────────────────────────────────────────────────────────────
  checkHealth: () =>
    makeRequest('/api/health').then(handleResponse),

  // ── BOOKMARKS ─────────────────────────────────────────────────────────
  addBookmark: (userId, businessId) => makeRequest('/api/bookmarks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, business_id: businessId })
  }).then(handleResponse),

  getBookmarks: (userId) => makeRequest(`/api/bookmarks?user_id=${encodeURIComponent(userId)}`).then(handleResponse),

  deleteBookmark: (businessId, userId) => makeRequest(`/api/bookmarks/${businessId}?user_id=${encodeURIComponent(userId)}`, {
    method: 'DELETE'
  }).then(handleResponse),

  // ── COMPARE ───────────────────────────────────────────────────────────
  compareBusinesses: (businessIds) => makeRequest('/api/business/compare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ business_ids: businessIds })
  }).then(handleResponse),

  // ── REVIEWS & RATINGS ──────────────────────────────────────────────────
  getReviews: (businessId) => makeRequest(`/api/reviews/${businessId}`).then(handleResponse),

  addReview: (reviewData) => makeRequest('/api/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reviewData)
  }).then(handleResponse),

  deleteReview: (reviewId, userId) => makeRequest(`/api/reviews/${reviewId}?user_id=${encodeURIComponent(userId)}`, {
    method: 'DELETE'
  }).then(handleResponse),

  // ── PRODUCTS & DEALS (ADS) ─────────────────────────────────────────────
  getProducts: (businessId) => makeRequest(`/api/business/${businessId}/products`).then(handleResponse),
  getDeals: (businessId) => makeRequest(`/api/business/${businessId}/deals`).then(handleResponse),
};

export default api;
