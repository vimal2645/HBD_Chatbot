import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ChatArea from '../components/chat/ChatArea';

export default function ChatPage(props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [initialQuery, setInitialQuery] = useState(null);
  const [initialAction, setInitialAction] = useState(null);

  // Read ?q= and ?action= URL params and forward them to ChatArea
  useEffect(() => {
    const q = searchParams.get('q');
    const action = searchParams.get('action');
    if (q) {
      setInitialQuery(q);
    }
    if (action) {
      setInitialAction(action);
    }
    if (q || action) {
      // Remove from URL after capturing
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <ChatArea
        {...props}
        initialQuery={initialQuery}
        onClearInitialQuery={() => setInitialQuery(null)}
        initialAction={initialAction}
        onClearInitialAction={() => setInitialAction(null)}
      />
    </div>
  );
}
