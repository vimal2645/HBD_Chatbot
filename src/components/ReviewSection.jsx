import React, { useState, useEffect } from 'react';
import { Star, MessageCircle, Send, Trash2, User } from 'lucide-react';
import api from '../services/api';

const ReviewSection = ({ businessId, initialRatings, initialReviewsCount, isLoggedIn, session, onReviewUpdated }) => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const userId = session?.phone || session?.email || localStorage.getItem('guest_user_id') || 'guest';

  useEffect(() => {
    fetchReviews();
  }, [businessId]);

  const fetchReviews = async () => {
    if (!businessId) return;
    try {
      setLoading(true);
      const res = await api.getReviews(businessId);
      setReviews(res || []);
    } catch (err) {
      console.error("Failed to fetch reviews:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) return alert("Please select a rating.");
    if (!businessId) return alert("Business ID missing.");

    try {
      setSubmitting(true);
      const res = await api.addReview({
        business_id: businessId,
        user_id: userId,
        rating,
        comment
      });
      
      if (res && res.success) {
        setRating(0);
        setComment('');
        fetchReviews();
        // Notify parent to update the average rating UI
        if (onReviewUpdated) {
          onReviewUpdated(res.ratings, res.reviews_count);
        }
      }
    } catch (err) {
      console.error("Failed to submit review:", err);
      alert("Error submitting review.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (reviewId) => {
    if (!window.confirm("Delete this review?")) return;
    try {
      const res = await api.deleteReview(reviewId, userId);
      if (res && res.success) {
        fetchReviews();
        if (onReviewUpdated) {
          onReviewUpdated(res.ratings, res.reviews_count);
        }
      }
    } catch (err) {
      console.error("Failed to delete review:", err);
      alert("Error deleting review.");
    }
  };

  return (
    <div style={{
      marginTop: 14,
      padding: '16px 14px',
      background: 'var(--bg-surface-2)',
      borderRadius: 'var(--radius-md)',
      borderTop: '1px solid var(--border-subtle)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <MessageCircle size={16} color="var(--color-primary)" />
        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Reviews & Ratings
        </h4>
        <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {initialReviewsCount} Review{initialReviewsCount !== 1 ? 's' : ''} • {initialRatings} Avg
        </span>
      </div>

      {/* Review Submission Form */}
      <div style={{ marginBottom: 20, padding: 12, background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 10 }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginRight: 6 }}>Your Rating:</span>
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              size={20}
              fill={(hoverRating || rating) >= star ? '#fbbf24' : 'none'}
              color={(hoverRating || rating) >= star ? '#fbbf24' : 'var(--border-subtle)'}
              style={{ cursor: 'pointer', transition: 'all 150ms ease' }}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setRating(star)}
            />
          ))}
        </div>
        <textarea
          placeholder={isLoggedIn ? "Write your review..." : "Write your review as guest..."}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          style={{
            width: '100%',
            minHeight: 60,
            padding: 10,
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface-2)',
            color: 'var(--text-primary)',
            fontSize: '0.85rem',
            resize: 'vertical',
            marginBottom: 10,
            fontFamily: 'inherit'
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleSubmit}
            disabled={submitting || rating === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: rating === 0 ? 'var(--bg-surface-2)' : 'var(--color-primary)',
              color: rating === 0 ? 'var(--text-muted)' : 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: rating === 0 ? 'not-allowed' : 'pointer',
              transition: 'all 200ms ease'
            }}
          >
            <Send size={14} />
            {submitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      </div>

      {/* Reviews List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading reviews...</div>
        ) : reviews.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: '0.85rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)' }}>
            No reviews yet. Be the first to share your experience!
          </div>
        ) : (
          reviews.map((rev) => (
            <div key={rev.id} style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-primary-light)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <User size={14} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {rev.user_id === userId ? 'You' : (rev.user_id.includes('@') ? rev.user_id.split('@')[0] : 'User')}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      {new Date(rev.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Star size={12} fill="#fbbf24" color="#fbbf24" />
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{rev.rating}</span>
                  </div>
                  {rev.user_id === userId && (
                    <button
                      onClick={() => handleDelete(rev.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}
                      title="Delete review"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
              {rev.comment && (
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {rev.comment}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ReviewSection;
