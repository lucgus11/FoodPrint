import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { genId, compressImage, makeThumbnail, saveDish, saveRestaurant, getCurrentLocation, getRestaurants } from '../db.js';
import StarRating from '../components/StarRating.jsx';
import { toast } from '../components/Toast.jsx';

const STEPS = ['capture', 'setup', 'analyzing', 'items', 'options', 'generating', 'recipe', 'save'];
const STEP_LABELS = ['Photo', 'Contexte', 'Analyse', 'Ingrédients', 'Options', 'Génération', 'Recette', 'Sauvegarder'];

// ─── MAIN SCANNER ─────────────────────────────────────────────────────────────
export default function Scanner() {
  const navigate = useNavigate();
  const [step, setStep] = useState('capture');
  const [photo, setPhoto] = useState(null); // { dataUrl, compressed, thumbnail }
  const [setupData, setSetupData] = useState({ restaurantName: '', cuisineType: 'auto', mealType: 'dinner', portion: 'individuelle' });
  const [analysisResult, setAnalysisResult] = useState(null);
  const [detectedItems, setDetectedItems] = useState([]);
  const [recipeOptions, setRecipeOptions] = useState({ language: 'fr', detailLevel: 'detailed', servings: 2, includeNutrition: true, includeWine: true, includeChefTips: true, includePlating: true, includeHistory: false, includeVariations: true, includeEquipment: true, dietaryRestrictions: [], cookingSkillLevel: 'intermediate' });
  const [recipe, setRecipe] = useState(null);
  const [saveData, setSaveData] = useState({ dishName: '', dishType: 'plat', rating: 0, notes: '', price: '', tags: '', restaurantId: null, isNewRestaurant: false });
  const [error, setError] = useState(null);
  const [restaurants, setRestaurants] = useState([]);

  const stepIndex = STEPS.indexOf(step);

  const goTo = (s) => { setError(null); setStep(s); };

  // ─── STEP: CAPTURE ──────────────────────────────────────────────────────
  if (step === 'capture') return <StepCapture onCapture={async (dataUrl) => {
    const [compressed, thumbnail] = await Promise.all([compressImage(dataUrl, 1200, 0.85), makeThumbnail(dataUrl, 400)]);
    setPhoto({ dataUrl, compressed, thumbnail });
    const restos = await getRestaurants();
    setRestaurants(restos);
    goTo('setup');
  }} onBack={() => navigate(-1)} stepIndex={stepIndex} />;

  // ─── STEP: SETUP ────────────────────────────────────────────────────────
  if (step === 'setup') return <StepSetup photo={photo} data={setupData} onChange={setSetupData} restaurants={restaurants}
    onNext={() => { setSaveData(s => ({ ...s, dishName: '', restaurantName: setupData.restaurantName })); goTo('analyzing'); analyzePhoto(); }}
    onBack={() => goTo('capture')} stepIndex={stepIndex} />;

  // ─── STEP: ANALYZING ────────────────────────────────────────────────────
  if (step === 'analyzing') return <StepLoading title="Analyse en cours…" subtitle="L'IA identifie les aliments et ingrédients" emoji="🔍" stepIndex={stepIndex} />;

  // ─── STEP: ITEMS ────────────────────────────────────────────────────────
  if (step === 'items') return <StepItems result={analysisResult} items={detectedItems} setItems={setDetectedItems}
    onNext={() => { setSaveData(s => ({ ...s, dishName: s.dishName || analysisResult?.dish_name || '' })); goTo('options'); }}
    onBack={() => goTo('setup')} stepIndex={stepIndex} />;

  // ─── STEP: OPTIONS ──────────────────────────────────────────────────────
  if (step === 'options') return <StepRecipeOptions options={recipeOptions} onChange={setRecipeOptions}
    onNext={() => { goTo('generating'); generateRecipe(); }}
    onBack={() => goTo('items')} stepIndex={stepIndex} />;

  // ─── STEP: GENERATING ───────────────────────────────────────────────────
  if (step === 'generating') return <StepLoading title="Génération de la recette…" subtitle="L'IA chef rédige votre recette complète" emoji="👨‍🍳" stepIndex={stepIndex} />;

  // ─── STEP: RECIPE ───────────────────────────────────────────────────────
  if (step === 'recipe') return <StepRecipe recipe={recipe} setRecipe={setRecipe}
    onNext={() => goTo('save')} onBack={() => goTo('options')} stepIndex={stepIndex} />;

  // ─── STEP: SAVE ─────────────────────────────────────────────────────────
  if (step === 'save') return <StepSave data={saveData} onChange={setSaveData} photo={photo} recipe={recipe} setupData={setupData} restaurants={restaurants}
    onSave={handleSave} onBack={() => goTo('recipe')} stepIndex={stepIndex} />;

  // ─── INTERNAL FUNCTIONS ─────────────────────────────────────────────────
  async function analyzePhoto() {
    try {
      const base64 = photo.compressed.split(',')[1];
      const mimeType = photo.compressed.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType, context: { restaurantName: setupData.restaurantName, cuisineType: setupData.cuisineType !== 'auto' ? setupData.cuisineType : undefined, mealType: setupData.mealType, portion: setupData.portion } }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Erreur analyse');
      const data = json.data;
      setAnalysisResult(data);
      setDetectedItems(data.ingredients?.map(i => ({ ...i, selected: true })) || []);
      setSaveData(s => ({ ...s, dishName: s.dishName || data.dish_name || '', dishType: guessType(setupData.mealType) }));
      goTo('items');
    } catch (e) {
      setError(e.message);
      toast('Erreur lors de l\'analyse : ' + e.message, 'error');
      goTo('setup');
    }
  }

  async function generateRecipe() {
    try {
      const selected = detectedItems.filter(i => i.selected);
      const res = await fetch('/api/recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dishName: saveData.dishName || analysisResult?.dish_name, ingredients: selected, restaurantName: setupData.restaurantName, cuisineType: setupData.cuisineType !== 'auto' ? setupData.cuisineType : analysisResult?.cuisine_type, options: recipeOptions }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Erreur génération recette');
      setRecipe(json.recipe);
      goTo('recipe');
    } catch (e) {
      setError(e.message);
      toast('Erreur génération : ' + e.message, 'error');
      goTo('options');
    }
  }

  async function handleSave() {
    try {
      let restaurantId = saveData.restaurantId;
      // Create new restaurant if needed
      if (!restaurantId && setupData.restaurantName) {
        let location = null;
        try { location = await getCurrentLocation(); } catch (_) {}
        const newResto = await saveRestaurant({ id: genId(), name: setupData.restaurantName, cuisineType: setupData.cuisineType !== 'auto' ? setupData.cuisineType : '', location, address: '' });
        restaurantId = newResto.id;
      }

      let location = null;
      try { location = await getCurrentLocation(); } catch (_) {}

      const tags = saveData.tags ? saveData.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

      await saveDish({
        id: genId(),
        restaurantId,
        restaurantName: setupData.restaurantName || 'Restaurant inconnu',
        name: saveData.dishName || analysisResult?.dish_name || 'Plat sans nom',
        type: saveData.dishType,
        photo: photo.compressed,
        thumbnailPhoto: photo.thumbnail,
        date: new Date().toISOString().split('T')[0],
        rating: saveData.rating,
        price: saveData.price ? parseFloat(saveData.price) : null,
        notes: saveData.notes,
        tags,
        isFavorite: 0,
        recipe: recipe || null,
        detectedIngredients: detectedItems.filter(i => i.selected).map(i => i.name),
        location,
      });

      toast('Plat sauvegardé avec succès ! 🎉', 'success');
      navigate('/');
    } catch (e) {
      toast('Erreur lors de la sauvegarde : ' + e.message, 'error');
    }
  }
}

