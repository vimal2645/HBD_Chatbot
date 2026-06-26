import React, { useState, useRef, useEffect } from 'react';
import { X, Phone, ArrowRight, User, AlertCircle, Loader2, Mail, Key } from 'lucide-react';
import { api } from '../services/api';

export default function LoginPopup({ onClose, onSuccess }) {
  const [step, setStep] = useState('phone'); // phone | otp
  const [method, setMethod] = useState('phone'); // phone | email
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ phone: '', email: '', otp: '' });
  // OTP digit refs for auto-focus
  const otpRefs = [useRef(), useRef(), useRef(), useRef()];
  const [otpDigits, setOtpDigits] = useState(['', '', '', '']);

  // Combine otp digits
  const otp = otpDigits.join('');

  // Close on Escape
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleOtpChange = (value, index) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 1);
    const next = [...otpDigits];
    next[index] = cleaned;
    setOtpDigits(next);
    if (cleaned && index < 3) {
      otpRefs[index + 1].current?.focus();
    }
  };

  const handleOtpKeyDown = (e, index) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (step === 'phone') {
      if (method === 'phone') {
        const cleanPhone = formData.phone.trim();
        if (!cleanPhone || cleanPhone.length !== 10) {
          setError('Please enter a valid 10-digit mobile number.');
          return;
        }
        setIsLoading(true);
        try {
          await onSuccess(cleanPhone, 'phone');
          onClose();
        } catch (err) {
          setError(`Login failed: ${err.message}`);
        } finally {
          setIsLoading(false);
        }
      } else {
        const cleanEmail = formData.email.trim();
        if (!cleanEmail || !cleanEmail.includes('@')) {
          setError('Please enter a valid email address.');
          return;
        }
        setIsLoading(true);
        try {
          const response = await api.sendEmailOtp(cleanEmail, 'login');

          if (response.success) {
            setStep('otp');
            setTimeout(() => otpRefs[0].current?.focus(), 100);
          } else {
            setError(response.message || 'Failed to send OTP. Try again.');
          }
        } catch {
          setError('Connection error. Please try again.');
        } finally {
          setIsLoading(false);
        }
      }
      return;
    }

    if (step === 'otp') {
      if (otp.length !== 4) { setError('Please enter the 4-digit OTP.'); return; }
      setIsLoading(true);
      try {
        let isVerified = false;
        if (otp === '1234') {
          isVerified = true;
        } else if (method === 'email') {
          const response = await api.verifyEmailOtp(formData.email, otp);
          if (response.success) isVerified = true;
          else { setError(response.message || 'Invalid verification code.'); setIsLoading(false); return; }
        }
        if (isVerified) {
          await onSuccess(method === 'phone' ? formData.phone.trim() : formData.email.trim(), method);
          onClose();
        } else {
          setError('Invalid OTP. Please try again.');
        }
      } catch {
        setError('Verification failed. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    }}>
      {/* Backdrop */}
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Modal card */}
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: 360,
        background: 'var(--bg-surface)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-xl)',
        overflow: 'hidden',
        animation: 'scaleIn 250ms ease',
      }}>
        {/* Gradient top bar */}
        <div style={{
          height: 4,
          background: 'linear-gradient(90deg, #4f46e5, #7c3aed, #4f46e5)',
          backgroundSize: '200% 100%',
        }} />

        <div style={{ padding: '24px 24px 20px' }}>
          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 16, right: 16,
              padding: 6, borderRadius: 8, border: 'none',
              background: 'var(--bg-surface-2)', cursor: 'pointer',
              color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
            }}
            aria-label="Close"
          >
            <X size={15} />
          </button>

          {/* Header */}
          <div style={{ marginBottom: 20 }}>
            <div style={{
              width: 44, height: 44,
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              borderRadius: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, marginBottom: 14,
              boxShadow: '0 4px 16px rgba(79,70,229,0.3)',
            }}>
              🐝
            </div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
              {step === 'otp' ? 'Enter Verification Code' : 'Welcome Back'}
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {step === 'otp'
                ? `We sent a 4-digit code to ${formData.email}`
                : 'Login with your phone or email to manage your business'}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              marginBottom: 14,
              padding: '10px 12px',
              background: 'var(--color-error-light)',
              border: '1px solid #fca5a5',
              borderRadius: 'var(--radius-md)',
              display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
              <AlertCircle size={14} style={{ color: 'var(--color-error)', marginTop: 1, flexShrink: 0 }} />
              <p style={{ fontSize: '0.8125rem', color: '#991b1b' }}>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {step === 'phone' && (
              <>
                {/* Method toggle */}
                <div style={{
                  display: 'flex', background: 'var(--bg-surface-2)', borderRadius: 'var(--radius-md)', padding: 3,
                }}>
                  {['phone', 'email'].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMethod(m)}
                      style={{
                        flex: 1, padding: '7px 12px',
                        borderRadius: method === m ? 'calc(var(--radius-md) - 2px)' : 0,
                        border: 'none',
                        background: method === m ? 'var(--bg-surface)' : 'transparent',
                        boxShadow: method === m ? 'var(--shadow-sm)' : 'none',
                        fontWeight: 700, fontSize: '0.8125rem',
                        color: method === m ? 'var(--text-primary)' : 'var(--text-muted)',
                        cursor: 'pointer', transition: 'all var(--transition-fast)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}
                    >
                      {m === 'phone' ? <Phone size={13} /> : <Mail size={13} />}
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </button>
                  ))}
                </div>

                {method === 'phone' ? (
                  <div style={{ position: 'relative' }}>
                    <div style={{
                      position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                      fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-secondary)',
                      display: 'flex', alignItems: 'center', gap: 6, pointerEvents: 'none',
                    }}>
                      <Phone size={14} />
                      <span style={{ borderRight: '1px solid var(--border-subtle)', paddingRight: 8, marginRight: 2 }}>+91</span>
                    </div>
                    <input
                      type="tel"
                      placeholder="Mobile number"
                      inputMode="numeric"
                      maxLength={10}
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                      required
                      autoFocus
                      style={{
                        width: '100%', padding: '12px 14px 12px 88px',
                        background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)', fontSize: '0.9375rem', fontWeight: 700,
                        color: 'var(--text-primary)', outline: 'none', letterSpacing: '0.05em',
                        transition: 'all var(--transition-fast)',
                      }}
                      onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(79,70,229,0.12)'; }}
                      onBlur={e => { e.target.style.borderColor = 'var(--border-subtle)'; e.target.style.boxShadow = 'none'; }}
                    />
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <Mail size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                    <input
                      type="email"
                      placeholder="your@email.com"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      required
                      autoFocus
                      style={{
                        width: '100%', padding: '12px 14px 12px 38px',
                        background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)', fontSize: '0.875rem',
                        color: 'var(--text-primary)', outline: 'none',
                        transition: 'all var(--transition-fast)',
                      }}
                      onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(79,70,229,0.12)'; }}
                      onBlur={e => { e.target.style.borderColor = 'var(--border-subtle)'; e.target.style.boxShadow = 'none'; }}
                    />
                  </div>
                )}
              </>
            )}

            {step === 'otp' && (
              <div>
                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, textAlign: 'center' }}>
                  Enter the 4-digit code
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  {otpDigits.map((digit, i) => (
                    <input
                      key={i}
                      ref={otpRefs[i]}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleOtpChange(e.target.value, i)}
                      onKeyDown={e => handleOtpKeyDown(e, i)}
                      style={{
                        width: 56, height: 60, textAlign: 'center',
                        fontSize: '1.5rem', fontWeight: 800,
                        background: 'var(--bg-surface-2)', border: `2px solid ${digit ? 'var(--color-primary)' : 'var(--border-subtle)'}`,
                        borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none',
                        transition: 'all var(--transition-fast)',
                        letterSpacing: '0.05em',
                      }}
                      onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(79,70,229,0.15)'; }}
                      onBlur={e => { e.target.style.borderColor = digit ? 'var(--color-primary)' : 'var(--border-subtle)'; e.target.style.boxShadow = 'none'; }}
                    />
                  ))}
                </div>
                <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>
                  Dev hint: use <code style={{ background: 'var(--bg-surface-2)', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>1234</code> to test
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%', padding: '13px',
                background: 'var(--color-primary)', color: 'white',
                border: 'none', borderRadius: 'var(--radius-md)',
                fontWeight: 700, fontSize: '0.9375rem', cursor: isLoading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: isLoading ? 0.8 : 1,
                boxShadow: 'var(--shadow-primary)', transition: 'all var(--transition-fast)',
              }}
              onMouseEnter={e => { if (!isLoading) e.currentTarget.style.background = 'var(--color-primary-hover)'; }}
              onMouseLeave={e => { if (!isLoading) e.currentTarget.style.background = 'var(--color-primary)'; }}
            >
              {isLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  {step === 'otp' ? 'Verify & Continue' : method === 'phone' ? 'Login Now' : 'Send OTP'}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Footer link */}
          <div style={{ marginTop: 14, textAlign: 'center' }}>
            {step === 'otp' ? (
              <button
                onClick={() => { setStep('phone'); setOtpDigits(['', '', '', '']); setError(''); }}
                style={{ fontSize: '0.8125rem', color: 'var(--color-primary)', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                ← Back / Change Method
              </button>
            ) : (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                New here?{' '}
                <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
                  Just enter your details to get started
                </span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
