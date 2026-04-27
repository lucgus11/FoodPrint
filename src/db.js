import { openDB } from 'idb';

const DB_NAME = 'foodprint-db';
const DB_VERSION = 2;

let dbPromise = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // Restaurants
        if (!db.objectStoreNames.contains('restaurants')) {
          const rs = db.createObjectStore('restaurants', { keyPath: 'id' });
          rs.createIndex('name', 'name');
          rs.createIndex('cuisineType', 'cuisineType');
          rs.createIndex('createdAt', 'createdAt');
        }
        // Dishes
        if (!db.objectStoreNames.contains('dishes')) {
          const ds = db.createObjectStore('dishes', { keyPath: 'id' });
          ds.createIndex('restaurantId', 'restaurantId');
          ds.createIndex('type', 'type');
          ds.createIndex('date', 'date');
          ds.createIndex('isFavorite', 'isFavorite');
          ds.createIndex('createdAt', 'createdAt');
          ds.createIndex('restaurantName', 'restaurantName');
          ds.createIndex('rating', 'rating');
        }
      },
    });
  }
  return dbPromise;
}

// ─── ID ───────────────────────────────────────────────────────────────────────
export function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── IMAGE UTILS ──────────────────────────────────────────────────────────────
export async function compressImage(dataUrl, maxWidth = 1200, quality = 0.8) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
  });
}

export async function makeThumbnail(dataUrl, size = 300) {
  return compressImage(dataUrl, size, 0.7);
}

// ─── RESTAURANTS ─────────────────────────────────────────────────────────────
export async function getRestaurants() {
  const db = await getDB();
  const all = await db.getAll('restaurants');
  return all.sort((a, b) => (b.lastVisit || b.createdAt) > (a.lastVisit || a.createdAt) ? 1 : -1);
}

export async function getRestaurant(id) {
  const db = await getDB();
  return db.get('restaurants', id);
}

export async function saveRestaurant(data) {
  const db = await getDB();
  const restaurant = { createdAt: new Date().toISOString(), visitCount: 0, ...data };
  await db.put('restaurants', restaurant);
  return restaurant;
}

export async function updateRestaurant(id, patch) {
  const db = await getDB();
  const existing = await db.get('restaurants', id);
  if (!existing) throw new Error('Restaurant not found');
  const updated = { ...existing, ...patch, id };
  await db.put('restaurants', updated);
  return updated;
}

export async function deleteRestaurant(id) {
  const db = await getDB();
  // Also delete associated dishes
  const dishes = await getDishesForRestaurant(id);
  const tx = db.transaction(['restaurants', 'dishes'], 'readwrite');
  await tx.objectStore('restaurants').delete(id);
  for (const d of dishes) await tx.objectStore('dishes').delete(d.id);
  await tx.done;
}

// ─── DISHES ──────────────────────────────────────────────────────────────────
export async function getDishes() {
  const db = await getDB();
  const all = await db.getAll('dishes');
  return all.sort((a, b) => (b.date || b.createdAt) > (a.date || a.createdAt) ? 1 : -1);
}

export async function getDish(id) {
  const db = await getDB();
  return db.get('dishes', id);
}

export async function getDishesForRestaurant(restaurantId) {
  const db = await getDB();
  const all = await db.getAllFromIndex('dishes', 'restaurantId', restaurantId);
  return all.sort((a, b) => (b.date || b.createdAt) > (a.date || a.createdAt) ? 1 : -1);
}

export async function getFavoriteDishes() {
  const db = await getDB();
  const all = await db.getAllFromIndex('dishes', 'isFavorite', 1);
  return all.sort((a, b) => (b.date || b.createdAt) > (a.date || a.createdAt) ? 1 : -1);
}

export async function saveDish(data) {
  const db = await getDB();
  const dish = {
    recipe: null,
    tags: [],
    isFavorite: 0,
    rating: 0,
    detectedIngredients: [],
    location: null,
    price: null,
    notes: '',
    createdAt: new Date().toISOString(),
    date: new Date().toISOString().split('T')[0],
    ...data,
  };

  await db.put('dishes', dish);

  // Update restaurant visit count & lastVisit
  if (dish.restaurantId) {
    const resto = await db.get('restaurants', dish.restaurantId);
    if (resto) {
      await db.put('restaurants', {
        ...resto,
        visitCount: (resto.visitCount || 0) + 1,
        lastVisit: dish.date,
      });
    }
  }

  return dish;
}

export async function updateDish(id, patch) {
  const db = await getDB();
  const existing = await db.get('dishes', id);
  if (!existing) throw new Error('Dish not found');
  const updated = { ...existing, ...patch, id };
  await db.put('dishes', updated);
  return updated;
}

export async function deleteDish(id) {
  const db = await getDB();
  return db.delete('dishes', id);
}

export async function toggleFavorite(id) {
  const db = await getDB();
  const dish = await db.get('dishes', id);
  if (!dish) return;
  const updated = { ...dish, isFavorite: dish.isFavorite ? 0 : 1 };
  await db.put('dishes', updated);
  return updated;
}

// ─── SEARCH ───────────────────────────────────────────────────────────────────
export async function searchDishes(query) {
  const q = query.toLowerCase().trim();
  if (!q) return getDishes();
  const all = await getDishes();
  return all.filter(
    (d) =>
      d.name?.toLowerCase().includes(q) ||
      d.restaurantName?.toLowerCase().includes(q) ||
      d.notes?.toLowerCase().includes(q) ||
      d.tags?.some((t) => t.toLowerCase().includes(q)) ||
      d.detectedIngredients?.some((i) => i.toLowerCase().includes(q)) ||
      d.recipe?.title?.toLowerCase().includes(q)
  );
}

// ─── STATS ────────────────────────────────────────────────────────────────────
export async function getStats() {
  const [dishes, restaurants] = await Promise.all([getDishes(), getRestaurants()]);

  const byType = dishes.reduce((acc, d) => {
    acc[d.type] = (acc[d.type] || 0) + 1;
    return acc;
  }, {});

  const byRating = dishes.filter((d) => d.rating > 0);
  const avgRating = byRating.length
    ? byRating.reduce((s, d) => s + d.rating, 0) / byRating.length
    : 0;

  const byCuisine = restaurants.reduce((acc, r) => {
    if (r.cuisineType) acc[r.cuisineType] = (acc[r.cuisineType] || 0) + 1;
    return acc;
  }, {});

  const withRecipes = dishes.filter((d) => d.recipe).length;
  const favorites = dishes.filter((d) => d.isFavorite).length;

  const topRestaurants = [...restaurants]
    .sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0))
    .slice(0, 5);

  return {
    totalDishes: dishes.length,
    totalRestaurants: restaurants.length,
    byType,
    avgRating: Math.round(avgRating * 10) / 10,
    byCuisine,
    withRecipes,
    favorites,
    topRestaurants,
    recentDishes: dishes.slice(0, 6),
  };
}

// ─── GEOLOCATION ─────────────────────────────────────────────────────────────
export function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Géolocalisation non supportée'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  });
}

export function openInMaps(lat, lng, name = '') {
  const ua = navigator.userAgent;
  const encoded = encodeURIComponent(name);
  if (/iPhone|iPad|iPod/i.test(ua)) {
    window.open(`maps://maps.apple.com/?q=${encoded}&ll=${lat},${lng}`, '_blank');
  } else {
    window.open(`https://maps.google.com/?q=${lat},${lng}`, '_blank');
  }
}