function guessType(mealType) {
  if (mealType === 'breakfast') return 'plat';
  return 'plat';
}

// ─── STEP COMPONENTS ─────────────────────────────────────────────────────────

function ProgressBar({ stepIndex }) {
  return (
    <div className="scanner-progress">
      {STEPS.map((s, i) => (
        <div key={s} className={`progress-step ${i < stepIndex ? 'done' : i === stepIndex ? 'active' : ''}`} title={STEP_LABELS[i]} />
      ))}
    </div>
  );
}

// STEP 1: Photo capture
function StepCapture({ onCapture, onBack, stepIndex }) {
  const fileRef = useRef();
  const videoRef = useRef();
  const [preview, setPreview] = useState(null);
  const [mode, setMode] = useState('upload'); // 'upload' | 'camera'
  const [stream, setStream] = useState(null);
  const [capturing, setCapturing] = useState(false);

  async function startCamera() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } });
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;
      setMode('camera');
    } catch {
      fileRef.current?.click();
    }
  }

  function stopCamera() {
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
    setMode('upload');
  }

  function captureFromCamera() {
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setPreview(dataUrl);
    stopCamera();
  }

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <ProgressBar stepIndex={stepIndex} />
      <div className="scanner-step">
        <button className="back-btn" onClick={onBack} style={{ marginBottom: 14 }}>←</button>
        <h2 className="scanner-title">Photographier un plat</h2>
        <p className="scanner-subtitle">Prenez ou choisissez une photo de votre plat</p>

        {mode === 'camera' && !preview ? (
          <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: '#000', marginBottom: 16, position: 'relative' }}>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', display: 'block', aspectRatio: '4/3', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 16 }}>
              <button onClick={stopCamera} className="btn btn-secondary">✕ Annuler</button>
              <button onClick={captureFromCamera} className="btn btn-primary btn-lg" style={{ borderRadius: '50%', width: 64, height: 64, padding: 0, fontSize: '1.5rem' }}>📷</button>
            </div>
          </div>
        ) : preview ? (
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <img src={preview} alt="Aperçu" style={{ width: '100%', borderRadius: 'var(--radius-lg)', aspectRatio: '4/3', objectFit: 'cover' }} />
            <button onClick={() => setPreview(null)} className="btn btn-secondary btn-sm" style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(255,255,255,0.9)' }}>✕ Rechoisir</button>
          </div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <div className="photo-upload-area" onClick={() => fileRef.current?.click()}>
              <div style={{ fontSize: '3rem' }}>📸</div>
              <p style={{ fontWeight: 600, color: 'var(--text-2)' }}>Tap pour choisir une photo</p>
              <p className="text-muted text-sm">JPEG, PNG – max 10 Mo</p>
            </div>
          </div>
        )}

        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {preview ? (
            <button className="btn btn-primary btn-full btn-lg" onClick={() => onCapture(preview)}>
              Analyser ce plat →
            </button>
          ) : (
            <>
              <button className="btn btn-primary btn-full btn-lg" onClick={() => fileRef.current?.click()}>
                📂 Choisir depuis la galerie
              </button>
              <button className="btn btn-secondary btn-full" onClick={startCamera}>
                📷 Utiliser la caméra
              </button>
            </>
          )}
        </div>

        <div style={{ marginTop: 20, padding: 14, background: 'var(--surface-2)', borderRadius: 'var(--radius)', fontSize: '0.82rem', color: 'var(--text-3)' }}>
          <strong style={{ color: 'var(--text-2)' }}>💡 Conseils :</strong> Photo nette, bien éclairée, centrée sur le plat. Évitez les contre-jours.
        </div>
      </div>
    </div>
  );
}

