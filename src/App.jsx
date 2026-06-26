import React, { useState, useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import ChatPage from './pages/ChatPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AboutPage from './pages/AboutPage';
import CategoriesPage from './pages/CategoriesPage';
import LoginPage from './pages/LoginPage';
import Toast from './components/ui/Toast';
import { useTheme } from './hooks/useTheme';
import { useToast } from './hooks/useToast';
import { api } from './services/api';
import { UI_TRANSLATIONS } from './constants/Translations';
import { useChatMemory } from './hooks/useChatMemory';

// ─── Global state that needs to persist across routes ─────
function AppShell() {
  useTheme(); // Applies theme on mount

  const { toasts, toast, dismiss } = useToast();

  // Auth state with local storage persistence
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('isLoggedIn') === 'true';
  });
  const [session, setSession] = useState(() => {
    const saved = localStorage.getItem('session');
    return saved ? JSON.parse(saved) : { type: 'GUEST', phone: null, email: null, businessId: null };
  });

  useEffect(() => {
    localStorage.setItem('isLoggedIn', isLoggedIn);
    if (!isLoggedIn) {
      localStorage.removeItem('token');
    }
  }, [isLoggedIn]);

  useEffect(() => {
    localStorage.setItem('session', JSON.stringify(session));
  }, [session]);

  // Unified chat memory service hook (manages all session lists, messages list, language and wizard states globally)
  const chatMemory = useChatMemory({ session, toast });

  // Common props for Layout and pages
  const sharedProps = {
    isLoggedIn, setIsLoggedIn,
    session, setSession,
    ...chatMemory,
    toast,
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Layout
              {...sharedProps}
              onNewChat={chatMemory.handleNewChat}
              onLoadSession={chatMemory.handleLoadSession}
              onDeleteSession={chatMemory.handleDeleteSession}
              onRenameSession={chatMemory.handleRenameSession}
              onPinSession={chatMemory.handlePinSession}
            />
          }
        >
          <Route index element={isLoggedIn ? <HomePage toast={toast} /> : <Navigate to="/login" replace />} />
          <Route path="chat" element={isLoggedIn ? <ChatPage {...sharedProps} /> : <Navigate to="/login" replace />} />
          <Route path="categories" element={isLoggedIn ? <CategoriesPage toast={toast} session={session} /> : <Navigate to="/login" replace />} />
          <Route path="analytics" element={isLoggedIn ? <AnalyticsPage toast={toast} /> : <Navigate to="/login" replace />} />
          <Route path="about" element={isLoggedIn ? <AboutPage toast={toast} /> : <Navigate to="/login" replace />} />
          <Route path="login" element={<LoginPage {...sharedProps} />} />
          {/* Redirect unknown paths to home if logged in, else login */}
          <Route path="*" element={<Navigate to={isLoggedIn ? "/" : "/login"} replace />} />
        </Route>
      </Routes>

      {/* Global toast notifications */}
      <Toast toasts={toasts} onDismiss={dismiss} />
    </BrowserRouter>
  );
}

export default function App() {
  return <AppShell />;
}
