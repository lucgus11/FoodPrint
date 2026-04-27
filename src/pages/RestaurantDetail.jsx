import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getRestaurant, getDishesForRestaurant, deleteRestaurant, updateRestaurant, openInMaps } from '../db.js';
import { DishCard } from '../components/DishCard.jsx';
import StarRating from '../components/StarRating.jsx';
import { toast } from '../components/Toast.jsx';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

const TYPE_LABELS = { entree: 'Entrées', plat: 'Plats', dessert: 'Desserts', boisson: 'Boissons', autre: 'Autres' };

export default function RestaurantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState(null);
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => { load(); }, [id]);

  async function load() {
    const [r, d] = await Promise.all([getRestaurant(id), getDishesForRestaurant(id)]);
    if (!r) { navigate('/restaurants'); return; }
    setRestaurant(r);
    setDishes(d);
    setEditForm(r);
    setLoading(false);
  }

  async function saveEdit() {
    await updateRestaurant(id, editForm);
    setRestaurant(editForm);
    setEditing(false);
    toast('Restaurant mis à jour ✓', 'success');
  }

  async function handleDelete() {
    if (!confirm(`Supprimer "${restaurant.name}" et tous ses ${dishes.length} plats ?`)) return;
    await deleteRestaurant(id);
    toast('Restaurant supprimé', 'success');
    navigate('/restaurants');
  }

  if (loading) return <div className="loading-overlay"><div className="spinner" /></div>;

  const byType = dishes.reduce((acc, d) => { acc[d.type] = [...(acc[d.type] || []), d]; return acc; }, {});
  const avgRating = dishes.filter(d => d.rating > 0).reduce((s, d, _, a) => s + d.rating / a.length, 0);
  const filteredDishes = activeTab === 'all' ? dishes : (byType[activeTab] || []);

  const CUISINES = ['Française', 'Italienne', 'Japonaise', 'Chinoise', 'Mexicaine', 'Indienne', 'Grecque', 'Américaine', 'Libanaise', 'Espagnole', 'Thaïlandaise', 'Marocaine', 'Vietnamienne', 'Coréenne', 'Méditerranéenne', 'Autre'];

  return (
    <div>
      {/* Hero */}
      <div style={{ background: 'linear-gradient(160deg, #1C1410 0%, #3D2B1F 100%)', padding: '20px 16px 24px', color: 'white', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <button className="back-btn" style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }} onClick={() => navigate(-1)}>←</button>
          <h1 style={{ flex: 1, color: 'white', fontSize: '1.4rem', fontFamily: 'var(--font-display)' }}>{restaurant.name}</h1>
          <button onClick={() => setEditing(true)} className="btn-icon" style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}>✏️</button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {restaurant.cuisineType && <span className="badge" style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>{restaurant.cuisineType}</span>}
          {restaurant.priceRange && <span className="badge badge-amber">{restaurant.priceRange}</span>}
          {restaurant.city && <span className="badge" style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}>📍 {restaurant.city}</span>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[
            { label: 'Plats', value: dishes.length, emoji: '🍽' },
            { label: 'Note moy.', value: avgRating > 0 ? avgRating.toFixed(1) : '—', emoji: '⭐' },
            { label: 'Visites', value: restaurant.visitCount || 0, emoji: '🔁' },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.2rem' }}>{s.emoji}</div>
              <div style={{ fontWeight: 800, fontSize: '1.2rem', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: '0.68rem', opacity: 0.75, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="page" style={{ paddingTop: 16 }}>
        {/* Info card */}
        {(restaurant.address || restaurant.phone || restaurant.website || restaurant.notes) && (
          <div className="card card-padded" style={{ marginBottom: 16 }}>
            {restaurant.address && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
                <span style={{ fontSize: '1rem' }}>📍</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.9rem' }}>{restaurant.address}{restaurant.city ? `, ${restaurant.city}` : ''}</div>
                  {restaurant.location && (
                    <button onClick={() => openInMaps(restaurant.location.lat, restaurant.location.lng, restaurant.name)} className="btn btn-ghost btn-sm" style={{ padding: '4px 0', marginTop: 2 }}>Ouvrir dans Maps →</button>
                  )}
                </div>
              </div>
            )}
            {restaurant.phone && <div style={{ display: 'flex', gap: 10, marginBottom: 8, fontSize: '0.9rem' }}><span>📞</span><a href={`tel:${restaurant.phone}`} style={{ color: 'var(--primary)' }}>{restaurant.phone}</a></div>}
            {restaurant.website && <div style={{ display: 'flex', gap: 10, marginBottom: 8, fontSize: '0.9rem' }}><span>🌐</span><a href={restaurant.website} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', wordBreak: 'break-all' }}>{restaurant.website}</a></div>}
            {restaurant.notes && <div style={{ marginTop: 8, fontSize: '0.88rem', color: 'var(--text-2)', fontStyle: 'italic' }}>{restaurant.notes}</div>}
          </div>
        )}

        {/* Quick actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          <button className="btn btn-primary" onClick={() => navigate(`/scanner`)}>📷 Scanner un plat</button>
          <button className="btn btn-secondary" onClick={() => navigate(`/add?restaurantId=${id}&restaurantName=${encodeURIComponent(restaurant.name)}`)}>✍️ Ajouter manuellement</button>
        </div>

        {/* Dishes */}
        <div className="section-header">
          <h2 className="section-title">Plats ({dishes.length})</h2>
        </div>

        {dishes.length > 0 && (
          <div className="pill-group" style={{ marginBottom: 14 }}>
            <button className={`pill ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>Tous</button>
            {Object.keys(byType).map(t => (
              <button key={t} className={`pill ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
                {TYPE_LABELS[t] || t} ({byType[t].length})
              </button>
            ))}
          </div>
        )}

        {filteredDishes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🍽</div>
            <p>Aucun plat dans cette catégorie</p>
          </div>
        ) : (
          <div className="dish-grid">
            {filteredDishes.map(d => <DishCard key={d.id} dish={d} />)}
          </div>
        )}

        <button className="btn btn-danger btn-full" style={{ marginTop: 32 }} onClick={handleDelete}>🗑 Supprimer ce restaurant</button>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setEditing(false)}>
          <div className="modal">
            <div className="modal-handle" />
            <h3 style={{ marginBottom: 16 }}>Modifier le restaurant</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label className="label">Nom</label>
                <input className="input" value={editForm.name || ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="label">Cuisine</label>
                <select className="input" value={editForm.cuisineType || ''} onChange={e => setEditForm(f => ({ ...f, cuisineType: e.target.value }))}>
                  <option value="">— Sélectionner —</option>
                  {CUISINES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="label">Ville</label>
                <input className="input" value={editForm.city || ''} onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="label">Adresse</label>
                <input className="input" value={editForm.address || ''} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="label">Note personnelle</label>
                <StarRating value={editForm.rating || 0} onChange={v => setEditForm(f => ({ ...f, rating: v }))} />
              </div>
              <div className="form-group">
                <label className="label">Notes</label>
                <textarea className="input" rows={3} value={editForm.notes || ''} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditing(false)}>Annuler</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={saveEdit}>💾 Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
