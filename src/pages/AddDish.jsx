import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { genId, compressImage, makeThumbnail, saveDish, saveRestaurant, getRestaurants, getCurrentLocation } from '../db.js';
import StarRating from '../components/StarRating.jsx';
import { toast } from '../components/Toast.jsx';

const TYPES = [['entree', '🥗 Entrée'], ['plat', '🍽 Plat'], ['dessert', '🍮 Dessert'], ['boisson', '🥤 Boisson'], ['autre', '🍴 Autre']];
const CUISINES = ['Française', 'Italienne', 'Japonaise', 'Chinoise', 'Mexicaine', 'Indienne', 'Grecque', 'Américaine', 'Libanaise', 'Espagnole', 'Thaïlandaise', 'Marocaine', 'Vietnamienne', 'Coréenne', 'Méditerranéenne', 'Autre'];

export default function AddDish() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const fileRef = useRef();

  const [restaurants, setRestaurants] = useState([]);
  const [form, setForm] = useState({
    name: '', type: 'plat', rating: 0, notes: '', price: '', tags: '',
    restaurantName: params.get('restaurantName') || '',
    restaurantId: params.get('restaurantId') || '',
    cuisineType: '', date: new Date().toISOString().split('T')[0],
  });
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = k => v => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    getRestaurants().then(setRestaurants);
  }, []);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      const [comp, thumb] = await Promise.all([compressImage(ev.target.result, 1200, 0.85), makeThumbnail(ev.target.result, 400)]);
      setPhoto({ compressed: comp, thumbnail: thumb });
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!form.name.trim()) return toast('Le nom du plat est obligatoire', 'error');
    setSaving(true);
    try {
      let restaurantId = form.restaurantId;
      if (!restaurantId && form.restaurantName.trim()) {
        const existing = restaurants.find(r => r.name.toLowerCase() === form.restaurantName.toLowerCase());
        if (existing) {
          restaurantId = existing.id;
        } else {
          let location = null;
          try { location = await getCurrentLocation(); } catch (_) {}
          const r = await saveRestaurant({ id: genId(), name: form.restaurantName, cuisineType: form.cuisineType, location, visitCount: 0, createdAt: new Date().toISOString() });
          restaurantId = r.id;
        }
      }

      let location = null;
      try { location = await getCurrentLocation(); } catch (_) {}

      const tags = form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

      await saveDish({
        id: genId(),
        restaurantId,
        restaurantName: form.restaurantName || 'Restaurant inconnu',
        name: form.name,
        type: form.type,
        photo: photo?.compressed || null,
        thumbnailPhoto: photo?.thumbnail || null,
        date: form.date,
        rating: form.rating,
        price: form.price ? parseFloat(form.price) : null,
        notes: form.notes,
        tags,
        isFavorite: 0,
        recipe: null,
        detectedIngredients: [],
        location,
      });
      toast('Plat ajouté ✓', 'success');
      navigate(-1);
    } catch (e) {
      toast('Erreur : ' + e.message, 'error');
    }
    setSaving(false);
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <button className="back-btn" onClick={() => navigate(-1)}>←</button>
          <h1 style={{ flex: 1 }}>Ajouter un plat</h1>
        </div>
      </div>

      <div className="page" style={{ paddingTop: 0 }}>
        {/* Photo */}
        <div className="form-group" style={{ marginBottom: 20 }}>
          <label className="label">📸 Photo (optionnel)</label>
          <div className={`photo-upload-area ${photo ? 'has-photo' : ''}`} onClick={() => fileRef.current?.click()}>
            {photo ? (
              <div style={{ position: 'relative', width: '100%' }}>
                <img className="photo-preview" src={photo.thumbnail} alt="aperçu" />
                <button className="btn btn-secondary btn-sm" style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(255,255,255,0.9)' }} onClick={e => { e.stopPropagation(); setPhoto(null); }}>✕</button>
              </div>
            ) : (
              <>
                <div style={{ fontSize: '2.5rem' }}>📸</div>
                <p style={{ fontWeight: 600, color: 'var(--text-2)', fontSize: '0.9rem' }}>Ajouter une photo</p>
                <p className="text-xs text-muted">JPEG ou PNG</p>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="label">Nom du plat *</label>
            <input className="input" placeholder="ex: Pavé de saumon beurre blanc" value={form.name} onChange={e => set('name')(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="label">Catégorie</label>
            <div className="pill-group">
              {TYPES.map(([v, l]) => <button key={v} className={`pill ${form.type === v ? 'active' : ''}`} onClick={() => set('type')(v)}>{l}</button>)}
            </div>
          </div>

          <div className="form-group">
            <label className="label">🏪 Restaurant</label>
            <input className="input" placeholder="Nom du restaurant" value={form.restaurantName} onChange={e => set('restaurantName')(e.target.value)} list="add-resto-list" />
            <datalist id="add-resto-list">{restaurants.map(r => <option key={r.id} value={r.name} />)}</datalist>
          </div>

          {!restaurants.find(r => r.name.toLowerCase() === form.restaurantName.toLowerCase()) && form.restaurantName && (
            <div className="form-group">
              <label className="label">Type de cuisine (nouveau resto)</label>
              <select className="input" value={form.cuisineType} onChange={e => set('cuisineType')(e.target.value)}>
                <option value="">— Sélectionner —</option>
                {CUISINES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          )}

          <div className="form-group">
            <label className="label">📅 Date</label>
            <input className="input" type="date" value={form.date} onChange={e => set('date')(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="label">⭐ Note</label>
            <StarRating value={form.rating} onChange={set('rating')} size="1.6rem" />
          </div>

          <div className="form-group">
            <label className="label">💶 Prix (€)</label>
            <input className="input" type="number" min="0" step="0.5" placeholder="ex: 18.50" value={form.price} onChange={e => set('price')(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="label">🏷 Tags (séparés par des virgules)</label>
            <input className="input" placeholder="ex: végétarien, signature, spécial" value={form.tags} onChange={e => set('tags')(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="label">📝 Notes</label>
            <textarea className="input" rows={4} placeholder="Vos impressions, texture, saveurs…" value={form.notes} onChange={e => set('notes')(e.target.value)} />
          </div>
        </div>

        <div style={{ marginTop: 24, display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => navigate(-1)}>Annuler</button>
          <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleSave} disabled={saving}>
            {saving ? '⏳ Sauvegarde…' : '💾 Sauvegarder le plat'}
          </button>
        </div>

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <button className="btn btn-ghost" onClick={() => navigate('/scanner')}>
            📷 Utiliser le scanner IA à la place
          </button>
        </div>
      </div>
    </div>
  );
}
