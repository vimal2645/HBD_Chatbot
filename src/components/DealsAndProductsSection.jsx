import React, { useState, useEffect } from 'react';
import { Tag, Package, Calendar, Percent, Eye, X } from 'lucide-react';
import { api } from '../services/api';

export default function DealsAndProductsSection({ businessId }) {
  const [activeTab, setActiveTab] = useState('products'); // 'products' or 'deals'
  const [products, setProducts] = useState([]);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!businessId) return;
      try {
        setLoading(true);
        const [prodList, dealList] = await Promise.all([
          api.getProducts(businessId).catch(() => []),
          api.getDeals(businessId).catch(() => [])
        ]);
        setProducts(prodList || []);
        setDeals(dealList || []);
      } catch (err) {
        console.error('Error fetching catalog data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [businessId]);

  return (
    <div style={{
      marginTop: 14,
      padding: '16px 14px',
      background: 'var(--bg-surface-2)',
      borderRadius: 'var(--radius-md)',
      borderTop: '1px solid var(--border-subtle)',
    }}>
      {/* Tabs Header */}
      <div style={{
        display: 'flex',
        background: 'var(--bg-surface)',
        borderRadius: 8,
        padding: 4,
        marginBottom: 16,
        border: '1px solid var(--border-subtle)'
      }}>
        <button
          onClick={() => setActiveTab('products')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '8px 12px',
            border: 'none',
            borderRadius: 6,
            background: activeTab === 'products' ? 'var(--color-primary)' : 'transparent',
            color: activeTab === 'products' ? 'white' : 'var(--text-secondary)',
            fontSize: '0.75rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 150ms ease'
          }}
        >
          <Package size={14} />
          Products ({products.length})
        </button>
        <button
          onClick={() => setActiveTab('deals')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '8px 12px',
            border: 'none',
            borderRadius: 6,
            background: activeTab === 'deals' ? 'var(--color-primary)' : 'transparent',
            color: activeTab === 'deals' ? 'white' : 'var(--text-secondary)',
            fontSize: '0.75rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 150ms ease'
          }}
        >
          <Tag size={14} />
          Deals & Offers ({deals.length})
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Loading catalog...
        </div>
      )}

      {/* Products Tab Content */}
      {!loading && activeTab === 'products' && (
        products.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: 20,
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8rem',
            color: 'var(--text-muted)'
          }}>
            No products added by the owner yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {products.map((prod) => (
              <div
                key={prod.id}
                style={{
                  display: 'flex',
                  gap: 12,
                  padding: 12,
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  alignItems: 'center'
                }}
              >
                {/* Product Image */}
                <div style={{
                  width: 52,
                  height: 52,
                  background: 'var(--bg-surface-2)',
                  borderRadius: 8,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--border-subtle)',
                  position: 'relative',
                  cursor: prod.image_url ? 'pointer' : 'default',
                  flexShrink: 0
                }}
                  onClick={() => prod.image_url && setPreviewImage(prod.image_url)}
                >
                  {prod.image_url ? (
                    <>
                      <img
                        src={prod.image_url}
                        alt={prod.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div style={{
                        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0,
                        transition: 'opacity 150ms ease'
                      }}
                        className="hover-overlay"
                      >
                        <Eye size={12} color="white" />
                      </div>
                    </>
                  ) : (
                    <Package size={20} style={{ color: 'var(--text-muted)' }} />
                  )}
                </div>

                {/* Product Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h5 style={{
                    margin: 0,
                    fontWeight: 700,
                    fontSize: '0.8125rem',
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {prod.name}
                  </h5>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#059669',
                      background: '#d1fae5',
                      padding: '1px 6px',
                      borderRadius: 6,
                      border: '1px solid #6ee7b7'
                    }}>
                      ₹{prod.price}
                    </span>
                    {prod.category && (
                      <span style={{
                        fontSize: '0.65rem',
                        color: 'var(--text-muted)',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}>
                        {prod.category}
                      </span>
                    )}
                  </div>
                  {prod.description && (
                    <p style={{
                      margin: '4px 0 0',
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.3,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {prod.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Deals Tab Content */}
      {!loading && activeTab === 'deals' && (
        deals.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: 20,
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8rem',
            color: 'var(--text-muted)'
          }}>
            No deals or promotional offers active right now.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {deals.map((deal) => (
              <div
                key={deal.id}
                style={{
                  padding: 12,
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px dashed #ec4899',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Decorative Coupon Tag */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  background: '#fdf2f8',
                  color: '#db2777',
                  borderBottomLeftRadius: 8,
                  padding: '2px 8px',
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  borderLeft: '1px dashed #ec4899',
                  borderBottom: '1px dashed #ec4899'
                }}>
                  Coupon
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    background: '#fdf2f8',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#db2777',
                    flexShrink: 0
                  }}>
                    <Percent size={18} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0, paddingRight: 36 }}>
                    <h5 style={{
                      margin: 0,
                      fontWeight: 700,
                      fontSize: '0.8125rem',
                      color: 'var(--text-primary)'
                    }}>
                      {deal.title}
                    </h5>
                    {deal.discount_pct && (
                      <div style={{
                        display: 'inline-block',
                        background: '#fdf2f8',
                        color: '#db2777',
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        marginTop: 4
                      }}>
                        {deal.discount_pct}% OFF
                      </div>
                    )}
                    {deal.description && (
                      <p style={{
                        margin: '6px 0 0',
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.3
                      }}>
                        {deal.description}
                      </p>
                    )}
                    {deal.expiry_date && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        marginTop: 8,
                        fontSize: '0.65rem',
                        color: 'var(--text-muted)',
                        fontWeight: 600
                      }}>
                        <Calendar size={11} />
                        Expires: {deal.expiry_date}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(4px)'
        }}>
          <button
            onClick={() => setPreviewImage(null)}
            style={{
              position: 'absolute',
              top: 20,
              right: 20,
              padding: 8,
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(255,255,255,0.2)',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            <X size={20} />
          </button>
          <img
            src={previewImage}
            alt="Product Preview"
            style={{
              maxWidth: '90%',
              maxHeight: '90%',
              objectFit: 'contain',
              borderRadius: 12,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)'
            }}
          />
        </div>
      )}
    </div>
  );
}
