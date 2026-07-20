import React, { useState, useEffect } from 'react';
import { Tag, Package, Calendar, Percent, Eye, X, Image, Plus, Trash2, Globe } from 'lucide-react';
import api from '../services/api';

const PRESET_PHOTOS = [
  { name: 'Restaurant Interior', url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&auto=format&fit=crop' },
  { name: 'Delicious Pizza', url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop' },
  { name: 'Cozy Cafe', url: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=600&auto=format&fit=crop' },
  { name: 'Spa & Wellness', url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=600&auto=format&fit=crop' },
  { name: 'Retail Store', url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&auto=format&fit=crop' },
];

export default function DealsAndProductsSection({ businessId, ownerId, isLoggedIn, session }) {
  const [activeTab, setActiveTab] = useState('products'); // 'products', 'deals', or 'photos'
  const [products, setProducts] = useState([]);
  const [deals, setDeals] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  
  // Photo Form
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [submittingPhoto, setSubmittingPhoto] = useState(false);

  const isOwner = isLoggedIn && Number(session?.id) === Number(ownerId);

  useEffect(() => {
    fetchData();
  }, [businessId]);

  const fetchData = async () => {
    if (!businessId) return;
    try {
      setLoading(true);
      const [prodList, dealList, photoList] = await Promise.all([
        api.getProducts(businessId).catch(() => []),
        api.getDeals(businessId).catch(() => []),
        api.getPhotos(businessId).catch(() => [])
      ]);
      setProducts(prodList || []);
      setDeals(dealList || []);
      setPhotos(photoList || []);
    } catch (err) {
      console.error('Error fetching catalog data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPhoto = async (url) => {
    const finalUrl = url || newPhotoUrl;
    if (!finalUrl.trim()) return alert('Please enter a photo URL or choose a preset.');
    try {
      setSubmittingPhoto(true);
      const res = await api.addPhoto(businessId, finalUrl);
      if (res && res.success) {
        setNewPhotoUrl('');
        const photoList = await api.getPhotos(businessId);
        setPhotos(photoList || []);
      }
    } catch (err) {
      console.error('Failed to add photo:', err);
      alert('Error uploading photo.');
    } finally {
      setSubmittingPhoto(false);
    }
  };

  const handleDeletePhoto = async (photoId) => {
    if (!window.confirm('Delete this photo?')) return;
    try {
      const res = await api.deletePhoto(photoId);
      if (res && res.success) {
        setPhotos(prev => prev.filter(p => p.id !== photoId));
      }
    } catch (err) {
      console.error('Failed to delete photo:', err);
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
          Offers ({deals.length})
        </button>
        <button
          onClick={() => setActiveTab('photos')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '8px 12px',
            border: 'none',
            borderRadius: 6,
            background: activeTab === 'photos' ? 'var(--color-primary)' : 'transparent',
            color: activeTab === 'photos' ? 'white' : 'var(--text-secondary)',
            fontSize: '0.75rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 150ms ease'
          }}
        >
          <Image size={14} />
          Photos ({photos.length})
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Loading catalog...
        </div>
      )}

      {/* Products Display */}
      {!loading && activeTab === 'products' && (
        products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            No products in catalog. {isOwner && 'Use the dashboard options below to add products via chatbot!'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
            {products.map((prod) => (
              <div key={prod.name} style={{
                background: 'var(--bg-surface)',
                borderRadius: 8,
                overflow: 'hidden',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <div style={{
                  padding: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1
                }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{prod.name}</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: 4 }}>
                    {prod.price ? `₹${prod.price}` : 'Price on request'}
                  </span>
                  {prod.description && (
                    <p style={{ margin: '6px 0 0', fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                      {prod.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Deals Display */}
      {!loading && activeTab === 'deals' && (
        deals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            No active deals. {isOwner && 'Use the dashboard options below to publish special offers!'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {deals.map((deal, idx) => (
              <div key={idx} style={{
                background: 'var(--bg-surface)',
                borderRadius: 8,
                padding: 12,
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{deal.title}</span>
                  {deal.discount_pct && (
                    <div style={{ background: '#fce7f3', color: '#db2777', padding: '2px 8px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 800, marginTop: 4, width: 'fit-content' }}>
                      {deal.discount_pct}% OFF
                    </div>
                  )}
                  {deal.description && (
                    <p style={{ margin: '6px 0 0', fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                      {deal.description}
                    </p>
                  )}
                  {deal.expiry_date && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      <Calendar size={11} />
                      Expires: {deal.expiry_date}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Photos Display */}
      {!loading && activeTab === 'photos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Owner Photo Addition Form */}
          {isOwner && (
            <div style={{
              padding: 12,
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              marginBottom: 8
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                🖼️ Add Photos to Gallery
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <input
                  type="text"
                  placeholder="Paste image URL (HTTPS)..."
                  value={newPhotoUrl}
                  onChange={(e) => setNewPhotoUrl(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-surface-2)',
                    color: 'var(--text-primary)',
                    fontSize: '0.75rem'
                  }}
                />
                <button
                  onClick={() => handleAddPhoto(null)}
                  disabled={submittingPhoto}
                  style={{
                    background: 'var(--color-primary)',
                    color: 'white',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: 6,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <Plus size={12} />
                  Add URL
                </button>
              </div>

              {/* Preset Stock Selection */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', alignSelf: 'center' }}>Presets:</span>
                {PRESET_PHOTOS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => handleAddPhoto(preset.url)}
                    disabled={submittingPhoto}
                    style={{
                      padding: '4px 8px',
                      background: 'var(--bg-surface-2)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 4,
                      fontSize: '0.65rem',
                      color: 'var(--text-primary)',
                      cursor: 'pointer'
                    }}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {photos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              No photos in gallery yet.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10 }}>
              {photos.map((p) => (
                <div
                  key={p.id}
                  style={{
                    position: 'relative',
                    aspectRatio: '1',
                    borderRadius: 8,
                    overflow: 'hidden',
                    border: '1px solid var(--border-subtle)',
                    cursor: 'pointer'
                  }}
                  onClick={() => setPreviewImage(p.photo_url)}
                >
                  <img
                    src={p.photo_url}
                    alt="Gallery item"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  {isOwner && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePhoto(p.id);
                      }}
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        background: 'rgba(239, 68, 68, 0.9)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        width: 20,
                        height: 20,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                    >
                      <Trash2 size={10} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
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
            alt="Preview"
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
