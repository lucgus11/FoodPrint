import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStats, getDishes } from '../db.js';
import { format, parseISO, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function Stats() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('all');

  useEffect(() => {
    Promise.all([getStats(), getDishes()]).then(([s, d]) => {
      setStats(s);
      setDishes(d);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="loading-overlay"><div className="spinner" /></div>;

  // Period filtering
  const now = new Date();
  const periodDishes = period === 'all' ? dishes : dishes.filter(d => {
    if (!d.date) return false;
    const date = parseISO(d.date);
    const months = period === '1m' ? 1 : period === '3m' ? 3 : 6;
    return isWithinInterval(date, { start: subMonths(now, months), end: now });
  });

  // Monthly activity (last 6 months)
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const month = subMonths(now, 5 - i);
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const count = dishes.filter(d => d.date && isWithinInterval(parseISO(d.date), { start, end })).length;
    return { label: format(month, 'MMM', { locale: fr }), count };
  });
  const maxMonthly = Math.max(...monthlyData.map(m => m.count), 1);

  // By type (period)
  const byType = periodDishes.reduce((acc, d) => { acc[d.type] = (acc[d.type] || 0) + 1; return acc; }, {});
  const typeTotal = Object.values(byType).reduce((s, v) => s + v, 0);

  // By rating
  const ratingDist = [1, 2, 3, 4, 5].map(r => ({ stars: r, count: periodDishes.filter(d => d.rating === r).length }));

  // Top ingredients (from detected)
  const ingCount = {};
  periodDishes.forEach(d => d.detectedIngredients?.forEach(i => { ingCount[i] = (ingCount[i] || 0) + 1; }));
  const topIngredients = Object.entries(ingCount).sort((a, b) => b[1] - a[1]).slice(0, 8);

  // Spending
  const pricedDishes = periodDishes.filter(d => d.price > 0);
  const totalSpend = pricedDishes.reduce((s, d) => s + d.price, 0);
  const avgPrice = pricedDishes.length ? totalSpend / pricedDishes.length : 0;
  const maxPrice = pricedDishes.reduce((m, d) => Math.max(m, d.price), 0);

  const TYPE_COLORS = { entree: '#E65100', plat: '#AD1457', dessert: '#6A1B9A', boisson: '#1565C0', autre: '#5C4F45' };
  const TYPE_LABELS = { entree: 'Entrées', plat: 'Plats', dessert: 'Desserts', boisson: 'Boissons', autre: 'Autres' };
  const TYPE_EMOJI = { entree: '🥗', plat: '🍽', dessert: '🍮', boisson: '🥤', autre: '🍴' };

  return (
    <div>
      <div className="page-header">
        <h1 className="display" style={{ marginBottom: 14 }}>📊 Statistiques</h1>
        <div className="pill-group">
          {[['all', 'Tout'], ['1m', '1 mois'], ['3m', '3 mois'], ['6m', '6 mois']].map(([v, l]) => (
            <button key={v} className={`pill ${period === v ? 'active' : ''}`} onClick={() => setPeriod(v)}>{l}</button>
          ))}
        </div>
      </div>

      <div className="page" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <KpiCard emoji="🍽" value={periodDishes.length} label="Plats enregistrés" color="var(--primary)" />
          <KpiCard emoji="🏪" value={stats.totalRestaurants} label="Restaurants visités" color="#1565C0" />
          <KpiCard emoji="⭐" value={stats.avgRating > 0 ? stats.avgRating + '/5' : '—'} label="Note moyenne" color="var(--amber)" />
          <KpiCard emoji="📋" value={stats.withRecipes} label="Recettes générées" color="#2E7D32" />
          <KpiCard emoji="❤️" value={stats.favorites} label="Favoris" color="#AD1457" />
          {totalSpend > 0 && <KpiCard emoji="💶" value={`${totalSpend.toFixed(0)}€`} label="Total dépensé" color="#5C4F45" />}
        </div>

        {/* Monthly activity chart */}
        <div className="card card-padded">
          <h3 style={{ marginBottom: 16, fontFamily: 'var(--font-display)' }}>📅 Activité mensuelle</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100 }}>
            {monthlyData.map((m, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                <div style={{ width: '100%', background: m.count > 0 ? 'var(--primary)' : 'var(--surface-3)', borderRadius: '6px 6px 2px 2px', height: `${Math.max((m.count / maxMonthly) * 80, m.count > 0 ? 6 : 2)}px`, transition: 'height 0.4s ease', minHeight: 2, position: 'relative' }}>
                  {m.count > 0 && (
                    <div style={{ position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)', fontSize: '0.7rem', fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>{m.count}</div>
                  )}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', textTransform: 'capitalize' }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Types breakdown */}
        {typeTotal > 0 && (
          <div className="card card-padded">
            <h3 style={{ marginBottom: 14, fontFamily: 'var(--font-display)' }}>🍽 Répartition des plats</h3>
            {/* Stacked bar */}
            <div style={{ display: 'flex', height: 16, borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
              {Object.entries(byType).map(([type, count]) => (
                <div key={type} style={{ width: `${(count / typeTotal) * 100}%`, background: TYPE_COLORS[type] || '#9C8E84', transition: 'width 0.3s' }} title={`${TYPE_LABELS[type]}: ${count}`} />
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '1.1rem' }}>{TYPE_EMOJI[type] || '🍴'}</span>
                  <span style={{ fontSize: '0.88rem', flex: 1 }}>{TYPE_LABELS[type] || type}</span>
                  <div style={{ width: 80, height: 6, background: 'var(--surface-3)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(count / typeTotal) * 100}%`, background: TYPE_COLORS[type] || 'var(--primary)', borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-2)', minWidth: 30, textAlign: 'right' }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rating distribution */}
        {periodDishes.some(d => d.rating > 0) && (
          <div className="card card-padded">
            <h3 style={{ marginBottom: 14, fontFamily: 'var(--font-display)' }}>⭐ Distribution des notes</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ratingDist.reverse().map(({ stars, count }) => (
                <div key={stars} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: 'var(--amber)', minWidth: 56, fontSize: '0.88rem' }}>{'★'.repeat(stars)}</span>
                  <div style={{ flex: 1, height: 8, background: 'var(--surface-3)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${periodDishes.length ? (count / periodDishes.length) * 100 : 0}%`, background: 'var(--amber)', borderRadius: 4, transition: 'width 0.4s' }} />
                  </div>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-3)', minWidth: 24, textAlign: 'right' }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Spending stats */}
        {pricedDishes.length > 0 && (
          <div className="card card-padded">
            <h3 style={{ marginBottom: 14, fontFamily: 'var(--font-display)' }}>💶 Dépenses</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div className="nutrition-item">
                <div className="nutrition-value">{totalSpend.toFixed(0)}€</div>
                <div className="nutrition-label">Total</div>
              </div>
              <div className="nutrition-item">
                <div className="nutrition-value">{avgPrice.toFixed(0)}€</div>
                <div className="nutrition-label">Moyenne</div>
              </div>
              <div className="nutrition-item">
                <div className="nutrition-value">{maxPrice.toFixed(0)}€</div>
                <div className="nutrition-label">Max</div>
              </div>
            </div>
          </div>
        )}

        {/* Cuisine breakdown */}
        {Object.keys(stats.byCuisine).length > 0 && (
          <div className="card card-padded">
            <h3 style={{ marginBottom: 14, fontFamily: 'var(--font-display)' }}>🌍 Cuisines explorées</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Object.entries(stats.byCuisine).sort((a, b) => b[1] - a[1]).map(([cuisine, count]) => (
                <span key={cuisine} className="badge badge-neutral" style={{ fontSize: '0.82rem', padding: '5px 12px' }}>
                  {cuisine} <strong style={{ color: 'var(--primary)', marginLeft: 4 }}>×{count}</strong>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Top ingredients */}
        {topIngredients.length > 0 && (
          <div className="card card-padded">
            <h3 style={{ marginBottom: 14, fontFamily: 'var(--font-display)' }}>🥬 Ingrédients fréquents</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {topIngredients.map(([ing, count], i) => (
                <div key={ing} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-3)', minWidth: 16, fontWeight: 700 }}>#{i + 1}</span>
                  <span style={{ fontSize: '0.9rem', flex: 1 }}>{ing}</span>
                  <div style={{ width: 60, height: 6, background: 'var(--surface-3)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(count / topIngredients[0][1]) * 100}%`, background: 'var(--primary)', borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-3)', minWidth: 20, textAlign: 'right' }}>×{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top restaurants */}
        {stats.topRestaurants.length > 0 && (
          <div className="card card-padded">
            <h3 style={{ marginBottom: 14, fontFamily: 'var(--font-display)' }}>🏆 Top restaurants</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {stats.topRestaurants.map((r, i) => (
                <div key={r.id} onClick={() => navigate(`/restaurants/${r.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '8px 0', borderBottom: i < stats.topRestaurants.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: i === 0 ? 'var(--amber)' : 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.82rem', color: i === 0 ? 'white' : 'var(--text-3)', flexShrink: 0 }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                    {r.cuisineType && <div style={{ fontSize: '0.74rem', color: 'var(--text-3)' }}>{r.cuisineType}</div>}
                  </div>
                  <span className="badge badge-primary">{r.visitCount} visite{r.visitCount > 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {periodDishes.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <h3>Pas encore de données</h3>
            <p className="text-sm">Commencez à scanner vos plats pour voir vos statistiques</p>
            <button className="btn btn-primary" onClick={() => navigate('/scanner')}>📷 Scanner un plat</button>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ emoji, value, label, color }) {
  return (
    <div className="card card-padded" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '1.6rem', marginBottom: 4 }}>{emoji}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.6rem', color, lineHeight: 1, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: '0.74rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
    </div>
  );
}
