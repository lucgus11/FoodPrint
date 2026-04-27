import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getDishes, getFavoriteDishes, getRestaurants } from '../db.js';
import { DishCard, DishListItem } from '../components/DishCard.jsx';

export default function Dashboard() {
  const navigate = useNavigate();
  const [dishes, setDishes] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('recent');

  useEffect(() => {
    async function load() {
      const [d, r, f] = await Promise.all([getDishes(), getRestaurants(), getFavoriteDishes()]);
      setDishes(d);
      setRestaurants(r);
      setFavorites(f);
      setLoading(false);
    }
    load();
  }, []);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bonsoir' : 'Bonsoir';

  const displayDishes = filter === 'favorites' ? favorites : dishes;

  function formatDate(d) {
    const date = parseISO(d);
    if (isToday(date)) return "Aujourd'hui";
    if (isYesterday(date)) return 'Hier';
    return format(date, 'd MMMM', { locale: fr });
  }

  if (loading) {
    return (
      <div className="loading-overlay" style={{ marginTop: 60 }}>
        <div className="spinner" />
        <p className="text-muted">Chargement...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ background: 'linear-gradient(160deg, #C8441A 0%, #E8A020 100%)', padding: '32px 20px 24px', color: 'white' }}>
        <p style={{ opacity: 0.85, fontSize: '0.88rem', fontWeight: 500, marginBottom: 4 }}>{greeting} 👋</p>
        <h1 className="display" style={{ color: 'white', marginBottom: 16, fontSize: '2rem' }}>FoodPrint</h1>

        {/* Quick stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[
            { label: 'Plats', value: dishes.length, emoji: '🍽' },
            { label: 'Restos', value: restaurants.length, emoji: '📍' },
            { label: 'Favoris', value: favorites.length, emoji: '❤️' },
          ].map((s) => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.4rem' }}>{s.emoji}</div>
              <div style={{ fontWeight: 800, fontSize: '1.4rem', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: '0.72rem', opacity: 0.8, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="page" style={{ paddingTop: 20 }}>

        {/* Quick actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
          <button className="card card-padded" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => navigate('/scanner')}>
            <div style={{ fontSize: '1.8rem', marginBottom: 6 }}>📷</div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Scanner un plat</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 2 }}>IA + reconnaissance</div>
          </button>
          <button className="card card-padded" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => navigate('/add')}>
            <div style={{ fontSize: '1.8rem', marginBottom: 6 }}>✍️</div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Ajouter manuellement</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 2 }}>Sans photo</div>
          </button>
        </div>

        {/* Recent restaurants */}
        {restaurants.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div className="section-header">
              <h2 className="section-title">Restaurants récents</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/restaurants')}>Voir tout</button>
            </div>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
              {restaurants.slice(0, 4).map((r) => (
                <button
                  key={r.id}
                  onClick={() => navigate(`/restaurants/${r.id}`)}
                  style={{ flexShrink: 0, textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 14px', cursor: 'pointer', minWidth: 80 }}
                >
                  <div style={{ fontSize: '1.6rem', marginBottom: 4 }}>{cuisineEmoji(r.cuisineType)}</div>
                  <div style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text)', maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', marginTop: 2 }}>{r.visitCount || 0} visites</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Dishes */}
        <div>
          <div className="section-header">
            <h2 className="section-title">Mes plats</h2>
          </div>

          {dishes.length > 0 && (
            <div className="pill-group" style={{ marginBottom: 14 }}>
              {['recent', 'favorites'].map((f) => (
                <button key={f} className={`pill ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                  {f === 'recent' ? '🕐 Récents' : '❤️ Favoris'}
                </button>
              ))}
            </div>
          )}

          {displayDishes.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">{filter === 'favorites' ? '❤️' : '🍽'}</div>
              <h3>{filter === 'favorites' ? 'Aucun favori' : 'Aucun plat enregistré'}</h3>
              <p style={{ fontSize: '0.88rem' }}>
                {filter === 'favorites'
                  ? 'Ajoutez des plats à vos favoris'
                  : 'Commencez par scanner ou ajouter votre premier plat !'}
              </p>
              {filter === 'recent' && (
                <button className="btn btn-primary" onClick={() => navigate('/scanner')}>
                  📷 Scanner un plat
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {displayDishes.slice(0, 20).map((dish) => (
                <DishListItem key={dish.id} dish={dish} />
              ))}
              {displayDishes.length > 20 && (
                <button className="btn btn-secondary btn-full" onClick={() => navigate('/search')}>
                  Voir tous les plats ({displayDishes.length})
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Update offline banner */}
      <OfflineBanner />
    </div>
  );
}

function cuisineEmoji(type) {
  const map = { Française: '🥐', Italienne: '🍕', Japonaise: '🍣', Chinoise: '🥟', Mexicaine: '🌮', Indienne: '🍛', Grecque: '🫒', Américaine: '🍔', Libanaise: '🧆', Espagnole: '🥘', Thaïlandaise: '🍜', Marocaine: '🍲' };
  return map[type] || '🍴';
}

function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  if (!offline) return null;
  return (
    <div style={{ background: 'var(--warning-bg)', borderTop: '1px solid #FFB74D', padding: '10px 16px', textAlign: 'center', fontSize: '0.82rem', color: 'var(--warning)', fontWeight: 600 }}>
      📵 Mode hors-ligne – Scanner et recettes indisponibles
    </div>
  );
}
