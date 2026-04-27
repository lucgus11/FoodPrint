import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRestaurants, deleteRestaurant, getCurrentLocation, genId, saveRestaurant } from '../db.js';
import { toast } from '../components/Toast.jsx';

const CUISINE_EMOJI = { Française: '🥐', Italienne: '🍕', Japonaise: '🍣', Chinoise: '🥟', Mexicaine: '🌮', Indienne: '🍛', Grecque: '🫒', Américaine: '🍔', Libanaise: '🧆', Espagnole: '🥘', Thaïlandaise: '🍜', Marocaine: '🍲', Vietnamienne: '🍜', Coréenne: '🥘', Méditerranéenne: '🫙' };

export default function Restaurants() {
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const r = await getRestaurants();
    setRestaurants(r);
    setLoading(false);
  }

  const filtered = restaurants.filter(r =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.cuisineType?.toLowerCase().includes(search.toLowerCase()) || r.city?.toLowerCase().includes(search.toLowerCase())
  );

  async function handleDelete(id, name) {
    if (!confirm(`Supprimer "${name}" et tous ses plats ?`)) return;
    await deleteRestaurant(id);
    toast(`"${name}" supprimé`, 'success');
    load();
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="display" style={{ marginBottom: 14 }}>🏪 Restaurants</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" style={{ flex: 1 }} placeholder="Rechercher un restaurant…" value={search} onChange={e => setSearch(e.target.value)} />
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Ajouter</button>
        </div>
      </div>

      <div className="page">
        {loading ? (
          <div className="loading-overlay"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🏪</div>
            <h3>{search ? 'Aucun résultat' : 'Aucun restaurant'}</h3>
            <p className="text-sm">Ajoutez votre premier restaurant ou scannez un plat</p>
            <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Ajouter un restaurant</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(r => (
              <div key={r.id} className="restaurant-card" onClick={() => navigate(`/restaurants/${r.id}`)}>
                <div className="restaurant-avatar">
                  {CUISINE_EMOJI[r.cuisineType] || '🍴'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 2 }}>{r.name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {r.cuisineType && <span>{r.cuisineType}</span>}
                    {r.city && <span>📍 {r.city}</span>}
                    {r.visitCount > 0 && <span>🍽 {r.visitCount} visite{r.visitCount > 1 ? 's' : ''}</span>}
                  </div>
                  {r.rating > 0 && <div style={{ marginTop: 4, color: 'var(--amber)', fontSize: '0.85rem' }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</div>}
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(r.id, r.name); }}
                  style={{ color: 'var(--text-3)', padding: '4px 8px', borderRadius: 6 }}
                  aria-label="Supprimer"
                >🗑</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && <AddRestaurantModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}

function AddRestaurantModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', cuisineType: '', city: '', address: '', priceRange: '€€', phone: '', website: '', notes: '' });
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = k => v => setForm(f => ({ ...f, [k]: v }));

  const CUISINES = ['Française', 'Italienne', 'Japonaise', 'Chinoise', 'Mexicaine', 'Indienne', 'Grecque', 'Américaine', 'Libanaise', 'Espagnole', 'Thaïlandaise', 'Marocaine', 'Vietnamienne', 'Coréenne', 'Méditerranéenne', 'Autre'];

  async function locate() {
    setLocating(true);
    try {
      const pos = await getCurrentLocation();
      // Reverse geocode via nominatim (free, no key)
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.lat}&lon=${pos.lng}&format=json`);
      const data = await res.json();
      const addr = data.address;
      setForm(f => ({
        ...f,
        location: pos,
        city: addr.city || addr.town || addr.village || '',
        address: `${addr.road || ''} ${addr.house_number || ''}`.trim(),
      }));
      toast('Position récupérée ✓', 'success');
    } catch {
      toast('Impossible de récupérer la position', 'error');
    }
    setLocating(false);
  }

  async function save() {
    if (!form.name.trim()) return toast('Le nom est obligatoire', 'error');
    setSaving(true);
    await saveRestaurant({ id: genId(), ...form, visitCount: 0, createdAt: new Date().toISOString() });
    toast(`"${form.name}" ajouté ✓`, 'success');
    setSaving(false);
    onSaved();
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-handle" />
        <h2 style={{ marginBottom: 20 }}>Ajouter un restaurant</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group">
            <label className="label">Nom *</label>
            <input className="input" placeholder="Le Petit Bistrot" value={form.name} onChange={e => set('name')(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="label">Type de cuisine</label>
            <select className="input" value={form.cuisineType} onChange={e => set('cuisineType')(e.target.value)}>
              <option value="">— Sélectionner —</option>
              {CUISINES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="form-group">
              <label className="label">Ville</label>
              <input className="input" placeholder="Paris" value={form.city} onChange={e => set('city')(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="label">Budget</label>
              <select className="input" value={form.priceRange} onChange={e => set('priceRange')(e.target.value)}>
                {['€', '€€', '€€€', '€€€€'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="label">Adresse</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" style={{ flex: 1 }} placeholder="12 rue de la Paix" value={form.address} onChange={e => set('address')(e.target.value)} />
              <button className="btn btn-secondary" onClick={locate} disabled={locating} title="Géolocaliser">{locating ? '⏳' : '📍'}</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="form-group">
              <label className="label">Téléphone</label>
              <input className="input" type="tel" placeholder="+33..." value={form.phone} onChange={e => set('phone')(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="label">Site web</label>
              <input className="input" type="url" placeholder="https://..." value={form.website} onChange={e => set('website')(e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label className="label">Notes</label>
            <textarea className="input" rows={2} placeholder="Ambiance, spécialités…" value={form.notes} onChange={e => set('notes')(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" style={{ flex: 2 }} onClick={save} disabled={saving}>{saving ? '⏳' : '💾 Sauvegarder'}</button>
        </div>
      </div>
    </div>
  );
}
