import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Phone, User, ArrowRight, Loader2, Key, HelpCircle, Shield, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { UI_TRANSLATIONS } from '../constants/Translations';

export default function LoginPage(props) {
  const {
    isLoggedIn,
    setIsLoggedIn,
    session,
    setSession,
    toast,
  } = props;

  const navigate = useNavigate();

  useEffect(() => {
    if (isLoggedIn) {
      navigate('/chat');
    }
  }, [isLoggedIn, navigate]);

  const [isSignUp, setIsSignUp] = useState(false);
  const [role, setRole] = useState('user'); // user | owner
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const validateForm = () => {
    setError('');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!formData.email.trim()) {
      setError('Email address is required.');
      return false;
    }
    if (!emailRegex.test(formData.email.trim())) {
      setError('Please enter a valid email address.');
      return false;
    }
    if (formData.phone && formData.phone.replace(/\D/g, '').length !== 10) {
      setError('Phone number must be exactly 10 digits.');
      return false;
    }
    if (!formData.password) {
      setError('Password is required.');
      return false;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return false;
    }
    if (isSignUp && formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setError('');

    const emailVal = formData.email.trim().toLowerCase();
    const phoneVal = formData.phone.trim() || null;
    const pwdVal = formData.password;

    try {
      if (isSignUp) {
        // Register Flow
        const res = await api.authRegister(emailVal, phoneVal, pwdVal, role);
        if (res.success) {
          toast?.success('Account created successfully!');
          await handleLoginSuccess(res.user, res.token);
        } else {
          setError(res.message || 'Registration failed.');
        }
      } else {
        // Login Flow
        const res = await api.authLogin(emailVal, phoneVal, pwdVal);
        if (res.success) {
          toast?.success('Logged in successfully!');
          await handleLoginSuccess(res.user, res.token);
        } else {
          setError(res.message || 'Login failed.');
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSuccess = async (user, token) => {
    setIsLoggedIn(true);
    localStorage.setItem('isLoggedIn', 'true');

    if (user.role === 'owner' || user.role === 'merchant') {
      // Fetch merchant's business listings
      try {
        const res = await api.getMerchantBusinesses();
        if (res.success && res.businesses && res.businesses.length > 0) {
          const biz = res.businesses[0];
          const sessionData = {
            type: 'BUSINESS',
            businessId: biz.global_business_id,
            city: biz.city,
            phone: user.phone || biz.phone_number || null,
            email: user.email,
          };
          setSession(sessionData);
          localStorage.setItem('session', JSON.stringify(sessionData));
        } else {
          // Merchant exists but has no business registered yet
          const sessionData = {
            type: 'BUSINESS',
            businessId: null,
            city: null,
            phone: user.phone,
            email: user.email,
          };
          setSession(sessionData);
          localStorage.setItem('session', JSON.stringify(sessionData));
        }
      } catch (err) {
        console.error('Error fetching businesses:', err);
        // Fallback session state
        const sessionData = {
          type: 'BUSINESS',
          businessId: null,
          city: null,
          phone: user.phone,
          email: user.email,
        };
        setSession(sessionData);
        localStorage.setItem('session', JSON.stringify(sessionData));
      }
    } else {
      // Customer / User role
      const sessionData = {
        type: 'USER',
        phone: user.phone,
        email: user.email,
        businessId: null,
      };
      setSession(sessionData);
      localStorage.setItem('session', JSON.stringify(sessionData));
    }

    navigate('/chat');
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '80vh',
      padding: '40px 20px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 450,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 20,
        boxShadow: 'var(--shadow-lg)',
        padding: '36px 30px',
        backdropFilter: 'blur(20px)',
        transition: 'all 0.3s ease',
      }}>
        {/* Toggle between Sign In & Sign Up */}
        <div style={{
          display: 'flex',
          background: 'var(--bg-surface-2)',
          borderRadius: 12,
          padding: 4,
          marginBottom: 30,
        }}>
          <button
            type="button"
            onClick={() => { setIsSignUp(false); setError(''); }}
            style={{
              flex: 1,
              padding: '10px 0',
              border: 'none',
              background: !isSignUp ? 'var(--bg-surface)' : 'transparent',
              color: !isSignUp ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: '0.875rem',
              cursor: 'pointer',
              boxShadow: !isSignUp ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsSignUp(true); setError(''); }}
            style={{
              flex: 1,
              padding: '10px 0',
              border: 'none',
              background: isSignUp ? 'var(--bg-surface)' : 'transparent',
              color: isSignUp ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: '0.875rem',
              cursor: 'pointer',
              boxShadow: isSignUp ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            Register
          </button>
        </div>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
            {isSignUp ? 'Create an Account' : 'Welcome Back'}
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            {isSignUp ? 'Join Honeybee Digital local business directory' : 'Sign in to access your dashboard'}
          </p>
        </div>

        {/* Role Selection (Only shown during Sign Up) */}
        {isSignUp && (
          <div style={{ marginBottom: 24 }}>
            <label style={{
              display: 'block',
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: 'var(--text-secondary)',
              marginBottom: 10,
              letterSpacing: '0.05em',
            }}>
              Select Account Type:
            </label>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={() => setRole('user')}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '12px 10px',
                  border: '2px solid ' + (role === 'user' ? 'var(--color-primary)' : 'var(--border-subtle)'),
                  borderRadius: 12,
                  background: role === 'user' ? 'var(--bg-surface-2)' : 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <User size={16} />
                Customer User
              </button>
              <button
                type="button"
                onClick={() => setRole('owner')}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '12px 10px',
                  border: '2px solid ' + (role === 'owner' ? 'var(--color-primary)' : 'var(--border-subtle)'),
                  borderRadius: 12,
                  background: role === 'owner' ? 'var(--bg-surface-2)' : 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <Shield size={16} />
                Merchant User
              </button>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--bg-surface-error, #fef2f2)',
            border: '1px solid var(--border-error, #fecaca)',
            color: 'var(--text-error, #dc2626)',
            padding: 12,
            borderRadius: 10,
            marginBottom: 20,
            fontSize: '0.8125rem',
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Email input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Email Address</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Mail size={16} style={{ position: 'absolute', left: 14, color: 'var(--text-muted)' }} />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="example@domain.com"
                required
                style={{
                  width: '100%',
                  background: 'var(--bg-surface-2)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 10,
                  padding: '12px 14px 12px 42px',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                  outline: 'none',
                  transition: 'border-color 0.2s ease',
                }}
              />
            </div>
          </div>

          {/* Phone input (optional) */}
          {isSignUp && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Phone Number (Optional)</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Phone size={16} style={{ position: 'absolute', left: 14, color: 'var(--text-muted)' }} />
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="10-digit number"
                  style={{
                    width: '100%',
                    background: 'var(--bg-surface-2)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 10,
                    padding: '12px 14px 12px 42px',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                    outline: 'none',
                    transition: 'border-color 0.2s ease',
                  }}
                />
              </div>
            </div>
          )}

          {/* Password input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Password</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Lock size={16} style={{ position: 'absolute', left: 14, color: 'var(--text-muted)' }} />
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                required
                style={{
                  width: '100%',
                  background: 'var(--bg-surface-2)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 10,
                  padding: '12px 14px 12px 42px',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                  outline: 'none',
                  transition: 'border-color 0.2s ease',
                }}
              />
            </div>
          </div>

          {/* Confirm Password input (Only shown during Sign Up) */}
          {isSignUp && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Confirm Password</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Key size={16} style={{ position: 'absolute', left: 14, color: 'var(--text-muted)' }} />
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%',
                    background: 'var(--bg-surface-2)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 10,
                    padding: '12px 14px 12px 42px',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                    outline: 'none',
                    transition: 'border-color 0.2s ease',
                  }}
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '12px 0',
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              color: 'white',
              border: 'none',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: '0.875rem',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
              marginTop: 10,
              transition: 'transform 0.1s ease',
            }}
            onMouseDown={e => { if(!isLoading) e.currentTarget.style.transform = 'scale(0.98)'; }}
            onMouseUp={e => { if(!isLoading) e.currentTarget.style.transform = 'scale(1)'; }}
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                <span>{isSignUp ? 'Sign Up' : 'Sign In'}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Toggle Mode Link at bottom */}
        <div style={{
          textAlign: 'center',
          marginTop: 20,
          fontSize: '0.875rem',
          color: 'var(--text-secondary)'
        }}>
          {isSignUp ? (
            <span>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setIsSignUp(false); setError(''); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-primary, #4f46e5)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline'
                }}
              >
                Sign In here
              </button>
            </span>
          ) : (
            <span>
              First time here?{' '}
              <button
                type="button"
                onClick={() => { setIsSignUp(true); setError(''); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-primary, #4f46e5)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline'
                }}
              >
                Register an account
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
