import React, { useState, useEffect, useRef } from 'react';
import {
  Search, RefreshCw, LogIn, MessageSquare, AlertCircle, X, ArrowRight,
  TrendingUp, ChevronRight, ChevronLeft, PlusCircle, MapPin, Type, Trash2,
  Star, Phone, Globe, Copy, Check, ExternalLink, Share2, Bookmark, Clock, Compass,
  Package, Tag
} from 'lucide-react';
import api from '../services/api';
import ReviewSection from './ReviewSection';
import DealsAndProductsSection from './DealsAndProductsSection';

export const ADD_BIZ_STEPS = [
  { key: 'otp', promptKey: 'prompt_otp' }
];

// Safe inline markdown renderer (no dangerouslySetInnerHTML)
function MarkdownText({ text }) {
  if (!text) return null;
  const str = String(text);

  // Split by newlines, then process each line
  const lines = str.split('\n');
  return (
    <div className="md-content">
      {lines.map((line, i) => {
        // Process inline formatting: **bold**, *italic*, `code`
        const parts = [];
        let remaining = line;
        let key = 0;

        while (remaining.length > 0) {
          // Bold
          const boldMatch = remaining.match(/^(.*?)\*\*(.*?)\*\*/s);
          if (boldMatch) {
            if (boldMatch[1]) parts.push(<span key={key++}>{boldMatch[1]}</span>);
            parts.push(<strong key={key++} style={{ fontWeight: 700 }}>{boldMatch[2]}</strong>);
            remaining = remaining.slice(boldMatch[0].length);
            continue;
          }
          // Code
          const codeMatch = remaining.match(/^(.*?)`([^`]+)`/s);
          if (codeMatch) {
            if (codeMatch[1]) parts.push(<span key={key++}>{codeMatch[1]}</span>);
            parts.push(<code key={key++}>{codeMatch[2]}</code>);
            remaining = remaining.slice(codeMatch[0].length);
            continue;
          }
          // No more matches
          parts.push(<span key={key++}>{remaining}</span>);
          break;
        }

        return (
          <p key={i} style={{ marginBottom: i < lines.length - 1 ? 4 : 0 }}>
            {parts}
          </p>
        );
      })}
    </div>
  );
}

// Copy to clipboard button
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { }
  };
  return (
    <button
      onClick={handleCopy}
      title="Copy"
      style={{
        padding: '2px 6px',
        borderRadius: 6,
        border: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface-2)',
        cursor: 'pointer',
        color: copied ? 'var(--color-success)' : 'var(--text-muted)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: '0.6875rem',
        fontWeight: 600,
        transition: 'all 150ms ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.color = 'var(--color-primary)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = copied ? 'var(--color-success)' : 'var(--text-muted)'; }}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

// Speaker / TTS button component
function SpeakerButton({ text, language }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const utteranceRef = useRef(null);

  const handleSpeak = (e) => {
    e.stopPropagation();

    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }

    // Stop any current speech
    window.speechSynthesis.cancel();

    // Clean text of markdown or JSON tags
    let cleanText = String(text)
      .replace(/\*\*([^*]+)\*\*/g, '$1') // remove bold asterisks
      .replace(/`([^`]+)`/g, '$1') // remove code ticks
      .replace(/[🐝👋🚨⭐🔍📍📞🌐🎟️⏭️⏮️✨🔥]/g, ''); // remove emojis for smoother reading

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utteranceRef.current = utterance;

    // Resolve voice based on language
    const voices = window.speechSynthesis.getVoices();
    let langCode = 'en-US';
    if (language === 'hi') langCode = 'hi-IN';
    else if (language === 'te') langCode = 'te-IN';
    else if (language === 'gu') langCode = 'gu-IN';

    utterance.lang = langCode;

    // Try to find a matching voice
    const voice = voices.find(v => v.lang.startsWith(langCode) || v.lang.includes(langCode));
    if (voice) utterance.voice = voice;

    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);

    setIsPlaying(true);
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    return () => {
      if (isPlaying) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isPlaying]);

  return (
    <button
      onClick={handleSpeak}
      title={isPlaying ? "Stop" : "Listen"}
      style={{
        padding: '2px 6px',
        borderRadius: 6,
        border: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface-2)',
        cursor: 'pointer',
        color: isPlaying ? 'var(--color-primary)' : 'var(--text-muted)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: '0.6875rem',
        fontWeight: 600,
        transition: 'all 150ms ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.color = 'var(--color-primary)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = isPlaying ? 'var(--color-primary)' : 'var(--text-muted)'; }}
    >
      {isPlaying ? (
        <>
          <div className="audio-wave" style={{ display: 'flex', alignItems: 'center', gap: 1.5, height: 8 }}>
            <span style={{ width: 1.5, height: '100%', background: 'var(--color-primary)', borderRadius: 1, animation: 'wave 0.6s infinite alternate' }} />
            <span style={{ width: 1.5, height: '60%', background: 'var(--color-primary)', borderRadius: 1, animation: 'wave 0.6s infinite alternate 0.2s' }} />
            <span style={{ width: 1.5, height: '80%', background: 'var(--color-primary)', borderRadius: 1, animation: 'wave 0.6s infinite alternate 0.4s' }} />
          </div>
          Speaking...
        </>
      ) : (
        <>
          <svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
          Listen
        </>
      )}
    </button>
  );
}

// Star rating renderer
function StarRating({ rating = 0, max = 5 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {[...Array(max)].map((_, i) => (
        <Star
          key={i}
          size={10}
          fill={i < Math.floor(rating) ? '#f59e0b' : 'none'}
          style={{ color: i < Math.floor(rating) ? '#f59e0b' : 'var(--border-subtle)' }}
        />
      ))}
      <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-secondary)', marginLeft: 3 }}>
        {rating ? Number(rating).toFixed(1) : '0.0'}
      </span>
    </div>
  );
}

// Dynamic gradient helper based on business name string
function getAvatarStyle(name) {
  const colors = [
    ['#4f46e5', '#7c3aed'], // Indigo/Violet
    ['#3b82f6', '#1d4ed8'], // Blue
    ['#059669', '#047857'], // Emerald
    ['#db2777', '#be185d'], // Pink
    ['#ea580c', '#c2410c'], // Orange
    ['#06b6d4', '#0891b2'], // Cyan
  ];
  const hash = String(name).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const pair = colors[hash % colors.length];
  return {
    background: `linear-gradient(135deg, ${pair[0]}, ${pair[1]})`,
    boxShadow: `0 4px 10px ${pair[0]}33`
  };
}

// ─────────────────────────────────────────────────────────
// BUSINESS CARD
// ─────────────────────────────────────────────────────────
// Dynamic opening hours and status helper
function getOpeningHours(category) {
  const cat = String(category || '').toLowerCase();
  if (cat.includes('restaurant') || cat.includes('food') || cat.includes('cafe')) {
    return { hours: "11:00 AM - 11:00 PM", status: "Open Now" };
  } else if (cat.includes('gym') || cat.includes('fitness') || cat.includes('sports')) {
    return { hours: "06:00 AM - 10:00 PM", status: "Open Now" };
  } else if (cat.includes('doctor') || cat.includes('clinic') || cat.includes('hospital')) {
    return { hours: "09:00 AM - 07:00 PM", status: "Open Now" };
  } else if (cat.includes('services') || cat.includes('it') || cat.includes('agency') || cat.includes('office')) {
    return { hours: "09:00 AM - 06:00 PM", status: "Open Now" };
  } else {
    return { hours: "09:00 AM - 08:00 PM", status: "Open Now" };
  }
}

function getOpeningStatus(openingHours, category) {
  const hours = openingHours || getOpeningHours(category).hours;
  if (!hours || hours.toLowerCase() === 'none' || hours.trim() === '') {
    return { hours: "09:00 AM - 08:00 PM", isOpen: true, statusText: "Open Now" };
  }
  if (hours.toLowerCase().includes('24 hours') || hours.toLowerCase().includes('24x7')) {
    return { hours, isOpen: true, statusText: "Open Now (24 Hours)" };
  }

  try {
    const now = new Date();
    const currentHour = now.getHours();
    const matches = hours.match(/(\d+):(\d+)\s*(AM|PM)/ig);
    if (matches && matches.length === 2) {
      const parseTime = (timeStr) => {
        const parts = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (!parts) return 0;
        let h = parseInt(parts[1]);
        const ampm = parts[3].toUpperCase();
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        return h;
      };

      const startH = parseTime(matches[0]);
      const endH = parseTime(matches[1]);
      const isOpen = currentHour >= startH && currentHour < endH;
      return {
        hours,
        isOpen,
        statusText: isOpen ? "Open Now" : "Closed"
      };
    }
  } catch (e) {
    console.error("Error parsing hours:", e);
  }

  return { hours, isOpen: true, statusText: "Open Now" };
}

// ─────────────────────────────────────────────────────────
// PRODUCT CARD
// ─────────────────────────────────────────────────────────
function ProductCard({ prod, onAction }) {
  const name = prod.product_name || prod.business_name || 'Product';
  const category = prod.category_name || prod.category || 'Product';
  const brand = prod.brand || (prod.city && prod.city !== 'Generic Brand' ? prod.city : '') || '';
  const rawPrice = prod.price !== undefined ? prod.price : (prod.phone_number ? prod.phone_number.replace('₹', '') : '');
  const price = rawPrice ? `₹${rawPrice}` : 'Price N/A';
  const listPrice = prod.list_price ? `₹${prod.list_price}` : null;
  const rating = parseFloat(prod.stars !== undefined ? prod.stars : (prod.rating || 0));
  const reviewCount = parseInt(prod.reviews !== undefined ? prod.reviews : (prod.review_count || 0));
  const imageUrl = prod.image_url;
  const productUrl = prod.product_url || prod.website_url;
  const description = prod.description || prod.business_description;

  const coverStyle = getAvatarStyle(name + "_prod");
  const isBlinkit = prod.marketplace_name?.toLowerCase() === 'blinkit';
  const isBigBasket = prod.marketplace_name?.toLowerCase() === 'bigbasket';
  const isFlipkart = prod.marketplace_name?.toLowerCase() === 'flipkart';
  const isAmazon = prod.marketplace_name?.toLowerCase() === 'amazon';


  if (isBigBasket) {
    const formattedPrice = prod.price !== undefined ? Number(prod.price).toFixed(2) : null;
    const formattedMrp = prod.mrp !== undefined ? Number(prod.mrp).toFixed(2) : null;
    const formattedDiscount = prod.discount !== undefined ? Number(prod.discount).toFixed(2) : null;
    const avail = prod.availability ? 'In Stock' : 'Out of Stock';

    return (
      <div className="prod-card bigbasket-prod-card" style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)',
        transition: 'all 200ms ease',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        height: '100%',
        animation: 'slideUp 300ms ease',
      }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'translateY(0)'; }}
      >
        {/* Cover image or fallback */}
        <div style={{
          height: 140,
          position: 'relative',
          overflow: 'hidden',
          background: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          {imageUrl ? (
            <img 
              src={imageUrl} 
              alt={name} 
              style={{ 
                maxHeight: '100%', 
                maxWidth: '100%', 
                objectFit: 'contain',
                transition: 'transform 300ms ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 32 }}>
              📦
            </div>
          )}
          {/* Availability Badge */}
          <span style={{
            position: 'absolute',
            top: 8,
            right: 8,
            padding: '2px 8px',
            borderRadius: 999,
            fontSize: '0.6rem',
            fontWeight: 700,
            background: prod.availability ? '#d1fae5' : '#fee2e2',
            color: prod.availability ? '#065f46' : '#991b1b',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
          }}>
            {avail}
          </span>
        </div>

        {/* Card Body */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: 12 }}>
          {/* Category tags */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
            <span className="badge badge-primary" style={{ fontSize: '0.6rem', fontWeight: 700, padding: '2px 8px', textTransform: 'uppercase' }}>
              {category}
            </span>
            <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '2px 8px', textTransform: 'uppercase', background: '#dcfce7', color: '#16a34a', borderRadius: 'var(--radius-full)' }}>
              BigBasket
            </span>
          </div>

          {/* Product Name */}
          <h4 style={{
            fontSize: '0.85rem',
            fontWeight: 800,
            margin: '0 0 6px 0',
            color: 'var(--text-primary)',
            lineHeight: 1.3,
            height: 36,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical'
          }} title={name}>
            {name}
          </h4>

          {/* Details / Description Panel */}
          <div style={{
            background: 'var(--bg-surface-2)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 8px',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            fontSize: '0.7rem',
            marginBottom: 8,
          }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Brand: </span>
              <strong style={{ color: 'var(--text-primary)' }}>{brand || 'Generic Brand'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Quantity: </span>
              <strong style={{ color: 'var(--text-primary)' }}>{prod.quantity || 'N/A'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Status: </span>
              <strong style={{ color: prod.availability ? '#10b981' : '#ef4444' }}>{avail}</strong>
            </div>
          </div>

          {/* Price & Action row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#059669' }}>
                  ₹{formattedPrice}
                </span>
                {formattedMrp && formattedMrp !== formattedPrice && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                    ₹{formattedMrp}
                  </span>
                )}
              </div>
              {formattedDiscount && Number(formattedDiscount) > 0 && (
                <span style={{ fontSize: '0.6rem', color: '#059669', fontWeight: 700 }}>
                  Save ₹{formattedDiscount}
                </span>
              )}
            </div>

            {productUrl && (
              <a href={productUrl} target="_blank" rel="noopener noreferrer" style={{
                marginLeft: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                padding: '6px 12px',
                borderRadius: 8,
                background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
                color: 'white',
                fontSize: '0.7rem',
                fontWeight: 700,
                textDecoration: 'none',
                boxShadow: '0 2px 6px rgba(234,88,12,0.15)',
                transition: 'all 150ms ease'
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                Order <ExternalLink size={10} />
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isBlinkit) {
    const formattedPrice = prod.price !== undefined ? Number(prod.price).toFixed(2) : null;
    const formattedMrp = prod.mrp !== undefined ? Number(prod.mrp).toFixed(2) : null;
    const formattedDiscount = prod.discount !== undefined ? Number(prod.discount).toFixed(2) : null;
    const avail = prod.availability ? 'In Stock' : 'Out of Stock';

    return (
      <div className="prod-card blinkit-prod-card" style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)',
        transition: 'all 200ms ease',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        height: '100%',
        animation: 'slideUp 300ms ease',
      }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'translateY(0)'; }}
      >
        {/* Cover image or fallback */}
        <div style={{
          height: 140,
          position: 'relative',
          overflow: 'hidden',
          background: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          {imageUrl ? (
            <img 
              src={imageUrl} 
              alt={name} 
              style={{ 
                maxHeight: '100%', 
                maxWidth: '100%', 
                objectFit: 'contain',
                transition: 'transform 300ms ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 32 }}>
              📦
            </div>
          )}
          {/* Availability Badge */}
          <span style={{
            position: 'absolute',
            top: 8,
            right: 8,
            padding: '2px 8px',
            borderRadius: 999,
            fontSize: '0.6rem',
            fontWeight: 700,
            background: prod.availability ? '#d1fae5' : '#fee2e2',
            color: prod.availability ? '#065f46' : '#991b1b',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
          }}>
            {avail}
          </span>
        </div>

        {/* Card Body */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: 12 }}>
          {/* Category tags */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
            <span className="badge badge-primary" style={{ fontSize: '0.6rem', fontWeight: 700, padding: '2px 8px', textTransform: 'uppercase' }}>
              {category}
            </span>
            <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '2px 8px', textTransform: 'uppercase', background: '#ffe4e6', color: '#be123c', borderRadius: 'var(--radius-full)' }}>
              Blinkit
            </span>
          </div>

          {/* Product Name */}
          <h4 style={{
            fontSize: '0.85rem',
            fontWeight: 800,
            margin: '0 0 6px 0',
            color: 'var(--text-primary)',
            lineHeight: 1.3,
            height: 36,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical'
          }} title={name}>
            {name}
          </h4>

          {/* Details / Description Panel */}
          <div style={{
            background: 'var(--bg-surface-2)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 8px',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            fontSize: '0.7rem',
            marginBottom: 8,
          }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Brand: </span>
              <strong style={{ color: 'var(--text-primary)' }}>{brand}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Quantity: </span>
              <strong style={{ color: 'var(--text-primary)' }}>{prod.quantity || 'N/A'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Status: </span>
              <strong style={{ color: prod.availability ? '#10b981' : '#ef4444' }}>{avail}</strong>
            </div>
          </div>

          {/* Price & Action row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#059669' }}>
                  ₹{formattedPrice}
                </span>
                {formattedMrp && formattedMrp !== formattedPrice && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                    ₹{formattedMrp}
                  </span>
                )}
              </div>
              {formattedDiscount && Number(formattedDiscount) > 0 && (
                <span style={{ fontSize: '0.6rem', color: '#059669', fontWeight: 700 }}>
                  Save ₹{formattedDiscount}
                </span>
              )}
            </div>

            {productUrl && (
              <a href={productUrl} target="_blank" rel="noopener noreferrer" style={{
                marginLeft: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                padding: '6px 12px',
                borderRadius: 8,
                background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
                color: 'white',
                fontSize: '0.7rem',
                fontWeight: 700,
                textDecoration: 'none',
                boxShadow: '0 2px 6px rgba(234,88,12,0.15)',
                transition: 'all 150ms ease'
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                Order <ExternalLink size={10} />
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isFlipkart) {
    const formattedPrice = prod.price !== undefined ? Number(prod.price).toFixed(2) : null;
    const formattedMrp = prod.mrp !== undefined ? Number(prod.mrp).toFixed(2) : null;
    const formattedDiscount = prod.discount !== undefined ? Number(prod.discount).toFixed(2) : null;
    const avail = prod.availability ? 'In Stock' : 'Out of Stock';

    return (
      <div className="prod-card flipkart-prod-card" style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)',
        transition: 'all 200ms ease',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        height: '100%',
        animation: 'slideUp 300ms ease',
      }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'translateY(0)'; }}
      >
        {/* Cover image or fallback */}
        <div style={{
          height: 140,
          position: 'relative',
          overflow: 'hidden',
          background: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          {imageUrl ? (
            <img 
              src={imageUrl} 
              alt={name} 
              style={{ 
                maxHeight: '100%', 
                maxWidth: '100%', 
                objectFit: 'contain',
                transition: 'transform 300ms ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 32 }}>
              📦
            </div>
          )}
          {/* Availability Badge */}
          <span style={{
            position: 'absolute',
            top: 8,
            right: 8,
            padding: '2px 8px',
            borderRadius: 999,
            fontSize: '0.6rem',
            fontWeight: 700,
            background: prod.availability ? '#d1fae5' : '#fee2e2',
            color: prod.availability ? '#065f46' : '#991b1b',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
          }}>
            {avail}
          </span>
        </div>

        {/* Card Body */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: 12 }}>
          {/* Category tags */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
            <span className="badge badge-primary" style={{ fontSize: '0.6rem', fontWeight: 700, padding: '2px 8px', textTransform: 'uppercase' }}>
              {category}
            </span>
            <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '2px 8px', textTransform: 'uppercase', background: '#dbeafe', color: '#1d4ed8', borderRadius: 'var(--radius-full)' }}>
              Flipkart
            </span>
          </div>

          {/* Product Name */}
          <h4 style={{
            fontSize: '0.85rem',
            fontWeight: 800,
            margin: '0 0 6px 0',
            color: 'var(--text-primary)',
            lineHeight: 1.3,
            height: 36,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical'
          }} title={name}>
            {name}
          </h4>

          {/* Details / Description Panel */}
          <div style={{
            background: 'var(--bg-surface-2)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 8px',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            fontSize: '0.7rem',
            marginBottom: 8,
          }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Brand: </span>
              <strong style={{ color: 'var(--text-primary)' }}>{brand || 'Generic Brand'}</strong>
            </div>
            {description && (
              <div style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                <span style={{ color: 'var(--text-muted)' }}>Specs: </span>
                <strong style={{ color: 'var(--text-primary)' }} title={description}>{description}</strong>
              </div>
            )}
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Status: </span>
              <strong style={{ color: prod.availability ? '#10b981' : '#ef4444' }}>{avail}</strong>
            </div>
          </div>

          {/* Price & Action row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#059669' }}>
                  ₹{formattedPrice}
                </span>
                {formattedMrp && formattedMrp !== formattedPrice && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                    ₹{formattedMrp}
                  </span>
                )}
              </div>
              {formattedDiscount && Number(formattedDiscount) > 0 && (
                <span style={{ fontSize: '0.6rem', color: '#059669', fontWeight: 700 }}>
                  Save ₹{formattedDiscount}
                </span>
              )}
            </div>

            {productUrl && (
              <a href={productUrl} target="_blank" rel="noopener noreferrer" style={{
                marginLeft: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                padding: '6px 12px',
                borderRadius: 8,
                background: 'linear-gradient(135deg, #2874f0, #1259c3)',
                color: 'white',
                fontSize: '0.7rem',
                fontWeight: 700,
                textDecoration: 'none',
                boxShadow: '0 2px 6px rgba(40,116,240,0.15)',
                transition: 'all 150ms ease'
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                Order <ExternalLink size={10} />
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isAmazon) {
    const formattedPrice = prod.price !== undefined ? Number(prod.price).toFixed(2) : null;
    const formattedMrp = prod.mrp !== undefined ? Number(prod.mrp).toFixed(2) : null;
    const formattedDiscount = prod.discount !== undefined ? Number(prod.discount).toFixed(2) : null;
    const avail = prod.availability ? 'In Stock' : 'Out of Stock';

    return (
      <div className="prod-card amazon-prod-card" style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)',
        transition: 'all 200ms ease',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        height: '100%',
        animation: 'slideUp 300ms ease',
      }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'translateY(0)'; }}
      >
        {/* Cover image or fallback */}
        <div style={{
          height: 140,
          position: 'relative',
          overflow: 'hidden',
          background: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          {imageUrl ? (
            <img 
              src={imageUrl} 
              alt={name} 
              style={{ 
                maxHeight: '100%', 
                maxWidth: '100%', 
                objectFit: 'contain',
                transition: 'transform 300ms ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 32 }}>
              📦
            </div>
          )}
          {/* Availability Badge */}
          <span style={{
            position: 'absolute',
            top: 8,
            right: 8,
            padding: '2px 8px',
            borderRadius: 999,
            fontSize: '0.6rem',
            fontWeight: 700,
            background: prod.availability ? '#d1fae5' : '#fee2e2',
            color: prod.availability ? '#065f46' : '#991b1b',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
          }}>
            {avail}
          </span>
        </div>

        {/* Card Body */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: 12 }}>
          {/* Category tags */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
            <span className="badge badge-primary" style={{ fontSize: '0.6rem', fontWeight: 700, padding: '2px 8px', textTransform: 'uppercase' }}>
              {category}
            </span>
            <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '2px 8px', textTransform: 'uppercase', background: '#ffe6c7', color: '#e65100', borderRadius: 'var(--radius-full)' }}>
              Amazon
            </span>
          </div>

          {/* Product Name */}
          <h4 style={{
            fontSize: '0.85rem',
            fontWeight: 800,
            margin: '0 0 6px 0',
            color: 'var(--text-primary)',
            lineHeight: 1.3,
            height: 36,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical'
          }} title={name}>
            {name}
          </h4>

          {/* Details / Description Panel */}
          <div style={{
            background: 'var(--bg-surface-2)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 8px',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            fontSize: '0.7rem',
            marginBottom: 8,
          }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Brand: </span>
              <strong style={{ color: 'var(--text-primary)' }}>{brand || 'Generic Brand'}</strong>
            </div>
            {prod.asin && (
              <div>
                <span style={{ color: 'var(--text-muted)' }}>ASIN: </span>
                <strong style={{ color: 'var(--text-primary)' }}>{prod.asin}</strong>
              </div>
            )}
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Rating: </span>
              <strong style={{ color: 'var(--text-primary)' }}>⭐ {prod.rating || 0} ({prod.reviews || 0} reviews)</strong>
            </div>
          </div>

          {/* Price & Action row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#059669' }}>
                  ₹{formattedPrice}
                </span>
                {formattedMrp && formattedMrp !== formattedPrice && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                    ₹{formattedMrp}
                  </span>
                )}
              </div>
              {formattedDiscount && Number(formattedDiscount) > 0 && (
                <span style={{ fontSize: '0.6rem', color: '#059669', fontWeight: 700 }}>
                  Save ₹{formattedDiscount}
                </span>
              )}
            </div>

            {productUrl && (
              <a href={productUrl} target="_blank" rel="noopener noreferrer" style={{
                marginLeft: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                padding: '6px 12px',
                borderRadius: 8,
                background: 'linear-gradient(135deg, #ff9900, #e67e00)',
                color: 'white',
                fontSize: '0.7rem',
                fontWeight: 700,
                textDecoration: 'none',
                boxShadow: '0 2px 6px rgba(255,153,0,0.15)',
                transition: 'all 150ms ease'
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                Order <ExternalLink size={10} />
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }



  return (
    <div className="prod-card" style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-sm)',
      transition: 'all 200ms ease',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      height: '100%'
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      {/* Cover image or fallback */}
      <div style={{
        height: 120,
        position: 'relative',
        overflow: 'hidden',
        background: imageUrl ? `url(${imageUrl}) center/cover no-repeat` : undefined,
        ...(!imageUrl ? coverStyle : {}),
      }}>
        {!imageUrl && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 32 }}>
            📦
          </div>
        )}
      </div>

      {/* Card Body */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
          <span className="badge badge-primary" style={{ fontSize: '0.6rem', fontWeight: 700, padding: '2px 8px', textTransform: 'uppercase' }}>
            {category}
          </span>
          {prod.marketplace_name && (
            <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '2px 8px', textTransform: 'uppercase', background: '#e0e7ff', color: '#4338ca', borderRadius: 'var(--radius-full)' }}>
              {prod.marketplace_name}
            </span>
          )}
          {brand && (
            <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              by {brand}
            </span>
          )}
        </div>

        <h4 style={{
          fontSize: '0.85rem',
          fontWeight: 800,
          margin: '0 0 6px 0',
          color: 'var(--text-primary)',
          lineHeight: 1.3,
          height: 36,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical'
        }} title={name}>
          {name}
        </h4>

        {/* Rating and Reviews */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <StarRating rating={rating} />
          {reviewCount > 0 && (
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
              ({reviewCount})
            </span>
          )}
        </div>

        {/* Price & Action row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#059669' }}>
              {price}
            </span>
            {listPrice && (
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                {listPrice}
              </span>
            )}
          </div>

          {productUrl && (
            <a href={productUrl} target="_blank" rel="noopener noreferrer" style={{
              marginLeft: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              padding: '6px 12px',
              borderRadius: 8,
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
              color: 'white',
              fontSize: '0.75rem',
              fontWeight: 700,
              textDecoration: 'none',
              transition: 'all 150ms ease'
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              View <ExternalLink size={10} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// BUSINESS CARD
// ─────────────────────────────────────────────────────────
function BusinessCard({ biz, onAction, isLoggedIn, session, compareList, mode }) {
  const isOwner = session.email && biz.email && session.email.toLowerCase() === biz.email.toLowerCase();
  const avatarStyle = getAvatarStyle(biz.business_name || 'B');
  const coverStyle = getAvatarStyle((biz.business_name || 'B') + "_cover");
  const firstLetter = String(biz.business_name || 'B').trim().charAt(0).toUpperCase();
  const { hours, isOpen, statusText } = getOpeningStatus(biz.opening_hours, biz.business_category);

  const [showReviews, setShowReviews] = useState(false);
  const [localRatings, setLocalRatings] = useState(biz.ratings);
  const [localReviewsCount, setLocalReviewsCount] = useState(biz.reviews_count);
  const [showDealsAndProducts, setShowDealsAndProducts] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const handleToggleAnalytics = async () => {
    if (showAnalytics) {
      setShowAnalytics(false);
      return;
    }
    setShowAnalytics(true);
    setLoadingAnalytics(true);
    try {
      const res = await api.getMerchantAnalytics(biz.global_business_id);
      setAnalyticsData(res);
    } catch (err) {
      console.error("Failed to load merchant analytics:", err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const isComparing = compareList && biz.global_business_id && compareList.some(c => c.global_business_id && Number(c.global_business_id) === Number(biz.global_business_id));

  const handleCompareToggle = (e) => {
    e.stopPropagation();
    onAction('toggle_compare', biz);
  };

  const [bookmarked, setBookmarked] = useState(false);
  const userId = session?.phone || session?.email || localStorage.getItem('guest_user_id') || 'guest';

  useEffect(() => {
    let active = true;
    const checkBookmark = async () => {
      if (!userId) return;
      try {
        const list = await api.getBookmarks(userId);
        if (active && Array.isArray(list)) {
          const found = list.some(b => Number(b.global_business_id) === Number(biz.global_business_id));
          setBookmarked(found);
        }
      } catch (e) {
        console.error("Error checking bookmark:", e);
      }
    };
    checkBookmark();
    return () => { active = false; };
  }, [biz.global_business_id, userId]);

  const handleBookmarkToggle = async (e) => {
    e.stopPropagation();
    try {
      if (bookmarked) {
        await api.deleteBookmark(biz.global_business_id, userId);
        setBookmarked(false);
      } else {
        await api.addBookmark(userId, biz.global_business_id);
        setBookmarked(true);
      }
    } catch (err) {
      console.error("Failed to toggle bookmark:", err);
    }
  };

  const handleShare = async (e) => {
    e.stopPropagation();
    const shareUrl = biz.google_maps_link || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(biz.business_name + ' ' + (biz.address || '') + ' ' + (biz.city || ''))}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: biz.business_name,
          text: `Check out ${biz.business_name} on HoneyBee Digital!`,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        alert(`Link to ${biz.business_name} copied to clipboard!`);
      }
    } catch (err) {
      console.error("Share failed:", err);
    }
  };

  return (
    <div className="biz-card"
      onClick={(e) => {
        if (e.target.closest("button")) return;
        if (mode === "update_select") {
          onAction("select_business_for_update", biz);
        }
      }} style={{
        cursor: mode === "update_select" ? "pointer" : "default",
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)',
        transition: 'all 200ms ease',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        height: '100%'
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      {/* Premium Cover Banner */}
      <div style={{
        height: 72,
        position: 'relative',
        overflow: 'hidden',
        background: biz.image_url ? `url(${biz.image_url}) center/cover no-repeat` : undefined,
        ...(!biz.image_url ? coverStyle : {}),
      }}>
        {biz.image_url && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.45))'
          }} />
        )}
      </div>

      {/* Compare Checkbox */}
      <div style={{
        position: 'absolute',
        top: 10,
        left: 10,
        background: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(6px)',
        border: 'none',
        borderRadius: 6,
        padding: '3px 8px',
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        cursor: 'pointer',
        fontSize: '0.65rem',
        fontWeight: 700,
        color: '#ffffff',
        zIndex: 5
      }}
        onClick={handleCompareToggle}
      >
        <input
          type="checkbox"
          checked={isComparing || false}
          onChange={() => { }}
          style={{ cursor: 'pointer', width: 10, height: 10 }}
        />
        Compare
      </div>

      {/* Letter Avatar (Offset Overlap) */}
      <div style={{
        width: 44,
        height: 44,
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontWeight: 800,
        fontSize: '1.1rem',
        flexShrink: 0,
        position: 'absolute',
        top: 50,
        left: 14,
        border: '3px solid var(--bg-surface)',
        zIndex: 2,
        ...avatarStyle
      }}>
        {firstLetter}
      </div>

      {/* Bookmark Toggle */}
      <button
        onClick={handleBookmarkToggle}
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          background: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(6px)',
          border: 'none',
          borderRadius: '50%',
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: bookmarked ? '#f43f5e' : '#ffffff',
          transition: 'all var(--transition-fast)',
          zIndex: 5
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        <Bookmark size={14} fill={bookmarked ? '#f43f5e' : 'none'} />
      </button>

      {/* Card Body */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '30px 14px 14px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
          <span className="badge badge-primary" style={{ fontSize: '0.625rem', fontWeight: 700, padding: '2px 8px' }}>
            {biz.business_category || 'Business'}
          </span>
          {biz.source && (
            <span style={{ fontSize: '0.625rem', fontWeight: 700, padding: '2px 8px', background: '#fce7f3', color: '#be185d', borderRadius: 'var(--radius-full)' }}>
              {biz.source}
            </span>
          )}
          <span style={{
            fontSize: '0.625rem',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 'var(--radius-full)',
            background: isOpen ? '#d1fae5' : '#fee2e2',
            color: isOpen ? '#065f46' : '#991b1b',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: isOpen ? '#10b981' : '#ef4444' }}></span>
            {statusText}
          </span>
        </div>

        <h4 className="biz-card-name" style={{
          fontSize: '0.9375rem',
          fontWeight: 800,
          margin: '0 0 4px 0',
          color: 'var(--text-primary)',
          lineHeight: 1.3,
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}>
          {biz.business_name}
          {(biz.verified_status === 'verified' || biz.owner_id) && (
            <span title="Verified Merchant" style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#3b82f6',
              flexShrink: 0
            }}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
            </span>
          )}
        </h4>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <StarRating rating={localRatings} />
          {localReviewsCount > 0 && (
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              ({localReviewsCount} review{localReviewsCount !== 1 ? 's' : ''})
            </span>
          )}
        </div>

        {biz.business_description && (
          <p style={{
            fontSize: '0.72rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.4,
            margin: '0 0 10px 0',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {biz.business_description}
          </p>
        )}

        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 6, flex: 1, marginBottom: 12 }}>
          {biz.address && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <MapPin size={12} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 1 }} />
              <span style={{ lineHeight: 1.3 }}>{biz.area ? `${biz.area}, ` : ''}{biz.address}</span>
            </div>
          )}
          {(biz.address || biz.city) && (
            <div style={{
              width: '100%',
              height: 100,
              borderRadius: 8,
              overflow: 'hidden',
              border: '1px solid var(--border-subtle)',
              marginTop: 4,
              boxShadow: 'var(--shadow-sm)'
            }}>
              <iframe
                title="Map Preview"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                src={biz.google_maps_link && biz.google_maps_link.includes('output=embed') ? biz.google_maps_link : `https://maps.google.com/maps?q=${encodeURIComponent(biz.business_name + ' ' + (biz.address || '') + ' ' + (biz.city || ''))}&t=&z=14&ie=UTF8&iwloc=&output=embed`}
              />
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <span>Hours: {hours}</span>
          </div>
        </div>

        {/* Action Button Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: 10,
          marginTop: 'auto',
          gap: 6
        }}>
          {biz.phone_number ? (
            <a href={`tel:${biz.phone_number}`} title="Call" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '8px', borderRadius: 8, background: 'var(--bg-surface-2)',
              color: 'var(--color-primary)', transition: 'all 150ms ease'
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-primary-light)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-surface-2)'; }}
            >
              <Phone size={13} />
            </a>
          ) : (
            <span title="No Phone" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', opacity: 0.4 }}>
              <Phone size={13} style={{ color: 'var(--text-muted)' }} />
            </span>
          )}

          {biz.website_url ? (
            <a href={biz.website_url.startsWith('http') ? biz.website_url : `https://${biz.website_url}`}
              target="_blank" rel="noopener noreferrer" title="Website" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '8px', borderRadius: 8, background: 'var(--bg-surface-2)',
                color: 'var(--color-primary)', transition: 'all 150ms ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-primary-light)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-surface-2)'; }}
            >
              <Globe size={13} />
            </a>
          ) : (
            <span title="No Website" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', opacity: 0.4 }}>
              <Globe size={13} style={{ color: 'var(--text-muted)' }} />
            </span>
          )}

          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(biz.business_name + ' ' + (biz.address || '') + ' ' + (biz.city || ''))}`}
            target="_blank" rel="noopener noreferrer" title="Directions" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '8px', borderRadius: 8, background: 'var(--bg-surface-2)',
              color: 'var(--color-primary)', transition: 'all 150ms ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-primary-light)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-surface-2)'; }}
          >
            <Compass size={13} />
          </a>

          <button onClick={handleShare} title="Share" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer',
            padding: '8px', borderRadius: 8, background: 'var(--bg-surface-2)',
            color: 'var(--color-primary)', transition: 'all 150ms ease'
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-primary-light)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-surface-2)'; }}
          >
            <Share2 size={13} />
          </button>
        </div>

        {/* Tab Buttons */}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {/* Reviews Toggle Button */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowReviews(!showReviews); setShowDealsAndProducts(false); }}
            style={{
              flex: 1,
              padding: '8px 10px',
              background: showReviews ? 'var(--color-primary)' : 'var(--bg-surface-2)',
              color: showReviews ? '#fff' : 'var(--text-secondary)',
              border: `1px solid ${showReviews ? 'var(--color-primary)' : 'var(--border-subtle)'}`,
              borderRadius: 8,
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 150ms ease'
            }}
          >
            <Star size={14} fill={showReviews ? "#fff" : "none"} />
            {showReviews ? 'Hide Reviews' : 'Reviews'}
          </button>

          {/* Catalog & Deals Toggle Button */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowDealsAndProducts(!showDealsAndProducts); setShowReviews(false); }}
            style={{
              flex: 1,
              padding: '8px 10px',
              background: showDealsAndProducts ? 'var(--color-primary)' : 'var(--bg-surface-2)',
              color: showDealsAndProducts ? '#fff' : 'var(--text-secondary)',
              border: `1px solid ${showDealsAndProducts ? 'var(--color-primary)' : 'var(--border-subtle)'}`,
              borderRadius: 8,
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 150ms ease'
            }}
          >
            <Tag size={14} />
            {showDealsAndProducts ? 'Hide Deals' : 'Deals & Catalog'}
          </button>
        </div>

        {showReviews && (
          <ReviewSection
            businessId={biz.global_business_id}
            initialRatings={localRatings}
            initialReviewsCount={localReviewsCount}
            isLoggedIn={isLoggedIn}
            session={session}
            onReviewUpdated={(newAvg, newCount) => {
              setLocalRatings(newAvg);
              setLocalReviewsCount(newCount);
            }}
          />
        )}

        {showDealsAndProducts && (
          <DealsAndProductsSection
            businessId={biz.global_business_id}
            ownerId={biz.owner_id}
            isLoggedIn={isLoggedIn}
            session={session}
          />
        )}
      </div>

      {isOwner && (
        <div style={{
          padding: '10px 14px 14px',
          background: 'var(--bg-surface-2)',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8
        }}>
          <div style={{ fontSize: '0.725rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
            🛡️ Owner Dashboard
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button
              onClick={() => onAction('start_add_product', biz)}
              style={{
                padding: '7px 8px', borderRadius: 8, border: '1px solid var(--border-subtle)',
                background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '0.75rem',
                fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                transition: 'all 150ms ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-surface-2)'; e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
            >
              📦 Add Product
            </button>
            <button
              onClick={() => onAction('start_add_deal', biz)}
              style={{
                padding: '7px 8px', borderRadius: 8, border: '1px solid var(--border-subtle)',
                background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '0.75rem',
                fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                transition: 'all 150ms ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-surface-2)'; e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
            >
              🏷️ Add Deal
            </button>
            <button
              onClick={() => onAction('manage_products', biz)}
              style={{
                padding: '7px 8px', borderRadius: 8, border: '1px solid var(--border-subtle)',
                background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '0.75rem',
                fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                transition: 'all 150ms ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-surface-2)'; e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
            >
              📋 Manage Products
            </button>
            <button
              onClick={() => onAction('manage_deals', biz)}
              style={{
                padding: '7px 8px', borderRadius: 8, border: '1px solid var(--border-subtle)',
                background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '0.75rem',
                fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                transition: 'all 150ms ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-surface-2)'; e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
            >
              🔥 Manage Deals
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 4 }}>
            <button
              onClick={() => onAction('update', biz)}
              style={{
                padding: '7px 8px', borderRadius: 8, border: '1px solid #a7f3d0',
                background: '#ecfdf5', color: '#047857', fontSize: '0.75rem',
                fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                transition: 'all 150ms ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#d1fae5'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#ecfdf5'; }}
            >
              🔄 Update
            </button>
            <button
              onClick={handleToggleAnalytics}
              style={{
                padding: '7px 8px', borderRadius: 8, border: '1px solid #c084fc',
                background: '#faf5ff', color: '#7e22ce', fontSize: '0.75rem',
                fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                transition: 'all 150ms ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f3e8ff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#faf5ff'; }}
            >
              📊 Analytics
            </button>
            <button
              onClick={() => onAction('delete_business', biz.global_business_id)}
              style={{
                padding: '7px 8px', borderRadius: 8, border: '1px solid #fee2e2',
                background: '#fef2f2', color: '#dc2626', fontSize: '0.75rem',
                fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                transition: 'all 150ms ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fef2f2'; }}
            >
              🗑️ Delete
            </button>
          </div>

          {showAnalytics && (
            <div style={{
              marginTop: 10,
              padding: 12,
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>📈 Performance</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Real-time metrics</span>
              </div>
              {loadingAnalytics ? (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: 8 }}>Loading stats...</div>
              ) : analyticsData ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
                  <div style={{ padding: 6, background: 'var(--bg-surface-2)', borderRadius: 6 }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Views</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>{analyticsData.views}</div>
                  </div>
                  <div style={{ padding: 6, background: 'var(--bg-surface-2)', borderRadius: 6 }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Searches</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>{analyticsData.searches}</div>
                  </div>
                  <div style={{ padding: 6, background: 'var(--bg-surface-2)', borderRadius: 6 }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Leads</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>{analyticsData.leads}</div>
                  </div>
                  <div style={{ padding: 6, background: 'var(--bg-surface-2)', borderRadius: 6, gridColumn: 'span 3', display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    <span>Conversion Rate: <strong>{analyticsData.conversion_rate}%</strong></span>
                    <span>Avg Rating: <strong>{analyticsData.avg_rating} ⭐</strong></span>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.75rem', color: '#ef4444', textAlign: 'center' }}>Failed to load analytics.</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────

const MessageItem = ({ message, onAction, isLoggedIn, session, language = 'en', compareList }) => {
  console.log(message);
  const isBot = message.role === 'bot';
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [activeImage, setActiveImage] = useState(null);
  const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0);

  const formatFieldName = (field) =>
    field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const formatDate = (date) => new Date(date).toLocaleString();

  // ── THINKING ──────────────────────────────────────────
  if (message.type === 'thinking') {
    // Handled by TypingIndicator in ChatArea
    return null;
  }

  // ── BUSINESS PREVIEW CARD ────────────────────────────
  if (message.type === 'business_preview') {
    const data = message.content || {};
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, flexShrink: 0, marginTop: 2, marginRight: 8
        }}>
          🐝
        </div>
        <div style={{
          maxWidth: '85%',
          background: 'var(--bg-surface)',
          border: '2px solid var(--color-primary-border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-md)',
          animation: 'slideUp 300ms ease',
        }}>
          <div style={{
            padding: '12px 16px',
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
            color: 'white',
            fontWeight: 700,
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span>🏢 Business Registration Preview</span>
            <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 12 }}>Draft</span>
          </div>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px 12px', fontSize: '0.8125rem' }}>
              <strong style={{ color: 'var(--text-muted)' }}>Business Name:</strong>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{data.name}</span>

              <strong style={{ color: 'var(--text-muted)' }}>Category:</strong>
              <span style={{ color: 'var(--text-primary)' }}>{data.category}</span>

              <strong style={{ color: 'var(--text-muted)' }}>Registered Phone:</strong>
              <span style={{ color: 'var(--text-primary)' }}>{data.phone}</span>

              <strong style={{ color: 'var(--text-muted)' }}>Registered Email:</strong>
              <span style={{ color: 'var(--text-primary)' }}>{data.email}</span>

              <strong style={{ color: 'var(--text-muted)' }}>Address:</strong>
              <span style={{ color: 'var(--text-primary)' }}>{data.address}</span>

              <strong style={{ color: 'var(--text-muted)' }}>City / State:</strong>
              <span style={{ color: 'var(--text-primary)' }}>{data.city}, {data.state}</span>

              {data.area && (
                <>
                  <strong style={{ color: 'var(--text-muted)' }}>Area:</strong>
                  <span style={{ color: 'var(--text-primary)' }}>{data.area}</span>
                </>
              )}

              {/* Dynamic Category Specific Fields */}
              {Object.keys(data).map(key => {
                if (['name', 'category', 'phone', 'email', 'address', 'city', 'state', 'area', 'otp'].includes(key)) return null;
                return (
                  <React.Fragment key={key}>
                    <strong style={{ color: 'var(--color-primary)', textTransform: 'capitalize' }}>
                      {key.replace(/_/g, ' ')}:
                    </strong>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{data[key]}</span>
                  </React.Fragment>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button
                onClick={() => onAction('wizard_confirm')}
                style={{
                  flex: 1, padding: '9px 12px', background: '#10b981', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', transition: 'all 150ms'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#059669'}
                onMouseLeave={e => e.currentTarget.style.background = '#10b981'}
              >
                Confirm & Submit
              </button>
              <button
                onClick={() => onAction('wizard_edit')}
                style={{
                  flex: 1, padding: '9px 12px', background: 'var(--bg-surface-2)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', transition: 'all 150ms'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface-3)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-surface-2)'}
              >
                Start Over / Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── SEARCH OPTIONS ────────────────────────────────────
  if (message.type === 'search_options') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '4px 18px 18px 18px',
          padding: 14,
          maxWidth: '85%',
          boxShadow: 'var(--shadow-sm)',
          animation: 'slideUp 250ms ease',
        }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            {message.content}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => onAction('search_by_name')}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '9px 12px', background: 'var(--color-primary-light)', color: 'var(--color-primary)',
                border: '1px solid var(--color-primary-border)', borderRadius: 'var(--radius-md)',
                fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', transition: 'all var(--transition-fast)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-primary)'; e.currentTarget.style.color = 'white'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-primary-light)'; e.currentTarget.style.color = 'var(--color-primary)'; }}
            >
              <Type size={13} /> {message.labels?.name || 'By Name'}
            </button>
            <button
              onClick={() => onAction('search_by_address')}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '9px 12px', background: 'var(--color-primary-light)', color: 'var(--color-primary)',
                border: '1px solid var(--color-primary-border)', borderRadius: 'var(--radius-md)',
                fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', transition: 'all var(--transition-fast)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-primary)'; e.currentTarget.style.color = 'white'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-primary-light)'; e.currentTarget.style.color = 'var(--color-primary)'; }}
            >
              <MapPin size={13} /> {message.labels?.address || 'By Area'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── EXPLORE WELCOME (Initial two-button greeting) ─────
  if (message.type === 'explore_welcome') {
    const suggestions = message.suggestions || [];
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16, gap: 8 }}>
        {/* Bot avatar */}
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, flexShrink: 0, marginTop: 4,
        }}>
          🐝
        </div>
        <div style={{ maxWidth: '88%', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Greeting text */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '4px 18px 18px 18px',
            padding: '12px 16px',
            fontSize: '0.875rem',
            color: 'var(--text-primary)',
            boxShadow: 'var(--shadow-sm)',
            lineHeight: 1.5,
            fontWeight: 500,
          }}>
            <MarkdownText text={String(message.content || '')} />
            <p style={{ marginTop: 8, fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              What would you like to explore today?
            </p>
          </div>
          {/* Two big explore buttons */}
          {suggestions.length > 0 && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {suggestions.map((s, idx) => {
                const isBusinessBtn = s.query?.includes('business');
                return (
                  <button
                    key={idx}
                    onClick={() => onAction(s.action, s.query)}
                    style={{
                      flex: '1 1 140px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      padding: '18px 12px',
                      background: isBusinessBtn
                        ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)'
                        : 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 16,
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '0.875rem',
                      transition: 'all 200ms ease',
                      boxShadow: isBusinessBtn
                        ? '0 4px 16px rgba(79,70,229,0.35)'
                        : '0 4px 16px rgba(8,145,178,0.35)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)'; e.currentTarget.style.boxShadow = isBusinessBtn ? '0 8px 24px rgba(79,70,229,0.45)' : '0 8px 24px rgba(8,145,178,0.45)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; e.currentTarget.style.boxShadow = isBusinessBtn ? '0 4px 16px rgba(79,70,229,0.35)' : '0 4px 16px rgba(8,145,178,0.35)'; }}
                  >
                    <span style={{ fontSize: 24, lineHeight: 1 }}>
                      {isBusinessBtn ? '🏢' : '🛍️'}
                    </span>
                    <span>{s.title}</span>
                  </button>
                );
              })}
            </div>
          )}
          <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2, paddingLeft: 2 }}>
            💡 Or just type your question below
          </p>
        </div>
      </div>
    );
  }

  // ── FLOW STEP (City/Category/Product picker chips) ─────
  if (message.type === 'flow_step') {
    const suggestions = message.suggestions || [];
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16, gap: 8 }}>
        {/* Bot avatar */}
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, flexShrink: 0, marginTop: 4,
        }}>
          🐝
        </div>
        <div style={{ maxWidth: '92%', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Step question */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '4px 18px 18px 18px',
            padding: '12px 16px',
            fontSize: '0.875rem',
            color: 'var(--text-primary)',
            boxShadow: 'var(--shadow-sm)',
            lineHeight: 1.5,
          }}>
            <MarkdownText text={String(message.content || '')} />
          </div>
          {/* Chips grid */}
          {suggestions.length > 0 && (
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              paddingLeft: 2,
            }}>
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => onAction(s.action, s.query)}
                  style={{
                    padding: '7px 16px',
                    background: 'var(--bg-surface)',
                    border: '1.5px solid var(--border-subtle)',
                    borderRadius: 999,
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    transition: 'all 150ms ease',
                    boxShadow: 'var(--shadow-sm)',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'var(--color-primary)';
                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                    e.currentTarget.style.color = 'white';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(79,70,229,0.25)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'var(--bg-surface)';
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                  }}
                >
                  {s.title}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── WELCOME CARD ──────────────────────────────────────
  if (message.type === 'welcome_card') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
        <div style={{
          maxWidth: '85%',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
          animation: 'slideUp 300ms ease',
        }}>
          <div style={{
            height: 64,
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28,
          }}>
            🐝
          </div>
          <div style={{ padding: 16 }}>
            <h3 style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: 12 }}>
              {message.content}
            </h3>
            {isLoggedIn ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {session?.type === 'BUSINESS' ? (
                  <>
                    <ActionBtn onClick={() => onAction('search')} color="blue" icon={<Search size={14} />}>
                      Show My Business
                    </ActionBtn>
                    <ActionBtn onClick={() => onAction('update')} color="green" icon={<RefreshCw size={14} />}>
                      Update My Business
                    </ActionBtn>
                  </>
                ) : (
                  <ActionBtn onClick={() => onAction('add_new_business')} color="indigo" icon={<PlusCircle size={14} />}>
                    Add Your Business Now
                  </ActionBtn>
                )}
              </div>
            ) : (
              <div style={{ marginTop: 4 }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                  Login to access business tools
                </p>
                <ActionBtn onClick={() => onAction('login_trigger')} color="indigo" icon={<LogIn size={14} />}>
                  Login Now
                </ActionBtn>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── SUGGESTIONS GRID ──────────────────────────────────
  if (message.type === 'suggestions') {
    const suggestions = Array.isArray(message.content) ? message.content : [];
    if (suggestions.length === 0) {
      return (
        <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
          <div style={{
            background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 'var(--radius-lg)',
            padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.875rem',
          }}>
            <div style={{ width: 28, height: 28, background: '#10b981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700 }}>✓</div>
            <span style={{ color: '#065f46' }}>Your profile looks complete!</span>
          </div>
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16, maxWidth: '95%', animation: 'slideUp 300ms ease' }}>
        {message.intro && (
          <div style={{
            padding: '10px 14px', background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)', borderRadius: '4px 18px 18px 18px',
            fontSize: '0.875rem', color: 'var(--text-primary)', boxShadow: 'var(--shadow-sm)',
          }}>
            <MarkdownText text={message.intro} />
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
          {suggestions.map((item, idx) => (
            <div
              key={idx}
              onClick={() => onAction(item.action || 'update_specific', item.field)}
              style={{
                background: 'var(--bg-surface)', border: `1px solid ${item.is_missing ? '#fed7aa' : 'var(--border-subtle)'}`,
                borderRadius: 'var(--radius-lg)', padding: '12px 14px',
                cursor: 'pointer', transition: 'all var(--transition-base)',
                position: 'relative', overflow: 'hidden',
                borderLeft: `3px solid ${item.is_missing ? '#f97316' : 'var(--color-primary)'}`,
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateX(2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateX(0)'; }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)' }}>{item.title}</span>
                    {item.is_missing && (
                      <span className="badge badge-warning" style={{ fontSize: '0.5625rem' }}>Missing</span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{item.reason}</p>
                </div>
                <ArrowRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // __ Resend OTP ________________________________________
  if (message.type === 'otp') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
        <div className="chat-bubble-bot">
          <div style={{ marginBottom: 10 }}>
            {message.content}
          </div>

          <button
            onClick={() => onAction('resend_otp')}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid var(--color-primary)',
              background: 'blue',
              cursor: 'pointer',
              gap: '10px',
              margin: '10px',
              fontWeight: 600
            }}
          >
            🔄 Resend OTP
          </button>
          <button
            onClick={() => onAction('change_email')}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid var(--color-primary)',
              background: 'blue',
              cursor: 'pointer',
              gap: '10px',
              margin: '10px',
              fontWeight: 600
            }}
          >
            ✏️ Change Email
          </button>
        </div>
      </div>
    );
  }

  // ── AUTH PROMPT ───────────────────────────────────────
  if (message.type === 'auth_prompt') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16, animation: 'slideUp 250ms ease' }}>
        <div style={{
          maxWidth: '85%', background: 'var(--color-error-light)',
          border: '1px solid #fca5a5', borderRadius: 'var(--radius-lg)', padding: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
            <AlertCircle style={{ color: 'var(--color-error)', flexShrink: 0, marginTop: 1 }} size={16} />
            <p style={{ fontSize: '0.875rem', color: '#991b1b', lineHeight: 1.5 }}>{message.content}</p>
          </div>
          <ActionBtn onClick={() => onAction('login_trigger')} color="red" icon={<LogIn size={14} />}>
            Login / Register
          </ActionBtn>
        </div>
      </div>
    );
  }

  // ── PRODUCT SEARCH DATABASE RESPONSE ──────────────────
  if (message.type === 'database_products') {
    const items = Array.isArray(message.content) ? message.content
      : Array.isArray(message.data) ? message.data : [];

    if (items.length === 0) {
      return (
        <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
          <div className="chat-bubble-bot">No products found.</div>
        </div>
      );
    }

    return (
      <div style={{ marginBottom: 16, animation: 'slideUp 300ms ease', maxWidth: '100%' }}>
        {message.intro && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 8 }}>
            <div className="chat-bubble-bot">{message.intro}</div>
          </div>
        )}

        {/* Responsive Grid Layout for Product Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 14,
          marginTop: 10,
          marginBottom: 10
        }}>
          {items.map((prod, idx) => (
            <ProductCard key={prod.id || idx} prod={prod} onAction={onAction} />
          ))}
        </div>

        {/* Suggestion Chips */}
        {message.suggestions && message.suggestions.length > 0 && message.suggestions.some(s => s.query) && (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 12,
            justifyContent: 'flex-start'
          }}>
            {message.suggestions.filter(s => s.query).map((s, idx) => (
              <button
                key={idx}
                onClick={() => onAction(s.action, s.query)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-full)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  transition: 'all var(--transition-fast)',
                  boxShadow: 'var(--shadow-sm)',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                  e.currentTarget.style.color = 'var(--color-primary)';
                  e.currentTarget.style.background = 'var(--color-primary-light)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  e.currentTarget.style.background = 'var(--bg-surface)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                }}
              >
                {s.title}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── DATABASE RESPONSE ─────────────────────────────────
  if (message.type === 'database') {
    const items = Array.isArray(message.content) ? message.content
      : Array.isArray(message.data) ? message.data : [];

    if (items.length === 0) {
      return (
        <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
          <div className="chat-bubble-bot">No results found.</div>
        </div>
      );
    }

    return (
      <div style={{ marginBottom: 16, animation: 'slideUp 300ms ease', maxWidth: '100%' }}>
        {message.intro && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 8 }}>
            <div className="chat-bubble-bot">{message.intro}</div>
          </div>
        )}

        {/* Responsive Grid Layout for Business Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 14,
          marginTop: 10,
          marginBottom: 10
        }}>
          {items.map((biz, idx) => (
            <BusinessCard key={biz.global_business_id || idx} biz={biz} onAction={onAction} isLoggedIn={isLoggedIn} session={session} compareList={compareList} mode={message.mode} />
          ))}
        </div>

        {/* Inline suggestions for missing fields (profile updates) */}
        {message.suggestions && message.suggestions.length > 0 && message.suggestions.some(s => s.field) && (
          <div style={{
            background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-lg)',
            padding: 12, marginTop: 8,
          }}>
            {message.prompt && (
              <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                {message.prompt}
              </p>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <TrendingUp size={14} style={{ color: '#f59e0b' }} />
              <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Update Your Profile
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {message.suggestions.filter(s => s.field).map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => onAction(s.action || 'update_specific', s.field)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '9px 12px', background: 'white', border: '1px solid #fde68a',
                    borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left',
                    transition: 'all var(--transition-fast)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#fef3c7'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}
                >
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>{s.title}</span>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>{s.reason}</span>
                  </div>
                  <ChevronRight size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sleek, wrapping horizontal row of ChatGPT-style suggestion chips (for pagination/filters) */}
        {message.suggestions && message.suggestions.length > 0 && message.suggestions.some(s => s.query) && (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 12,
            justifyContent: 'flex-start'
          }}>
            {message.suggestions.filter(s => s.query).map((s, idx) => (
              <button
                key={idx}
                onClick={() => onAction(s.action, s.query)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-full)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  transition: 'all var(--transition-fast)',
                  boxShadow: 'var(--shadow-sm)',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                  e.currentTarget.style.color = 'var(--color-primary)';
                  e.currentTarget.style.background = 'var(--color-primary-light)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  e.currentTarget.style.background = 'var(--bg-surface)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                }}
              >
                {s.title}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── UPDATE CONTROLS ────────────────────────────────────
  if (message.type === 'update_controls') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)', padding: '8px 12px',
          display: 'flex', gap: 6,
        }}>
          {[
            { label: '↩ Undo', action: 'undo', color: 'inherit' },
            { label: '🕘 History', action: 'history', color: 'inherit' },
            { label: '✖ Stop', action: 'stop_update', color: 'var(--color-error)' },
          ].map(b => (
            <button
              key={b.action}
              onClick={() => onAction(b.action)}
              style={{
                padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)',
                background: 'transparent', cursor: 'pointer', fontSize: '0.75rem',
                fontWeight: 600, color: b.color || 'var(--text-secondary)',
                transition: 'all var(--transition-fast)',
              }}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── HISTORY ───────────────────────────────────────────
  if (message.type === 'history') {
    return (
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)', padding: 14, maxWidth: '85%', marginBottom: 12,
      }}>
        <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: 10 }}>🕒 Update History</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(message.content || []).map(item => (
            <div key={item.id} style={{ borderLeft: '3px solid var(--color-primary)', paddingLeft: 10 }}>
              <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
                {formatFieldName(item.field_name)}
              </div>
              <div style={{ fontSize: '0.75rem', marginTop: 2 }}>
                <span style={{ textDecoration: 'line-through', color: 'var(--color-error)', marginRight: 6 }}>{item.old_value}</span>
                <span style={{ color: 'var(--text-muted)' }}>→</span>
                <span style={{ color: 'var(--color-success)', fontWeight: 600, marginLeft: 6 }}>{item.new_value}</span>
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>{formatDate(item.updated_at)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── MANAGE PRODUCTS ───────────────────────────────────
  if (message.type === 'manage_products') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16, animation: 'slideUp 300ms ease' }}>
        {message.intro && (
          <div style={{
            padding: '8px 12px', background: 'var(--color-primary-light)',
            border: '1px solid var(--color-primary-border)', borderRadius: 'var(--radius-md)',
            fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-primary)',
          }}>
            ✨ {message.intro}
          </div>
        )}
        {(message.content || []).map(p => (
          <div key={p.id} className="product-card">
            <div
              style={{
                width: 52, height: 52, background: 'var(--bg-surface-2)', borderRadius: 12,
                overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, border: '1px solid var(--border-subtle)', cursor: p.image_url ? 'pointer' : 'default',
              }}
              onClick={() => { if (p.image_url) { setActiveImage(p.image_url); setIsPreviewOpen(true); } }}
            >
              {p.image_url
                ? <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 20 }}>📦</span>
              }
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#059669', background: '#d1fae5', padding: '1px 8px', borderRadius: 6, border: '1px solid #6ee7b7' }}>₹{p.price}</span>
                {p.category && <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{p.category}</span>}
              </div>
            </div>
            <button
              onClick={() => onAction('delete_product', p.global_product_id)}
              title="Delete Product"
              style={{ padding: 8, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', transition: 'all var(--transition-fast)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-error)'; e.currentTarget.style.background = 'var(--color-error-light)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}

        {/* Image preview modal */}
        {isPreviewOpen && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)',
            animation: 'fadeIn 200ms ease',
          }}>
            <button onClick={() => setIsPreviewOpen(false)} style={{
              position: 'absolute', top: 20, right: 20, padding: 8, borderRadius: '50%',
              border: 'none', background: 'rgba(255,255,255,0.15)', cursor: 'pointer', color: 'white',
            }}>
              <X size={22} />
            </button>
            <img src={activeImage} className="animate-scale-in" alt="Preview"
              style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-xl)' }} />
          </div>
        )}
      </div>
    );
  }

  // ── MANAGE DEALS ──────────────────────────────────────
  if (message.type === 'manage_deals') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16, animation: 'slideUp 300ms ease' }}>
        {message.intro && (
          <div style={{
            padding: '8px 12px', background: '#fdf2f8',
            border: '1px solid #f9a8d4', borderRadius: 'var(--radius-md)',
            fontSize: '0.8rem', fontWeight: 700, color: '#9d174d',
          }}>
            🔥 {message.intro}
          </div>
        )}
        {(message.content || []).map(d => (
          <div key={d.id} className="deal-card">
            <div style={{ width: 44, height: 44, background: '#fdf2f8', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
              🏷️
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#be185d', background: '#fce7f3', padding: '1px 8px', borderRadius: 6, border: '1px solid #f9a8d4' }}>{d.discount_pct}% OFF</span>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600 }}>Until {d.expiry_date}</span>
              </div>
            </div>
            <button
              onClick={() => onAction('delete_deal', d.global_deal_id)}
              title="Delete Deal"
              style={{ padding: 8, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', transition: 'all var(--transition-fast)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-error)'; e.currentTarget.style.background = 'var(--color-error-light)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    );
  }

  // ── STANDARD TEXT / FAQ ───────────────────────────────
  const content = String(message.content || '');
  const textSuggestions = (message.suggestions || []).filter(s => s.query);
  return (
    <div style={{ display: 'flex', justifyContent: isBot ? 'flex-start' : 'flex-end', marginBottom: 12, gap: 8 }}>
      {/* Bot avatar */}
      {isBot && (
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, flexShrink: 0, marginTop: 2,
        }}>
          🐝
        </div>
      )}

      <div style={{ maxWidth: '82%', display: 'flex', flexDirection: 'column', gap: 4, alignItems: isBot ? 'flex-start' : 'flex-end' }}>
        <div className={isBot ? 'chat-bubble-bot' : 'chat-bubble-user'}>
          {isBot ? <MarkdownText text={content} /> : content}
        </div>
        {/* Actions row for bot messages (Copy & Speak) */}
        {isBot && content.length > 20 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CopyButton text={content} />
            <SpeakerButton text={content} language={language} />
          </div>
        )}
        {/* Suggestion chips for faq/text messages with query suggestions */}
        {isBot && textSuggestions.length > 0 && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 6
          }}>
            {textSuggestions.map((s, idx) => (
              <button
                key={idx}
                onClick={() => onAction(s.action, s.query)}
                style={{
                  padding: '6px 14px',
                  background: 'var(--bg-surface)',
                  border: '1.5px solid var(--border-subtle)',
                  borderRadius: 999,
                  cursor: 'pointer',
                  fontSize: '0.775rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  transition: 'all 150ms ease',
                  boxShadow: 'var(--shadow-sm)',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--color-primary)';
                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                  e.currentTarget.style.color = 'white';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'var(--bg-surface)';
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {s.title}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Helper: colored action button
function ActionBtn({ onClick, color, icon, children }) {
  const colors = {
    indigo: { bg: 'var(--color-primary)', text: 'white', hover: 'var(--color-primary-hover)' },
    blue: { bg: '#3b82f6', text: 'white', hover: '#2563eb' },
    green: { bg: '#10b981', text: 'white', hover: '#059669' },
    red: { bg: '#ef4444', text: 'white', hover: '#dc2626' },
  };
  const c = colors[color] || colors.indigo;
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '9px 16px', background: c.bg, color: c.text,
        border: 'none', borderRadius: 'var(--radius-md)',
        fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer',
        transition: 'all var(--transition-fast)',
        boxShadow: 'var(--shadow-sm)',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = c.hover; e.currentTarget.style.transform = 'scale(0.99)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = c.bg; e.currentTarget.style.transform = 'scale(1)'; }}
    >
      {icon}{children}
    </button>
  );
}

export default MessageItem;
