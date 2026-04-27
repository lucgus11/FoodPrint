import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

const TYPE_LABELS = { entree: 'Entrée', plat: 'Plat', dessert: 'Dessert', boisson: 'Boisson', autre: 'Autre' };
const TYPE_EMOJI = { entree: '🥗', plat: '🍽', dessert: '🍮', boisson: '🥤', autre: '🍴' };

export function DishCard({ dish }) {
  const navigate = useNavigate();
  return (
    <div className="dish-card" onClick={() => navigate(`/dish/${dish.id}`)}>
      {dish.thumbnailPhoto || dish.photo ? (
        <img className="dish-card-img" src={dish.thumbnailPhoto || dish.photo} alt={dish.name} loading="lazy" />
      ) : (
        <div className="dish-card-img-placeholder">{TYPE_EMOJI[dish.type] || '🍴'}</div>
      )}
      <div className="dish-card-body">
        <div className="dish-card-name">{dish.name}</div>
        <div className="dish-card-resto">📍 {dish.restaurantName || 'Restaurant inconnu'}</div>
        <div className="dish-card-footer">
          <span className={`badge badge-sm type-${dish.type}`}>{TYPE_LABELS[dish.type] || dish.type}</span>
          {dish.rating > 0 && <span style={{ fontSize: '0.75rem', color: 'var(--amber)' }}>{'★'.repeat(dish.rating)}</span>}
        </div>
      </div>
    </div>
  );
}

export function DishListItem({ dish }) {
  const navigate = useNavigate();
  const date = dish.date ? format(parseISO(dish.date), 'd MMM', { locale: fr }) : '';

  return (
    <div className="dish-list-item" onClick={() => navigate(`/dish/${dish.id}`)}>
      {dish.thumbnailPhoto || dish.photo ? (
        <img className="dish-list-img" src={dish.thumbnailPhoto || dish.photo} alt={dish.name} loading="lazy" />
      ) : (
        <div className="dish-list-placeholder">{TYPE_EMOJI[dish.type] || '🍴'}</div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 2 }}>{dish.name}</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginBottom: 4 }}>
          {dish.restaurantName} · {date}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span className={`badge type-${dish.type}`} style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
            {TYPE_LABELS[dish.type]}
          </span>
          {dish.recipe && <span className="badge badge-success" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>📋 Recette</span>}
        </div>
      </div>
      {dish.rating > 0 && (
        <div style={{ fontSize: '0.8rem', color: 'var(--amber)', flexShrink: 0 }}>
          {'★'.repeat(dish.rating)}
        </div>
      )}
    </div>
  );
}
