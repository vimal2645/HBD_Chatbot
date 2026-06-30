import React, { useState, useEffect } from 'react';
import { Star, MessageCircle, Send, Trash2, Edit2, ThumbsUp, CornerDownRight, User } from 'lucide-react';
import api from '../services/api';

const ReviewSection = ({ businessId, initialRatings, initialReviewsCount, isLoggedIn, session, onReviewUpdated }) => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // New States
  const [sortBy, setSortBy] = useState('newest');
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [replyingReviewId, setReplyingReviewId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [hasMore, setHasMore] = useState(false);

  const userId = session?.phone || session?.email || localStorage.getItem('guest_user_id') || 'guest';
  const isBusinessOwner = isLoggedIn && session?.type === 'BUSINESS' && Number(session?.businessId) === Number(businessId);
  const reviewsLimit = 5;

  useEffect(() => {
    setOffset(0);
    fetchReviews(true, 'newest', 0);
  }, [businessId]);

  const fetchReviews = async (reset = false, activeSort = sortBy, activeOffset = offset) => {
    if (!businessId) return;
    try {
      setLoading(true);
      const res = await api.getReviews(businessId, activeSort, activeOffset, reviewsLimit);
      const fetchedReviews = res.reviews || [];
      const total = res.total || 0;
      
      setTotalCount(total);
      if (reset) {
        setReviews(fetchedReviews);
      } else {
        setReviews(prev => {
          const existingIds = new Set(prev.map(r => r.id));
          const union = [...prev];
          fetchedReviews.forEach(r => {
            if (!existingIds.has(r.id)) {
              union.push(r);
            }
          });
          return union;
        });
      }
      setHasMore((activeOffset + fetchedReviews.length) < total);
    } catch (err) {
      console.error("Failed to fetch reviews:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSortChange = (newSort) => {
    setSortBy(newSort);
    setOffset(0);
    fetchReviews(true, newSort, 0);
  };

  const handleLoadMore = () => {
    const nextOffset = offset + reviewsLimit;
    setOffset(nextOffset);
    fetchReviews(false, sortBy, nextOffset);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) return alert("Please select a rating.");
    if (!businessId) return alert("Business ID missing.");

    try {
      setSubmitting(true);
      let res;
      if (editingReviewId) {
        res = await api.editReview(editingReviewId, {
          user_id: userId,
          rating,
          comment
        });
      } else {
        res = await api.addReview({
          business_id: businessId,
          user_id: userId,
          rating,
          comment
        });
      }
      
      if (res && res.success) {
        setRating(0);
        setComment('');
        setEditingReviewId(null);
        setOffset(0);
        fetchReviews(true, sortBy, 0);
        if (onReviewUpdated) {
          onReviewUpdated(res.ratings, res.reviews_count);
        }
      }
    } catch (err) {
      console.error("Failed to submit review:", err);
      alert(err.message || "Error submitting review.");
    } finally {
      setSubmitting(false);
    }
  };

  const startEditReview = (rev) => {
    setEditingReviewId(rev.id);
    setRating(rev.rating);
    setComment(rev.comment || '');
  };

  const cancelEditReview = () => {
    setEditingReviewId(null);
    setRating(0);
    setComment('');
  };

  const handleDelete = async (reviewId) => {
    if (!window.confirm("Delete this review?")) return;
    try {
      const res = await api.deleteReview(reviewId, userId);
      if (res && res.success) {
        setOffset(0);
        fetchReviews(true, sortBy, 0);
        if (onReviewUpdated) {
          onReviewUpdated(res.ratings, res.reviews_count);
        }
      }
    } catch (err) {
      console.error("Failed to delete review:", err);
      alert("Error deleting review.");
    }
  };

  const handleHelpfulVote = async (reviewId) => {
    try {
      const res = await api.helpfulVote(reviewId);
      if (res && res.helpful_votes !== undefined) {
        setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, helpful_votes: res.helpful_votes } : r));
      }
    } catch (err) {
      console.error("Failed to vote helpful:", err);
    }
  };

  const submitMerchantReply = async (reviewId) => {
    if (!replyText.trim()) return;
    try {
      const res = await api.merchantReply(reviewId, replyText);
      if (res && res.success) {
        setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, merchant_reply: replyText } : r));
        setReplyingReviewId(null);
        setReplyText('');
      }
    } catch (err) {
      console.error("Failed to post merchant reply:", err);
      alert("Error posting reply.");
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
      {/* Title & Stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <MessageCircle size={16} color="var(--color-primary)" />
        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Reviews & Ratings
        </h4>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          ({totalCount} Review{totalCount !== 1 ? 's' : ''} • {initialRatings} Avg)
        </span>
        
        {/* Sort Select */}
        <select
          value={sortBy}
          onChange={(e) => handleSortChange(e.target.value)}
          style={{
            marginLeft: 'auto',
            padding: '4px 8px',
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.75rem',
            cursor: 'pointer'
          }}
        >
          <option value="newest">Newest First</option>
          <option value="highest">Highest Rating</option>
          <option value="lowest">Lowest Rating</option>
          <option value="helpful">Most Helpful</option>
        </select>
      </div>

      {/* Review Submission Form */}
      <div style={{ marginBottom: 20, padding: 12, background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
          {editingReviewId ? "✏️ Edit Your Review" : "✍️ Write a Review"}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 10 }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginRight: 6 }}>Rating:</span>
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
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {editingReviewId && (
            <button
              onClick={cancelEditReview}
              style={{
                background: 'var(--bg-surface-2)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                padding: '6px 12px',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              Cancel Edit
            </button>
          )}
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
            {submitting ? 'Submitting...' : editingReviewId ? 'Update Review' : 'Submit Review'}
          </button>
        </div>
      </div>

      {/* Reviews List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {reviews.length === 0 && !loading ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: '0.85rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)' }}>
            No reviews yet. Be the first to share your experience!
          </div>
        ) : (
          <>
            {reviews.map((rev) => (
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
                    
                    {/* Edit and Delete Buttons */}
                    {rev.user_id === userId && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={() => startEditReview(rev)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
                          title="Edit review"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(rev.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}
                          title="Delete review"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                {rev.comment && (
                  <p style={{ margin: '4px 0', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {rev.comment}
                  </p>
                )}

                {/* Helpful Vote Action */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <button
                    onClick={() => handleHelpfulVote(rev.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.75rem'
                    }}
                  >
                    <ThumbsUp size={12} />
                    <span>Helpful ({rev.helpful_votes || 0})</span>
                  </button>

                  {/* Reply trigger for owners */}
                  {isBusinessOwner && !rev.merchant_reply && replyingReviewId !== rev.id && (
                    <button
                      onClick={() => setReplyingReviewId(rev.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontSize: '0.75rem', fontWeight: 600 }}
                    >
                      Reply to Review
                    </button>
                  )}
                </div>

                {/* Reply Form */}
                {replyingReviewId === rev.id && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6, borderLeft: '2px solid var(--color-primary-border)', paddingLeft: 10 }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Write Reply:</span>
                    <textarea
                      placeholder="Thank the user or address their concerns..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      style={{
                        width: '100%', minHeight: 40, padding: 8, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-2)', color: 'var(--text-primary)', fontSize: '0.8rem'
                      }}
                    />
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => { setReplyingReviewId(null); setReplyText(''); }}
                        style={{ background: 'none', border: '1px solid var(--border-subtle)', padding: '4px 10px', borderRadius: 4, fontSize: '0.75rem', cursor: 'pointer', color: 'var(--text-primary)' }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => submitMerchantReply(rev.id)}
                        style={{ background: 'var(--color-primary)', border: 'none', color: 'white', padding: '4px 10px', borderRadius: 4, fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Submit Reply
                      </button>
                    </div>
                  </div>
                )}

                {/* Display Merchant Reply */}
                {rev.merchant_reply && (
                  <div style={{
                    marginTop: 10,
                    padding: '8px 12px',
                    background: 'var(--bg-surface-2)',
                    borderRadius: 'var(--radius-sm)',
                    borderLeft: '3px solid var(--color-primary)',
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                      <CornerDownRight size={12} color="var(--color-primary)" />
                      <span>Response from the owner</span>
                    </div>
                    <p style={{ margin: 0, lineHeight: 1.4 }}>{rev.merchant_reply}</p>
                  </div>
                )}
              </div>
            ))}

            {/* Load More Button */}
            {hasMore && (
              <button
                onClick={handleLoadMore}
                style={{
                  width: '100%',
                  padding: 8,
                  background: 'var(--bg-surface)',
                  color: 'var(--color-primary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 200ms'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface-3)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-surface)'}
              >
                {loading ? 'Loading...' : 'Load More Reviews ➕'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ReviewSection;
