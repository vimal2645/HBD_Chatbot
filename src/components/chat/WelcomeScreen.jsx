import React from 'react';
import { Sparkles, Building2, MapPin, Star, Flame, Compass } from 'lucide-react';

const POPULAR_CATEGORIES = [
  { icon: '🍕', label: 'Restaurants', query: 'Restaurants' },
  { icon: '🏋️', label: 'Gyms', query: 'Gyms' },
  { icon: '🏨', label: 'Hotels', query: 'Hotels' },
  { icon: '🏥', label: 'Hospitals', query: 'Hospitals' },
  { icon: '💅', label: 'Beauty Salons', query: 'Beauty Salons' },
  { icon: '🏫', label: 'Schools', query: 'Schools' },
];

const TRENDING_SEARCHES = [
  { label: 'Best Restaurants in India 🍕', query: 'Best Restaurants in India' },
  { label: 'Top Hotels in India 🏨', query: 'Top Hotels in India' },
  { label: 'Top Hospitals in India 🏥', query: 'Top Hospitals in India' },
  { label: 'Top Gyms in India 🏋️', query: 'Top Gyms in India' },
  { label: 'Most Rated Businesses ⭐', query: 'Most Rated Businesses' },
  { label: 'Recently Added Businesses 🆕', query: 'Recently Added Businesses' },
];

const POPULAR_CITIES = [
  { name: 'Delhi', flag: '🏛️' },
  { name: 'Mumbai', flag: '🌊' },
  { name: 'Bangalore', flag: '💻' },
  { name: 'Hyderabad', flag: '🕌' },
  { name: 'Pune', flag: '🎓' },
  { name: 'Ahmedabad', flag: '🧵' },
  { name: 'Surat', flag: '💎' },
  { name: 'Lucknow', flag: '🍢' },
  { name: 'Jaipur', flag: '🏰' },
  { name: 'Kolkata', flag: '🌉' }
];

export default function WelcomeScreen({ onSend }) {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 24px',
      textAlign: 'center',
      overflowY: 'auto',
      background: 'linear-gradient(to bottom, var(--bg-main), var(--bg-surface))',
      width: '100%',
    }}>
      {/* Sparkle Badge */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 14px',
        background: 'rgba(79, 70, 229, 0.08)',
        border: '1px solid rgba(79, 70, 229, 0.2)',
        borderRadius: '100px',
        fontSize: '0.75rem',
        fontWeight: 700,
        color: '#4f46e5',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: 20,
        animation: 'fadeIn 400ms ease',
      }}>
        <Sparkles size={12} style={{ color: '#6366f1' }} />
        AI Business Discovery Engine
      </div>

      {/* Welcome Heading */}
      <h2 style={{
        fontSize: '1.75rem',
        fontWeight: 850,
        background: 'linear-gradient(135deg, #1e1b4b 0%, #4f46e5 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        lineHeight: 1.25,
        marginBottom: 12,
        animation: 'slideUp 350ms ease',
        letterSpacing: '-0.02em',
      }}>
        👋 Welcome to HoneyBee Digital AI
      </h2>

      {/* Description */}
      <p style={{
        fontSize: '0.925rem',
        color: 'var(--text-secondary)',
        maxWidth: 550,
        lineHeight: 1.6,
        marginBottom: 32,
        animation: 'slideUp 400ms ease',
      }}>
        I can help you find local businesses, compare services side-by-side, view contact details, or manage your business listings. Try clicking one of the popular categories or trending searches below.
      </p>

      {/* Categories Section */}
      <div style={{
        width: '100%',
        maxWidth: 640,
        marginBottom: 24,
        textAlign: 'left',
        animation: 'slideUp 450ms ease',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: '0.85rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: 12,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          <Compass size={14} style={{ color: '#4f46e5' }} />
          Explore Categories
        </div>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
        }}>
          {POPULAR_CATEGORIES.map((c, i) => (
            <button
              key={i}
              onClick={() => onSend(c.query)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#4f46e5';
                e.currentTarget.style.color = '#4f46e5';
                e.currentTarget.style.background = 'rgba(79, 70, 229, 0.04)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.background = 'var(--bg-surface)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <span style={{ fontSize: 16 }}>{c.icon}</span>
              <span>{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Trending Section */}
      <div style={{
        width: '100%',
        maxWidth: 640,
        marginBottom: 24,
        textAlign: 'left',
        animation: 'slideUp 500ms ease',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: '0.85rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: 12,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          <Flame size={14} style={{ color: '#ef4444' }} />
          🇮🇳 Trending Across India
        </div>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
        }}>
          {TRENDING_SEARCHES.map((t, i) => (
            <button
              key={i}
              onClick={() => onSend(t.query)}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 14px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '30px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontSize: '0.8rem',
                fontWeight: 500,
                color: 'var(--text-secondary)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#ef4444';
                e.currentTarget.style.color = '#ef4444';
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.04)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.background = 'var(--bg-surface)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Popular Cities Section */}
      <div style={{
        width: '100%',
        maxWidth: 640,
        marginBottom: 36,
        textAlign: 'left',
        animation: 'slideUp 525ms ease',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: '0.85rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: 12,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          <MapPin size={14} style={{ color: '#10b981' }} />
          Popular Cities
        </div>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
        }}>
          {POPULAR_CITIES.map((c, i) => (
            <button
              key={i}
              onClick={() => onSend(`businesses in ${c.name}`)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '30px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontSize: '0.8rem',
                fontWeight: 500,
                color: 'var(--text-secondary)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#10b981';
                e.currentTarget.style.color = '#10b981';
                e.currentTarget.style.background = 'rgba(16, 185, 129, 0.04)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.background = 'var(--bg-surface)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <span>{c.flag}</span>
              <span>{c.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Directory Stats */}
      <div style={{
        display: 'flex',
        gap: 24,
        marginTop: 12,
        animation: 'slideUp 550ms ease',
      }}>
        {[
          { icon: <Building2 size={15} style={{ color: '#6366f1' }} />, label: '5,000+ Businesses' },
          { icon: <MapPin size={15} style={{ color: '#10b981' }} />, label: '50+ Indian Cities' },
          { icon: <Star size={15} style={{ color: '#f59e0b' }} />, label: 'Verified Listing Details' },
        ].map((s, i) => (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.78rem',
            fontWeight: 650,
            color: 'var(--text-muted)',
            background: 'var(--bg-surface)',
            padding: '6px 12px',
            borderRadius: '8px',
            border: '1px solid var(--border-subtle)',
          }}>
            {s.icon} {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}