// STEP 2: Context setup
function StepSetup({ photo, data, onChange, restaurants, onNext, onBack, stepIndex }) {
  const CUISINES = ['auto', 'Française', 'Italienne', 'Japonaise', 'Chinoise', 'Mexicaine', 'Indienne', 'Grecque', 'Américaine', 'Libanaise', 'Espagnole', 'Thaïlandaise', 'Marocaine', 'Vietnamienne', 'Coréenne', 'Méditerranéenne', 'Autre'];
  const set = (k) => (v) => onChange({ ...data, [k]: v });

  return (
    <div>
      <ProgressBar stepIndex={stepIndex} />
      <div className="scanner-step">
        <button className="back-btn" onClick={onBack} style={{ marginBottom: 14 }}>←</button>
        <h2 className="scanner-title">Contexte du repas</h2>
        <p className="scanner-subtitle">Ces informations amélioreront la précision de l'analyse</p>

        {photo && <img src={photo.thumbnail} alt="plat" style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 'var(--radius-lg)', marginBottom: 20 }} />}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="label">🏪 Nom du restaurant</label>
            <input className="input" placeholder="ex: Le Petit Bistrot" value={data.restaurantName} onChange={e => set('restaurantName')(e.target.value)} list="resto-list" />
            <datalist id="resto-list">{restaurants.map(r => <option key={r.id} value={r.name} />)}</datalist>
          </div>

          <div className="form-group">
            <label className="label">🌍 Type de cuisine</label>
            <select className="input" value={data.cuisineType} onChange={e => set('cuisineType')(e.target.value)}>
              {CUISINES.map(c => <option key={c} value={c}>{c === 'auto' ? '🤖 Détection automatique' : c}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="label">🕐 Moment du repas</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[['breakfast', '🌅 Petit-déjeuner'], ['lunch', '☀️ Déjeuner'], ['dinner', '🌙 Dîner'], ['snack', '🍪 Collation']].map(([v, l]) => (
                <button key={v} className={`btn ${data.mealType === v ? 'btn-primary' : 'btn-secondary'}`} onClick={() => set('mealType')(v)}>{l}</button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="label">🍽 Portion</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[['individuelle', '👤 Individuelle'], ['à partager', '👥 À partager']].map(([v, l]) => (
                <button key={v} className={`btn ${data.portion === v ? 'btn-primary' : 'btn-secondary'}`} onClick={() => set('portion')(v)}>{l}</button>
              ))}
            </div>
          </div>
        </div>

        <button className="btn btn-primary btn-full btn-lg" style={{ marginTop: 24 }} onClick={onNext}>
          🔍 Analyser le plat
        </button>
      </div>
    </div>
  );
}

// STEP: Loading
function StepLoading({ title, subtitle, emoji, stepIndex }) {
  return (
    <div>
      <ProgressBar stepIndex={stepIndex} />
      <div className="loading-overlay" style={{ minHeight: '60vh' }}>
        <div style={{ fontSize: '4rem', animation: 'pulse 1.5s ease infinite' }}>{emoji}</div>
        <div className="spinner" />
        <div>
          <h3 style={{ marginBottom: 6 }}>{title}</h3>
          <p className="text-muted text-sm">{subtitle}</p>
        </div>
        <p className="text-xs text-muted" style={{ maxWidth: 220, textAlign: 'center' }}>Cela peut prendre quelques secondes…</p>
      </div>
    </div>
  );
}

// STEP 3: Review detected items
function StepItems({ result, items, setItems, onNext, onBack, stepIndex }) {
  const [newItem, setNewItem] = useState('');

  function toggle(idx) {
    setItems(items.map((item, i) => i === idx ? { ...item, selected: !item.selected } : item));
  }

  function remove(idx) {
    setItems(items.filter((_, i) => i !== idx));
  }

  function addItem() {
    if (!newItem.trim()) return;
    setItems([...items, { name: newItem.trim(), estimated_quantity: '', unit: '', role: 'base', confidence: 1, selected: true }]);
    setNewItem('');
  }

  const selected = items.filter(i => i.selected).length;

  return (
    <div>
      <ProgressBar stepIndex={stepIndex} />
      <div className="scanner-step">
        <button className="back-btn" onClick={onBack} style={{ marginBottom: 14 }}>←</button>
        <h2 className="scanner-title">Ingrédients détectés</h2>
        <p className="scanner-subtitle">Vérifiez et modifiez la liste avant de générer la recette</p>

        {result && (
          <div className="card card-padded" style={{ marginBottom: 16, background: 'linear-gradient(135deg, rgba(200,68,26,0.08), rgba(232,160,32,0.08))' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ fontSize: '2rem' }}>🍽</div>
              <div>
                <h3 style={{ marginBottom: 4 }}>{result.dish_name}</h3>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {result.cuisine_type && <span className="badge badge-primary">{result.cuisine_type}</span>}
                  {result.cooking_method && <span className="badge badge-neutral">{result.cooking_method}</span>}
                  {result.temperature && <span className="badge badge-amber">{result.temperature}</span>}
                </div>
                {result.presentation_style && <p className="text-sm text-muted" style={{ marginTop: 4 }}>{result.presentation_style}</p>}
              </div>
            </div>
          </div>
        )}

        {result?.allergens_detected?.length > 0 && (
          <div style={{ background: 'var(--warning-bg)', border: '1px solid #FFB74D', borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginBottom: 12, fontSize: '0.82rem', color: 'var(--warning)' }}>
            ⚠️ Allergènes détectés : {result.allergens_detected.join(', ')}
          </div>
        )}

        <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: 10 }}>
          {selected} ingrédient{selected > 1 ? 's' : ''} sélectionné{selected > 1 ? 's' : ''}
        </p>

        <div className="chips-container" style={{ marginBottom: 16 }}>
          {items.map((item, i) => (
            <div key={i} className={`ingredient-chip ${item.selected ? 'selected' : ''}`} onClick={() => toggle(i)}>
              <span>{item.name}</span>
              {item.estimated_quantity && <span className="text-muted text-xs">({item.estimated_quantity}{item.unit ? ' ' + item.unit : ''})</span>}
              {ROLE_EMOJI[item.role] && <span>{ROLE_EMOJI[item.role]}</span>}
              <button onClick={(e) => { e.stopPropagation(); remove(i); }} style={{ marginLeft: 2, color: 'var(--text-3)', fontSize: '0.9rem' }}>✕</button>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <input className="input" placeholder="Ajouter un ingrédient…" value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => e.key === 'Enter' && addItem()} style={{ flex: 1 }} />
          <button className="btn btn-primary" onClick={addItem}>+</button>
        </div>

        {result?.texture_notes && <p className="text-sm text-muted" style={{ marginBottom: 16 }}>🎨 {result.texture_notes}</p>}

        <button className="btn btn-primary btn-full btn-lg" onClick={onNext} disabled={selected === 0}>
          Options de recette →
        </button>
        <button className="btn btn-ghost btn-full" style={{ marginTop: 8 }} onClick={onNext}>
          Passer les options (recette rapide)
        </button>
      </div>
    </div>
  );
}

const ROLE_EMOJI = { base: '', garnish: '🌿', sauce: '🍯', decoration: '✨' };

// STEP 4: Recipe options
function StepRecipeOptions({ options, onChange, onNext, onBack, stepIndex }) {
  const set = (k) => (v) => onChange({ ...options, [k]: v });
  const toggle = (k) => () => onChange({ ...options, [k]: !options[k] });
  const toggleArr = (k, v) => () => {
    const arr = options[k] || [];
    onChange({ ...options, [k]: arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v] });
  };

  const DIETARY = ['Végétarien', 'Vegan', 'Sans gluten', 'Sans lactose', 'Halal', 'Casher', 'Sans noix', 'Sans fruits de mer'];

  return (
    <div>
      <ProgressBar stepIndex={stepIndex} />
      <div className="scanner-step">
        <button className="back-btn" onClick={onBack} style={{ marginBottom: 14 }}>←</button>
        <h2 className="scanner-title">Options de la recette</h2>
        <p className="scanner-subtitle">Personnalisez la recette générée par l'IA</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Language */}
          <div className="form-group">
            <label className="label">🌐 Langue de la recette</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
              {[['fr', '🇫🇷 FR'], ['en', '🇬🇧 EN'], ['es', '🇪🇸 ES'], ['it', '🇮🇹 IT'], ['de', '🇩🇪 DE']].map(([v, l]) => (
                <button key={v} className={`btn btn-sm ${options.language === v ? 'btn-primary' : 'btn-secondary'}`} onClick={() => set('language')(v)}>{l}</button>
              ))}
            </div>
          </div>

          {/* Detail level */}
          <div className="form-group">
            <label className="label">📋 Niveau de détail</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[['simple', '🟢 Simple'], ['detailed', '🔵 Détaillé'], ['professional', '⭐ Pro']].map(([v, l]) => (
                <button key={v} className={`btn ${options.detailLevel === v ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: '0.78rem' }} onClick={() => set('detailLevel')(v)}>{l}</button>
              ))}
            </div>
          </div>

          {/* Cooking skill */}
          <div className="form-group">
            <label className="label">👨‍🍳 Niveau du cuisinier</label>
            <select className="input" value={options.cookingSkillLevel} onChange={e => set('cookingSkillLevel')(e.target.value)}>
              <option value="beginner">🌱 Débutant</option>
              <option value="intermediate">🔪 Intermédiaire</option>
              <option value="advanced">⭐ Avancé</option>
              <option value="professional">👨‍🍳 Professionnel</option>
            </select>
          </div>

          {/* Servings */}
          <div className="form-group">
            <label className="label">👥 Nombre de portions : {options.servings}</label>
            <input type="range" min={1} max={12} value={options.servings} onChange={e => set('servings')(parseInt(e.target.value))} style={{ width: '100%', accentColor: 'var(--primary)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-3)' }}>
              <span>1 pers.</span><span>6 pers.</span><span>12 pers.</span>
            </div>
          </div>

          {/* Dietary restrictions */}
          <div className="form-group">
            <label className="label">🥗 Restrictions alimentaires</label>
            <div className="chips-container">
              {DIETARY.map(d => (
                <button key={d} className={`ingredient-chip ${options.dietaryRestrictions?.includes(d) ? 'selected' : ''}`} onClick={toggleArr('dietaryRestrictions', d)}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Optional sections */}
          <div className="card card-padded">
            <h4 style={{ marginBottom: 12 }}>📦 Sections à inclure</h4>
            {[
              ['includeNutrition', '🥗 Valeurs nutritionnelles'],
              ['includeWine', '🍷 Accord mets-vins'],
              ['includeChefTips', '👨‍🍳 Astuces du chef'],
              ['includePlating', '🎨 Conseils de dressage'],
              ['includeVariations', '🔄 Variantes de la recette'],
              ['includeHistory', '📖 Histoire du plat'],
              ['includeEquipment', '🔪 Matériel nécessaire'],
            ].map(([k, label]) => (
              <div key={k} className="option-toggle">
                <span style={{ fontSize: '0.9rem' }}>{label}</span>
                <div className={`toggle ${options[k] ? 'on' : ''}`} onClick={toggle(k)} role="switch" aria-checked={options[k]} />
              </div>
            ))}
          </div>
        </div>

        <button className="btn btn-primary btn-full btn-lg" style={{ marginTop: 20 }} onClick={onNext}>
          👨‍🍳 Générer la recette
        </button>
      </div>
    </div>
  );
}

// STEP 5: Recipe review
function StepRecipe({ recipe, setRecipe, onNext, onBack, stepIndex }) {
  if (!recipe) return <div className="empty-state"><p>Aucune recette générée</p><button className="btn btn-secondary" onClick={onBack}>← Retour</button></div>;

  return (
    <div>
      <ProgressBar stepIndex={stepIndex} />
      <div className="scanner-step">
        <button className="back-btn" onClick={onBack} style={{ marginBottom: 14 }}>←</button>
        <h2 className="scanner-title">Recette générée</h2>
        <p className="scanner-subtitle">Vérifiez et modifiez si nécessaire avant de sauvegarder</p>

        {/* Header */}
        <div className="card card-padded" style={{ marginBottom: 14, background: 'linear-gradient(135deg, #FFF8F3, #FFF3E0)' }}>
          <h3 className="serif" style={{ fontSize: '1.3rem', marginBottom: 6 }}>{recipe.title}</h3>
          {recipe.subtitle && <p className="text-sm text-muted" style={{ fontStyle: 'italic', marginBottom: 10 }}>{recipe.subtitle}</p>}
          {recipe.description && <p className="text-sm" style={{ color: 'var(--text-2)', marginBottom: 12 }}>{recipe.description}</p>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {recipe.prep_time && <span className="badge badge-neutral">⏱ Prep: {recipe.prep_time}</span>}
            {recipe.cook_time && <span className="badge badge-neutral">🍳 Cuisson: {recipe.cook_time}</span>}
            {recipe.difficulty && <DifficultyBadge level={recipe.difficulty} />}
            {recipe.servings && <span className="badge badge-amber">👥 {recipe.servings} pers.</span>}
            {recipe.cost_per_serving && <span className="badge badge-neutral">💶 {recipe.cost_per_serving}</span>}
          </div>
        </div>

        {/* Tags */}
        {recipe.tags?.length > 0 && (
          <div className="chips-container" style={{ marginBottom: 14 }}>
            {recipe.tags.map((t, i) => <span key={i} className="badge badge-primary">{t}</span>)}
          </div>
        )}

        {/* Equipment */}
        {recipe.equipment?.length > 0 && (
          <RecipeSection emoji="🔪" title="Matériel">
            <div className="chips-container">{recipe.equipment.map((e, i) => <span key={i} className="ingredient-chip">{e}</span>)}</div>
          </RecipeSection>
        )}

        {/* Ingredients */}
        {recipe.ingredients?.length > 0 && (
          <RecipeSection emoji="🥬" title="Ingrédients">
            {recipe.ingredients.map((ing, i) => (
              <div key={i} className="ingredient-row">
                <span className="ingredient-qty">{ing.quantity ? `${ing.quantity} ${ing.unit || ''}` : '—'}</span>
                <span className="ingredient-name">{ing.name}{ing.optional && <span className="text-muted text-xs"> (optionnel)</span>}</span>
                {ing.notes && <span className="ingredient-note">{ing.notes}</span>}
              </div>
            ))}
          </RecipeSection>
        )}

        {/* Steps */}
        {recipe.steps?.length > 0 && (
          <RecipeSection emoji="📋" title="Préparation">
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
          </RecipeSection>
        )}

        {/* Nutrition */}
        {recipe.nutritional_info && (
          <RecipeSection emoji="🥗" title="Valeurs nutritionnelles (par portion)">
            <div className="nutrition-grid">
              {Object.entries({ 'Calories': recipe.nutritional_info.calories_per_serving, 'Protéines': recipe.nutritional_info.protein, 'Glucides': recipe.nutritional_info.carbohydrates, 'Lipides': recipe.nutritional_info.fat }).map(([k, v]) => v && (
                <div key={k} className="nutrition-item">
                  <div className="nutrition-value">{v}</div>
                  <div className="nutrition-label">{k}</div>
                </div>
              ))}
            </div>
          </RecipeSection>
        )}

        {/* Wine */}
        {recipe.wine_pairing && (
          <RecipeSection emoji="🍷" title="Accord mets-vins">
            <p style={{ fontWeight: 600, marginBottom: 4 }}>{recipe.wine_pairing.wine}</p>
            {recipe.wine_pairing.appellation && <p className="text-sm text-muted">{recipe.wine_pairing.appellation}</p>}
            {recipe.wine_pairing.serving_temperature && <span className="badge badge-neutral" style={{ marginTop: 6 }}>🌡 {recipe.wine_pairing.serving_temperature}</span>}
            {recipe.wine_pairing.description && <p className="text-sm" style={{ marginTop: 8, color: 'var(--text-2)' }}>{recipe.wine_pairing.description}</p>}
          </RecipeSection>
        )}

        {/* Chef Tips */}
        {recipe.chef_tips?.length > 0 && (
          <RecipeSection emoji="👨‍🍳" title="Astuces du chef">
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recipe.chef_tips.map((tip, i) => <li key={i} style={{ display: 'flex', gap: 8, fontSize: '0.88rem' }}><span>💡</span><span>{tip}</span></li>)}
            </ul>
          </RecipeSection>
        )}

        {/* Plating */}
        {recipe.plating_tips && (
          <RecipeSection emoji="🎨" title="Dressage">
            <p style={{ fontSize: '0.9rem', color: 'var(--text-2)', lineHeight: 1.6 }}>{recipe.plating_tips}</p>
          </RecipeSection>
        )}

        {/* History */}
        {recipe.history && (
          <RecipeSection emoji="📖" title="Histoire du plat">
            <p style={{ fontSize: '0.9rem', color: 'var(--text-2)', lineHeight: 1.6 }}>{recipe.history}</p>
          </RecipeSection>
        )}

        {/* Variations */}
        {recipe.variations?.length > 0 && (
          <RecipeSection emoji="🔄" title="Variantes">
            {recipe.variations.map((v, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <strong style={{ fontSize: '0.9rem' }}>{v.name}</strong>
                <p className="text-sm text-muted">{v.description}</p>
              </div>
            ))}
          </RecipeSection>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onBack}>← Régénérer</button>
          <button className="btn btn-primary" style={{ flex: 2 }} onClick={onNext}>Sauvegarder → </button>
        </div>
      </div>
    </div>
  );
}

function RecipeSection({ emoji, title, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="recipe-section">
      <div className="recipe-section-title" onClick={() => setOpen(!open)} style={{ cursor: 'pointer', userSelect: 'none' }}>
        <span>{emoji}</span><span style={{ flex: 1 }}>{title}</span><span style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && children}
    </div>
  );
}

function DifficultyBadge({ level }) {
  const map = { easy: ['🟢', 'Facile', 'badge-success'], medium: ['🔵', 'Moyen', 'badge-primary'], hard: ['🟠', 'Difficile', 'badge-amber'], professional: ['⭐', 'Pro', 'badge-primary'] };
  const [emoji, label, cls] = map[level] || ['', level, 'badge-neutral'];
  return <span className={`badge ${cls}`}>{emoji} {label}</span>;
}

// STEP 6: Save
function StepSave({ data, onChange, photo, recipe, setupData, restaurants, onSave, onBack, stepIndex }) {
  const set = (k) => (v) => onChange({ ...data, [k]: v });
  const [saving, setSaving] = useState(false);

  const TYPES = [['entree', '🥗 Entrée'], ['plat', '🍽 Plat'], ['dessert', '🍮 Dessert'], ['boisson', '🥤 Boisson'], ['autre', '🍴 Autre']];

  async function doSave() {
    setSaving(true);
    await onSave();
    setSaving(false);
  }

  return (
    <div>
      <ProgressBar stepIndex={stepIndex} />
      <div className="scanner-step">
        <button className="back-btn" onClick={onBack} style={{ marginBottom: 14 }}>←</button>
        <h2 className="scanner-title">Sauvegarder le plat</h2>
        <p className="scanner-subtitle">Derniers détails avant d'ajouter à votre journal</p>

        {photo && <img src={photo.thumbnail} style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 'var(--radius-lg)', marginBottom: 20 }} alt="plat" />}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="label">🏷 Nom du plat *</label>
            <input className="input" value={data.dishName} onChange={e => set('dishName')(e.target.value)} placeholder={recipe?.title || 'Nom du plat'} />
          </div>

          <div className="form-group">
            <label className="label">📂 Catégorie</label>
            <div className="pill-group">
              {TYPES.map(([v, l]) => <button key={v} className={`pill ${data.dishType === v ? 'active' : ''}`} onClick={() => set('dishType')(v)}>{l}</button>)}
            </div>
          </div>

          <div className="form-group">
            <label className="label">⭐ Note</label>
            <StarRating value={data.rating} onChange={set('rating')} size="1.6rem" />
          </div>

          <div className="form-group">
            <label className="label">🏪 Restaurant</label>
            <input className="input" value={setupData.restaurantName} readOnly style={{ opacity: 0.7 }} />
            {restaurants.find(r => r.name === setupData.restaurantName) && (
              <select className="input" style={{ marginTop: 6 }} onChange={e => set('restaurantId')(e.target.value)}>
                <option value="">Créer un nouveau restaurant</option>
                {restaurants.filter(r => r.name === setupData.restaurantName).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            )}
          </div>

          <div className="form-group">
            <label className="label">💶 Prix (€)</label>
            <input className="input" type="number" min="0" step="0.5" placeholder="ex: 18.50" value={data.price} onChange={e => set('price')(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="label">🏷 Tags (séparés par des virgules)</label>
            <input className="input" placeholder="ex: signature, truffe, veggie" value={data.tags} onChange={e => set('tags')(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="label">📝 Notes personnelles</label>
            <textarea className="input" rows={3} placeholder="Vos impressions, ce que vous avez aimé…" value={data.notes} onChange={e => set('notes')(e.target.value)} />
          </div>

          {recipe && (
            <div style={{ padding: 12, background: 'var(--success-bg)', borderRadius: 'var(--radius-sm)', display: 'flex', gap: 8, fontSize: '0.85rem', color: 'var(--success)' }}>
              <span>✓</span><span>Recette complète attachée ({recipe.steps?.length || 0} étapes)</span>
            </div>
          )}
        </div>

        <button className="btn btn-primary btn-full btn-lg" style={{ marginTop: 24 }} onClick={doSave} disabled={saving}>
          {saving ? '⏳ Sauvegarde…' : '💾 Ajouter à mon journal'}
        </button>
      </div>
    </div>
  );
}
