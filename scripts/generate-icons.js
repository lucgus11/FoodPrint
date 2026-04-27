import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public', 'icons');
mkdirSync(publicDir, { recursive: true });

// SVG source for the icon (fork + plate motif)
const iconSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="0" fill="#C8441A"/>
  <circle cx="256" cy="230" r="110" fill="none" stroke="white" stroke-width="14" opacity="0.9"/>
  <circle cx="256" cy="230" r="80" fill="none" stroke="white" stroke-width="6" opacity="0.4"/>
  <rect x="249" y="120" width="14" height="220" rx="7" fill="white" opacity="0.9"/>
  <rect x="196" y="120" width="12" height="90" rx="6" fill="white" opacity="0.85"/>
  <rect x="196" y="200" width="65" height="10" rx="5" fill="white" opacity="0.85"/>
  <rect x="304" y="120" width="12" height="90" rx="6" fill="white" opacity="0.85"/>
  <path d="M304 120 Q330 155 310 200 L304 200 Z" fill="white" opacity="0.7"/>
  <rect x="304" y="200" width="12" height="140" rx="6" fill="white" opacity="0.85"/>
  <text x="256" y="420" font-family="serif" font-size="68" font-weight="bold" fill="white" text-anchor="middle" opacity="0.95">FP</text>
</svg>`;

// Maskable SVG (with safe zone padding ~10%)
const maskableSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#C8441A"/>
  <circle cx="256" cy="230" r="95" fill="none" stroke="white" stroke-width="12" opacity="0.9"/>
  <circle cx="256" cy="230" r="68" fill="none" stroke="white" stroke-width="5" opacity="0.4"/>
  <rect x="250" y="135" width="12" height="190" rx="6" fill="white" opacity="0.9"/>
  <rect x="200" y="135" width="10" height="78" rx="5" fill="white" opacity="0.85"/>
  <rect x="200" y="205" width="62" height="8" rx="4" fill="white" opacity="0.85"/>
  <rect x="302" y="135" width="10" height="78" rx="5" fill="white" opacity="0.85"/>
  <path d="M302 135 Q325 165 308 205 L302 205 Z" fill="white" opacity="0.7"/>
  <rect x="302" y="205" width="10" height="120" rx="5" fill="white" opacity="0.85"/>
  <text x="256" y="400" font-family="serif" font-size="58" font-weight="bold" fill="white" text-anchor="middle" opacity="0.95">FP</text>
</svg>`;

const svgBuffer = Buffer.from(iconSVG);
const maskableBuffer = Buffer.from(maskableSVG);

const sizes = [192, 512];

async function generate() {
  for (const size of sizes) {
    await sharp(svgBuffer).resize(size, size).png().toFile(join(publicDir, `icon-${size}.png`));
    console.log(`✓ icon-${size}.png`);

    await sharp(maskableBuffer).resize(size, size).png().toFile(join(publicDir, `icon-maskable-${size}.png`));
    console.log(`✓ icon-maskable-${size}.png`);
  }

  // Also write the SVG source for reference
  writeFileSync(join(publicDir, 'icon.svg'), iconSVG);
  console.log('✓ icon.svg');
  console.log('\n🎉 Icons generated successfully!');
}

generate().catch(console.error);
