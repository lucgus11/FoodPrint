import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDishes, getRestaurants } from '../db.js';
import { DishListItem } from '../components/DishCard.jsx';

const TYPE_LABELS = { entree: 'Entrées', plat: 'Plats', dessert: 'Desserts', boisson: 'Boissons', autre: 'Autres' };
const SORT_OPTIONS = [
  { value: 'date_desc', label: '🕐 Plus récents' },
  { value: 'date_asc', label: '🕐 Plus anciens' },
  { value: 'rating_desc', label: '⭐ Mieux notés' },
  { value: 'name_asc', label: '🔤 A → Z' },
  { value: 'price_asc', label: '💶 Prix croissant' },
  { value: 'price_desc', label: '💶 Prix décroissant' },
];

export default function Search() {
  const navigate = useNavigate();
  const [allDishes, setAllDishes] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [restaurantFilter, setRestaurantFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState(0);
  const [favOnly, setFavOnly] = useState(false);
  const [hasRecipe, setHasRecipe] = useState(false);
  const [sortBy, setSortBy] = useState('date_desc');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    Promise.all([getDishes(), getRestaurants()]).then(([d, r]) => {
      setAllDishes(d);
      setRestaurants(r);
      setLoading(false);
    });
  }, []);

  const filtered = useCallback(() => {
    let results = [...allDishes];
    const q = query.toLowerCase().trim();
    if (q) {
      results = results.filter(d =>
        d.name?.toLowerCase().includes(q) ||
        d.restaurantName?.toLowerCase().includes(q) ||
        d.notes?.toLowerCase().includes(q) ||
        d.tags?.some(t => t.toLowerCase().includes(q)) ||
        d.detectedIngredients?.some(i => i.toLowerCase().includes(q)) ||
        d.recipe?.title?.toLowerCase().includes(q)
      );
    }
    if (typeFilter !== 'all') results = results.filter(d => d.type === typeFilter);
    if (restaurantFilter !== 'all') results = results.filter(d => d.restaurantId === restaurantFilter);
    if (ratingFilter > 0) results = results.filter(d => d.rating >= ratingFilter);
    if (favOnly) results = results.filter(d => d.isFavorite);
    if (hasRecipe) results = results.filter(d => d.recipe);

    results.sort((a, b) => {
      switch (sortBy) {
        case 'date_asc': return (a.date || '') > (b.date || '') ? 1 : -1;
        case 'date_desc': return (a.date || '') < (b.date || '') ? 1 : -1;
        case 'rating_desc': return (b.rating || 0) - (a.rating || 0);
        case 'name_asc': return a.name?.localeCompare(b.name || '') || 0;
        case 'price_asc': return (a.price || 999) - (b.price || 999);
        case 'price_desc': return (b.price || 0) - (a.price || 0);
        default: return 0;
      }
    });
    return results;
  }, [allDishes, query, typeFilter, restaurantFilter, ratingFilter, favOnly, hasRecipe, sortBy]);

  const results = filtered();
  const activeFilters = [typeFilter !== 'all', restaurantFilter !== 'all', ratingFilter > 0, favOnly, hasRecipe].filter(Boolean).length;

  function clearAll() {
    setQuery('');
    setTypeFilter('all');
    setRestaurantFilter('all');
    setRatingFilter(0);
    setFavOnly(false);
    setHasRecipe(false);
    setSortBy('date_desc');
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="display" style={{ marginBottom: 14 }}>🔍 Rechercher</h1>

        {/* Search input */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', fontSize: '1.1rem' }}>🔍</span>
          <input
            className="input"
            style={{ paddingLeft: 38 }}
            placeholder="Plat, restaurant, ingrédient, tag…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
          {query && <button onClick={() => setQuery('')} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', fontSize: '1.1rem' }}>✕</button>}
        </div>

        {/* Filter row */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'} btn-sm`} style={{ flexShrink: 0 }} onClick={() => setShowFilters(!showFilters)}>
            ⚙️ Filtres{activeFilters > 0 ? ` (${activeFilters})` : ''}
          </button>
          <select className="input" style={{ flex: 1, padding: '8px 12px', fontSize: '0.82rem' }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {(activeFilters > 0 || query) && <button className="btn btn-ghost btn-sm" onClick={clearAll} style={{ flexShrink: 0 }}>✕ Effacer</button>}
        </div>
      </div>

      {/* Extended filters panel */}
      {showFilters && (
        <div style={{ padding: '0 16px 16px', maxWidth: 480, margin: '0 auto', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Type filter */}
            <div>
              <div className="label" style={{ marginBottom: 8 }}>Catégorie</div>
              <div className="pill-group">
                <button className={`pill ${typeFilter === 'all' ? 'active' : ''}`} onClick={() => setTypeFilter('all')}>Tous</button>
                {Object.entries(TYPE_LABELS).map(([v, l]) => (
                  <button key={v} className={`pill ${typeFilter === v ? 'active' : ''}`} onClick={() => setTypeFilter(v)}>{l}</button>
                ))}
              </div>
            </div>

            {/* Restaurant filter */}
            {restaurants.length > 0 && (
              <div className="form-group">
                <label className="label">Restaurant</label>
                <select className="input" value={restaurantFilter} onChange={e => setRestaurantFilter(e.target.value)}>
                  <option value="all">Tous les restaurants</option>
                  {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            )}

            {/* Rating filter */}
            <div>
              <div className="label" style={{ marginBottom: 8 }}>Note minimale</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[0, 1, 2, 3, 4, 5].map(n => (
                  <button key={n} className={`btn btn-sm ${ratingFilter === n ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setRatingFilter(n)} style={{ flex: 1, padding: '6px 4px', fontSize: '0.8rem' }}>
                    {n === 0 ? 'Tous' : '★'.repeat(n)}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className={`btn ${favOnly ? 'btn-primary' : 'btn-secondary'} btn-sm`} style={{ flex: 1 }} onClick={() => setFavOnly(!favOnly)}>
                ❤️ Favoris seulement
              </button>
              <button className={`btn ${hasRecipe ? 'btn-primary' : 'btn-secondary'} btn-sm`} style={{ flex: 1 }} onClick={() => setHasRecipe(!hasRecipe)}>
                📋 Avec recette
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page" style={{ paddingTop: 16 }}>
        {loading ? (
          <div className="loading-overlay"><div className="spinner" /></div>
        ) : (
          <>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-3)', marginBottom: 14 }}>
              {results.length} résultat{results.length !== 1 ? 's' : ''}{query && ` pour "${query}"`}
            </p>

            {results.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🔍</div>
                <h3>Aucun résultat</h3>
                <p className="text-sm">Essayez d'autres mots-clés ou effacez les filtres</p>
                <button className="btn btn-secondary" onClick={clearAll}>Effacer tout</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {results.map(d => <DishListItem key={d.id} dish={d} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
