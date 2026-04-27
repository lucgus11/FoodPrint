import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDish, updateDish, deleteDish, toggleFavorite, openInMaps } from '../db.js';
import StarRating from '../components/StarRating.jsx';
import { toast } from '../components/Toast.jsx';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

const TYPE_LABELS = { entree: 'Entrée', plat: 'Plat', dessert: 'Dessert', boisson: 'Boisson', autre: 'Autre' };
const TYPE_EMOJI = { entree: '🥗', plat: '🍽', dessert: '🍮', boisson: '🥤', autre: '🍴' };

export default function DishDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [dish, setDish] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [activeTab, setActiveTab] = useState('info');
  const [shareLoading, setShareLoading] = useState(false);

  useEffect(() => { load(); }, [id]);

  async function load() {
    const d = await getDish(id);
    if (!d) { navigate('/'); return; }
    setDish(d);
    setEditForm({ name: d.name, type: d.type, rating: d.rating, notes: d.notes, price: d.price, tags: d.tags?.join(', ') || '', date: d.date });
    setLoading(false);
  }

  async function handleToggleFav() {
    const updated = await toggleFavorite(id);
    setDish(updated);
    toast(updated.isFavorite ? '❤️ Ajouté aux favoris' : 'Retiré des favoris');
  }

  async function handleDelete() {
    if (!confirm('Supprimer ce plat ?')) return;
    await deleteDish(id);
    toast('Plat supprimé', 'success');
    navigate(-1);
  }

  async function saveEdit() {
    const tags = editForm.tags ? editForm.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    const updated = await updateDish(id, { ...editForm, tags, price: editForm.price ? parseFloat(editForm.price) : null });
    setDish(updated);
    setEditing(false);
    toast('Plat mis à jour ✓', 'success');
  }

  async function handleShare() {
    setShareLoading(true);
    try {
      const text = `🍽 ${dish.name}\n📍 ${dish.restaurantName}\n${dish.rating > 0 ? '⭐'.repeat(dish.rating) + '\n' : ''}${dish.notes ? dish.notes + '\n' : ''}Partagé depuis FoodPrint`;
      if (navigator.share) {
        await navigator.share({ title: dish.name, text, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(text);
        toast('Copié dans le presse-papier ✓', 'success');
      }
    } catch (_) {}
    setShareLoading(false);
  }

  if (loading) return <div className="loading-overlay"><div className="spinner" /></div>;

  const recipe = dish.recipe;
  const hasTabs = recipe || dish.detectedIngredients?.length > 0;

  return (
    <div>
      {/* Hero image */}
      <div style={{ position: 'relative' }}>
        {dish.photo ? (
          <img src={dish.photo} alt={dish.name} style={{ width: '100%', height: 280, objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ width: '100%', height: 200, background: 'linear-gradient(135deg, var(--surface-2), var(--surface-3))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '5rem' }}>
            {TYPE_EMOJI[dish.type] || '🍴'}
          </div>
        )}
        {/* Top bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '16px', display: 'flex', justifyContent: 'space-between', background: 'linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)' }}>
          <button onClick={() => navigate(-1)} style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>←</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleShare} style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Partager">
              {shareLoading ? '⏳' : '📤'}
            </button>
            <button onClick={handleToggleFav} style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }} title="Favori">
              {dish.isFavorite ? '❤️' : '🤍'}
            </button>
            <button onClick={() => setEditing(true)} style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Modifier">✏️</button>
          </div>
        </div>
      </div>

      <div className="page" style={{ paddingTop: 16 }}>
        {/* Title block */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
            <h1 style={{ flex: 1, fontSize: '1.5rem', fontFamily: 'var(--font-display)', lineHeight: 1.2 }}>{dish.name}</h1>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <span className={`badge type-${dish.type}`}>{TYPE_LABELS[dish.type]}</span>
            {recipe && <span className="badge badge-success">📋 Recette IA</span>}
            {dish.price && <span className="badge badge-amber">💶 {dish.price}€</span>}
          </div>
          {dish.rating > 0 && <StarRating value={dish.rating} readOnly size="1.2rem" />}
        </div>

        {/* Meta */}
        <div className="card card-padded" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <MetaRow emoji="📍" label="Restaurant">
              <span style={{ fontWeight: 600 }}>{dish.restaurantName}</span>
              {dish.restaurantId && <button onClick={() => navigate(`/restaurants/${dish.restaurantId}`)} className="btn btn-ghost btn-sm" style={{ padding: '2px 8px' }}>Voir →</button>}
            </MetaRow>
            <MetaRow emoji="📅" label="Date">
              {dish.date ? format(parseISO(dish.date), "d MMMM yyyy", { locale: fr }) : '—'}
            </MetaRow>
            {dish.location && (
              <MetaRow emoji="🗺" label="Position">
                <button onClick={() => openInMaps(dish.location.lat, dish.location.lng, dish.restaurantName)} className="btn btn-ghost btn-sm" style={{ padding: '2px 0' }}>Voir sur la carte →</button>
              </MetaRow>
            )}
            {dish.tags?.length > 0 && (
              <MetaRow emoji="🏷" label="Tags">
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {dish.tags.map((t, i) => <span key={i} className="badge badge-neutral">{t}</span>)}
                </div>
              </MetaRow>
            )}
          </div>
        </div>

        {/* Notes */}
        {dish.notes && (
          <div className="card card-padded" style={{ marginBottom: 16, borderLeft: '3px solid var(--amber)' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-2)', fontStyle: 'italic', lineHeight: 1.6 }}>💬 "{dish.notes}"</p>
          </div>
        )}

        {/* Tabs */}
        {hasTabs && (
          <>
            <div className="pill-group" style={{ marginBottom: 16 }}>
              <button className={`pill ${activeTab === 'info' ? 'active' : ''}`} onClick={() => setActiveTab('info')}>ℹ️ Info</button>
              {dish.detectedIngredients?.length > 0 && <button className={`pill ${activeTab === 'ingredients' ? 'active' : ''}`} onClick={() => setActiveTab('ingredients')}>🥬 Ingrédients</button>}
              {recipe && <button className={`pill ${activeTab === 'recipe' ? 'active' : ''}`} onClick={() => setActiveTab('recipe')}>📋 Recette</button>}
              {recipe?.nutritional_info && <button className={`pill ${activeTab === 'nutrition' ? 'active' : ''}`} onClick={() => setActiveTab('nutrition')}>🥗 Nutrition</button>}
            </div>

            {activeTab === 'ingredients' && dish.detectedIngredients?.length > 0 && (
              <div className="card card-padded" style={{ marginBottom: 16 }}>
                <h3 style={{ marginBottom: 12 }}>🥬 Ingrédients détectés</h3>
                <div className="chips-container">
                  {dish.detectedIngredients.map((ing, i) => (
                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 20, padding: '5px 12px', fontSize: '0.85rem' }}>{ing}</span>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'recipe' && recipe && <RecipeView recipe={recipe} />}

            {activeTab === 'nutrition' && recipe?.nutritional_info && <NutritionView info={recipe.nutritional_info} />}
          </>
        )}

        {/* Delete */}
        <button className="btn btn-danger btn-full" style={{ marginTop: 24 }} onClick={handleDelete}>🗑 Supprimer ce plat</button>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setEditing(false)}>
          <div className="modal">
            <div className="modal-handle" />
            <h3 style={{ marginBottom: 16 }}>Modifier le plat</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label className="label">Nom</label>
                <input className="input" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="label">Catégorie</label>
                <div className="pill-group">
                  {Object.entries(TYPE_LABELS).map(([v, l]) => (
                    <button key={v} className={`pill ${editForm.type === v ? 'active' : ''}`} onClick={() => setEditForm(f => ({ ...f, type: v }))}>{l}</button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="label">Date</label>
                <input className="input" type="date" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="label">Note</label>
                <StarRating value={editForm.rating} onChange={v => setEditForm(f => ({ ...f, rating: v }))} />
              </div>
              <div className="form-group">
                <label className="label">Prix (€)</label>
                <input className="input" type="number" min="0" step="0.5" value={editForm.price || ''} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="label">Tags</label>
                <input className="input" placeholder="veggie, signature, épicé…" value={editForm.tags} onChange={e => setEditForm(f => ({ ...f, tags: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="label">Notes</label>
                <textarea className="input" rows={3} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
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

function MetaRow({ emoji, label, children }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: '0.9rem' }}>
      <span style={{ width: 20, flexShrink: 0 }}>{emoji}</span>
      <span style={{ color: 'var(--text-3)', minWidth: 80, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function RecipeView({ recipe }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Summary */}
      <div className="card card-padded" style={{ background: 'linear-gradient(135deg, #FFF8F3, #FFF3E0)' }}>
        <h3 className="serif" style={{ fontSize: '1.2rem', marginBottom: 6 }}>{recipe.title}</h3>
        {recipe.subtitle && <p className="text-sm" style={{ fontStyle: 'italic', color: 'var(--text-2)', marginBottom: 8 }}>{recipe.subtitle}</p>}
        {recipe.description && <p className="text-sm" style={{ color: 'var(--text-2)', marginBottom: 10, lineHeight: 1.5 }}>{recipe.description}</p>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {recipe.prep_time && <span className="badge badge-neutral">⏱ Prep: {recipe.prep_time}</span>}
          {recipe.cook_time && <span className="badge badge-neutral">🍳 {recipe.cook_time}</span>}
          {recipe.servings && <span className="badge badge-amber">👥 {recipe.servings} pers.</span>}
          {recipe.difficulty && <span className="badge badge-primary">{recipe.difficulty}</span>}
        </div>
      </div>

      {/* Equipment */}
      {recipe.equipment?.length > 0 && (
        <Collapsible emoji="🔪" title="Matériel">
          <div className="chips-container">{recipe.equipment.map((e, i) => <span key={i} className="ingredient-chip">{e}</span>)}</div>
        </Collapsible>
      )}

      {/* Ingredients */}
      {recipe.ingredients?.length > 0 && (
        <Collapsible emoji="🥬" title={`Ingrédients (${recipe.servings || 2} pers.)`}>
          {recipe.ingredients.map((ing, i) => (
            <div key={i} className="ingredient-row">
              <span className="ingredient-qty">{ing.quantity} {ing.unit}</span>
              <span className="ingredient-name">{ing.name}{ing.optional && <span className="text-muted text-xs"> (opt.)</span>}</span>
              {ing.notes && <span className="ingredient-note">{ing.notes}</span>}
            </div>
          ))}
        </Collapsible>
      )}

      {/* Steps */}
      {recipe.steps?.length > 0 && (
        <Collapsible emoji="📋" title="Étapes de préparation" defaultOpen>
          {recipe.steps.map((s, i) => (
            <div key={i} className="step-row">
              <div className="step-num">{s.step || i + 1}</div>
              <div className="step-body">
                {s.title && <div className="step-title">{s.title}</div>}
                <div className="step-desc">{s.description}</div>
                <div className="step-meta">
                  {s.duration && <span className="step-badge">⏱ {s.duration}</span>}
                  {s.temperature && <span className="step-badge">🌡 {s.temperature}</span>}
                </div>
                {s.tips && <div style={{ marginTop: 6, padding: '6px 8px', background: 'rgba(232,160,32,0.1)', borderRadius: 6, fontSize: '0.78rem', color: 'var(--text-2)' }}>💡 {s.tips}</div>}
              </div>
            </div>
          ))}
        </Collapsible>
      )}

      {/* Wine */}
      {recipe.wine_pairing && (
        <Collapsible emoji="🍷" title="Accord mets-vins">
          <p style={{ fontWeight: 600, marginBottom: 4 }}>{recipe.wine_pairing.wine}</p>
          {recipe.wine_pairing.appellation && <p className="text-sm text-muted">{recipe.wine_pairing.appellation}</p>}
          {recipe.wine_pairing.description && <p className="text-sm" style={{ marginTop: 8, color: 'var(--text-2)', lineHeight: 1.5 }}>{recipe.wine_pairing.description}</p>}
        </Collapsible>
      )}

      {/* Chef tips */}
      {recipe.chef_tips?.length > 0 && (
        <Collapsible emoji="👨‍🍳" title="Astuces du chef">
          {recipe.chef_tips.map((tip, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: '0.88rem' }}>
              <span>💡</span><span style={{ color: 'var(--text-2)' }}>{tip}</span>
            </div>
          ))}
        </Collapsible>
      )}

      {/* Plating */}
      {recipe.plating_tips && (
        <Collapsible emoji="🎨" title="Dressage">
          <p style={{ fontSize: '0.9rem', color: 'var(--text-2)', lineHeight: 1.6 }}>{recipe.plating_tips}</p>
        </Collapsible>
      )}

      {/* Variations */}
      {recipe.variations?.length > 0 && (
        <Collapsible emoji="🔄" title="Variantes">
          {recipe.variations.map((v, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <strong style={{ fontSize: '0.9rem' }}>{v.name}</strong>
              <p className="text-sm text-muted" style={{ marginTop: 2 }}>{v.description}</p>
            </div>
          ))}
        </Collapsible>
      )}

      {/* History */}
      {recipe.history && (
        <Collapsible emoji="📖" title="Histoire du plat">
          <p style={{ fontSize: '0.9rem', color: 'var(--text-2)', lineHeight: 1.6 }}>{recipe.history}</p>
        </Collapsible>
      )}
    </div>
  );
}

function NutritionView({ info }) {
  const items = [
    { label: 'Calories', value: info.calories_per_serving, unit: 'kcal' },
    { label: 'Protéines', value: info.protein, unit: 'g' },
    { label: 'Glucides', value: info.carbohydrates, unit: 'g' },
    { label: 'Lipides', value: info.fat, unit: 'g' },
    { label: 'Fibres', value: info.fiber, unit: 'g' },
    { label: 'Sodium', value: info.sodium, unit: 'mg' },
  ].filter(i => i.value);

  return (
    <div className="card card-padded">
      <h3 style={{ marginBottom: 14 }}>🥗 Valeurs nutritionnelles <span className="text-sm text-muted">(par portion)</span></h3>
      <div className="nutrition-grid">
        {items.map(item => (
          <div key={item.label} className="nutrition-item">
            <div className="nutrition-value">{item.value}</div>
            <div className="nutrition-label">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Collapsible({ emoji, title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="recipe-section">
      <div className="recipe-section-title" onClick={() => setOpen(!open)} style={{ cursor: 'pointer', userSelect: 'none' }}>
        <span>{emoji}</span>
        <span style={{ flex: 1 }}>{title}</span>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && <div style={{ marginTop: 4 }}>{children}</div>}
    </div>
  );
}
