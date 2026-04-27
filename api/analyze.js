// api/analyze.js — Vercel Serverless Function
// Analyse une image de plat via Groq Vision (llama-3.2-11b-vision)
// Fallback sur LogMeal API si LOGMEAL_API_KEY est défini

export const config = { runtime: 'edge' };

const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const LOGMEAL_API = 'https://api.logmeal.com/v2/image/segmentation/complete';

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }

  const { imageBase64, mimeType = 'image/jpeg', context = {} } = body;

  if (!imageBase64) {
    return new Response(JSON.stringify({ error: 'imageBase64 required' }), { status: 400 });
  }

  const { restaurantName, cuisineType, mealType, portion } = context;

  // ─── LOGMEAL (optionnel, plus précis côté nutrition) ─────────────────────
  let logmealData = null;
  if (process.env.LOGMEAL_API_KEY) {
    try {
      const imageBlob = base64ToBlob(imageBase64, mimeType);
      const form = new FormData();
      form.append('image', imageBlob, 'dish.jpg');

      const lmRes = await fetch(LOGMEAL_API, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.LOGMEAL_API_KEY}` },
        body: form,
      });

      if (lmRes.ok) {
        logmealData = await lmRes.json();
      }
    } catch (_) {
      // LogMeal failure is non-fatal
    }
  }

  // ─── GROQ VISION ─────────────────────────────────────────────────────────
  const contextHint = [
    restaurantName && `Restaurant : ${restaurantName}`,
    cuisineType && cuisineType !== 'auto' && `Cuisine : ${cuisineType}`,
    mealType && `Repas : ${mealType}`,
    portion && `Portion : ${portion}`,
    logmealData && `Données LogMeal détectées : ${JSON.stringify(logmealData?.foodName || [])}`,
  ]
    .filter(Boolean)
    .join('\n');

  const prompt = `Tu es un chef expert en gastronomie mondiale. Analyse cette photo de plat avec précision.
${contextHint ? '\nContexte fourni :\n' + contextHint : ''}

Retourne UNIQUEMENT un objet JSON valide (sans markdown, sans texte) avec cette structure exacte :
{
  "is_food": true,
  "dish_name": "Nom précis du plat",
  "cuisine_type": "Type de cuisine (ex: Française, Italienne, Japonaise...)",
  "cooking_method": "Méthode de cuisson principale (ex: grillé, rôti, poché...)",
  "presentation_style": "Description du dressage (ex: gastronomique, familial, bistrot...)",
  "confidence": 0.95,
  "estimated_difficulty": "easy|medium|hard|professional",
  "ingredients": [
    { "name": "Nom de l'ingrédient", "estimated_quantity": "quantité estimée", "unit": "unité", "role": "base|garnish|sauce|decoration", "confidence": 0.9 }
  ],
  "allergens_detected": ["gluten", "lactose", ...],
  "temperature": "chaud|froid|tiède",
  "texture_notes": "Description des textures visibles",
  "color_profile": "Description des couleurs dominantes du plat",
  "portion_size": "individuelle|à partager",
  "visual_quality_score": 8.5,
  "suggested_pairings": ["Vin rouge léger", "Eau pétillante"],
  "notes": "Observations supplémentaires sur le plat"
}`;

  try {
    const groqRes = await fetch(GROQ_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        max_tokens: 1500,
        temperature: 0.2,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
              { type: 'text', text: prompt },
            ],
          },
        ],
      }),
    });

    if (!groqRes.ok) {
      const err = await groqRes.text();
      throw new Error(`Groq error ${groqRes.status}: ${err}`);
    }

    const groqData = await groqRes.json();
    const rawText = groqData.choices?.[0]?.message?.content || '{}';
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    // Merge LogMeal nutritional data if available
    if (logmealData?.nutritional_info) {
      parsed.logmeal_nutrition = logmealData.nutritional_info;
    }

    return new Response(JSON.stringify({ success: true, source: 'groq-vision', data: parsed }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

function base64ToBlob(base64, mimeType) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}
