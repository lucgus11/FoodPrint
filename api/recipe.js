// api/recipe.js — Vercel Serverless Function
// Génère une recette complète via Groq (llama-3.3-70b-versatile)

export const config = { runtime: 'edge' };

const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }

  const {
    dishName,
    ingredients = [],
    restaurantName,
    cuisineType,
    options = {},
  } = body;

  const {
    language = 'fr',
    detailLevel = 'detailed',
    servings = 2,
    includeNutrition = true,
    includeWine = true,
    includeChefTips = true,
    includePlating = true,
    includeHistory = false,
    includeVariations = true,
    includeEquipment = true,
    dietaryRestrictions = [],
    cookingSkillLevel = 'intermediate',
  } = options;

  const langMap = { fr: 'français', en: 'English', es: 'español', it: 'italiano', de: 'Deutsch' };
  const langLabel = langMap[language] || 'français';

  const detailMap = {
    simple: 'simple et concise pour un cuisinier débutant',
    detailed: 'détaillée et professionnelle pour un cuisinier intermédiaire',
    professional: 'très technique et exhaustive comme dans un livre de cuisine étoilé',
  };

  const optionalSections = [
    includeNutrition && '"nutritional_info": {"calories_per_serving": "kcal", "protein": "g", "carbohydrates": "g", "fat": "g", "fiber": "g", "sodium": "mg"}',
    includeWine && '"wine_pairing": {"wine": "Nom du vin", "appellation": "Appellation", "serving_temperature": "température", "description": "pourquoi ce vin"}',
    includeChefTips && '"chef_tips": ["astuce 1", "astuce 2", "astuce 3"]',
    includePlating && '"plating_tips": "Description détaillée du dressage"',
    includeHistory && '"history": "Histoire et origine du plat"',
    includeVariations && '"variations": [{"name": "Nom variante", "description": "Description"}]',
    includeEquipment && '"equipment": ["Ustensile 1", "Ustensile 2"]',
  ]
    .filter(Boolean)
    .join(',\n  ');

  const prompt = `Tu es un chef étoilé. Génère une recette ${detailMap[detailLevel]} en ${langLabel}.

Plat : ${dishName}
${restaurantName ? `Restaurant : ${restaurantName}` : ''}
${cuisineType ? `Cuisine : ${cuisineType}` : ''}
Ingrédients détectés : ${ingredients.map((i) => `${i.name}${i.estimated_quantity ? ` (${i.estimated_quantity} ${i.unit || ''})` : ''}`).join(', ')}
Portions : ${servings} personnes
Niveau du cuisinier : ${cookingSkillLevel}
${dietaryRestrictions.length ? `Restrictions alimentaires : ${dietaryRestrictions.join(', ')}` : ''}

Retourne UNIQUEMENT un JSON valide (sans markdown) avec cette structure :
{
  "title": "Titre officiel du plat",
  "subtitle": "Sous-titre poétique",
  "description": "Description appétissante du plat (2-3 phrases)",
  "cuisine_type": "Type de cuisine",
  "difficulty": "easy|medium|hard|professional",
  "prep_time": "X min",
  "cook_time": "X min",
  "rest_time": "X min ou null",
  "total_time": "X min",
  "servings": ${servings},
  "cost_per_serving": "€|€€|€€€",
  "tags": ["tag1", "tag2"],
  "ingredients": [
    {
      "name": "Ingrédient",
      "quantity": 100,
      "unit": "g",
      "notes": "précision (ex: finement émincé)",
      "optional": false,
      "substitutes": ["substitut possible"]
    }
  ],
  "steps": [
    {
      "step": 1,
      "title": "Titre de l'étape",
      "description": "Instructions précises et détaillées",
      "duration": "X min",
      "temperature": "°C si applicable",
      "tips": "Conseil pour cette étape"
    }
  ],
  ${optionalSections}
}`;

  try {
    const groqRes = await fetch(GROQ_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 4000,
        temperature: 0.4,
        messages: [{ role: 'user', content: prompt }],
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

    return new Response(JSON.stringify({ success: true, recipe: parsed }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
