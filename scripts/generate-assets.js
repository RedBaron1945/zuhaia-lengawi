import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function generateAssets() {
  const sourceLogoPath = path.resolve('public/branding/logo-zuhaia-transparent.png');
  if (!fs.existsSync(sourceLogoPath)) {
    console.error('Source logo does not exist at:', sourceLogoPath);
    process.exit(1);
  }

  console.log('Generating PWA & Social Media assets from official mosque logo...');

  // 1. Generate pwa-512x512.png (purpose: "any")
  // Canvas: 512x512 white background
  // Logo resized proportionally (fit: 'contain') into 430x430, centered
  const logoFor512 = await sharp(sourceLogoPath)
    .resize(420, 420, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: logoFor512, gravity: 'center' }])
    .png({ quality: 100, compressionLevel: 9 })
    .toFile('public/pwa-512x512.png');
  console.log('✓ Created public/pwa-512x512.png');

  // 2. Generate pwa-maskable-512x512.png (purpose: "maskable")
  // Android safe zone is center circle of 80% diameter (~400px).
  // Logo resized proportionally (fit: 'contain') into 340x340, centered
  const logoForMaskable = await sharp(sourceLogoPath)
    .resize(340, 340, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: logoForMaskable, gravity: 'center' }])
    .png({ quality: 100, compressionLevel: 9 })
    .toFile('public/pwa-maskable-512x512.png');
  console.log('✓ Created public/pwa-maskable-512x512.png (with safe-zone margins)');

  // 3. Generate pwa-192x192.png
  const logoFor192 = await sharp(sourceLogoPath)
    .resize(160, 160, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: 192,
      height: 192,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: logoFor192, gravity: 'center' }])
    .png({ quality: 100, compressionLevel: 9 })
    .toFile('public/pwa-192x192.png');
  console.log('✓ Created public/pwa-192x192.png');

  // 4. Generate apple-touch-icon.png (180x180 solid background for iOS)
  const logoForApple = await sharp(sourceLogoPath)
    .resize(150, 150, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: 180,
      height: 180,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: logoForApple, gravity: 'center' }])
    .png({ quality: 100, compressionLevel: 9 })
    .toFile('public/apple-touch-icon.png');
  console.log('✓ Created public/apple-touch-icon.png');

  // 5. Generate Favicons (32x32, 16x16)
  const logoFor32 = await sharp(sourceLogoPath)
    .resize(28, 28, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: 32,
      height: 32,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: logoFor32, gravity: 'center' }])
    .png()
    .toFile('public/favicon-32x32.png');

  // 6. Generate WhatsApp & Social Sharing OpenGraph Card (1200x630)
  // WhatsApp requires < 300KB file size, 1200x630 aspect ratio
  // Design: Rich Islamic emerald/teal background with golden accents, official mosque logo, title and description
  const logoForOg = await sharp(sourceLogoPath)
    .resize(340, 340, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .toBuffer();

  // Create an SVG banner layout with text and styling
  const svgOverlay = `
    <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGrad" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#042f2e"/>
          <stop offset="50%" stop-color="#064e45"/>
          <stop offset="100%" stop-color="#0a584f"/>
        </linearGradient>
        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fef08a"/>
          <stop offset="50%" stop-color="#facc15"/>
          <stop offset="100%" stop-color="#ca8a04"/>
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#000000" flood-opacity="0.35"/>
        </filter>
        <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="60" result="blur"/>
        </filter>
      </defs>

      <!-- Main Background -->
      <rect width="1200" height="630" fill="url(#bgGrad)"/>

      <!-- Decorative ambient glows -->
      <circle cx="200" cy="150" r="180" fill="#0d9488" opacity="0.22" filter="url(#softGlow)"/>
      <circle cx="1050" cy="500" r="220" fill="#ca8a04" opacity="0.18" filter="url(#softGlow)"/>

      <!-- Elegant Outer Border -->
      <rect x="24" y="24" width="1152" height="582" rx="32" fill="none" stroke="#2dd4bf" stroke-opacity="0.25" stroke-width="2"/>
      <rect x="34" y="34" width="1132" height="562" rx="24" fill="none" stroke="#facc15" stroke-opacity="0.2" stroke-width="1.2"/>

      <!-- Mosque Logo Card Container on the Right -->
      <rect x="740" y="95" width="410" height="440" rx="36" fill="#ffffff" filter="url(#shadow)"/>
      <rect x="740" y="95" width="410" height="440" rx="36" fill="none" stroke="#fef08a" stroke-width="3" stroke-opacity="0.6"/>

      <!-- Text Section on the Left (RTL Arabic Layout) -->
      <!-- Top Pill Tag -->
      <g transform="translate(670, 130)">
        <rect x="-360" y="0" width="360" height="46" rx="23" fill="#ffffff" fill-opacity="0.12" stroke="#2dd4bf" stroke-width="1.5"/>
        <text x="-180" y="30" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="bold" fill="#fef08a" text-anchor="middle" direction="rtl">
          ✨ منظومة الحلقات القرآنية المعتمدة
        </text>
      </g>

      <!-- Main Title -->
      <text x="670" y="260" font-family="system-ui, -apple-system, sans-serif" font-size="56" font-weight="900" fill="#ffffff" text-anchor="end" direction="rtl">
        حلقات مسجد زهية لنجاوي
      </text>

      <!-- Subtitle -->
      <text x="670" y="325" font-family="system-ui, -apple-system, sans-serif" font-size="30" font-weight="700" fill="#a7f3d0" text-anchor="end" direction="rtl">
        تحفيز الطلاب
      </text>

      <!-- Description Line 1 -->
      <text x="670" y="390" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="500" fill="#e2e8f0" text-anchor="end" direction="rtl">
        متابعة يومية للحفظ والمراجعة والانضباط
      </text>
      <!-- Description Line 2 -->
      <text x="670" y="425" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="500" fill="#cbd5e1" text-anchor="end" direction="rtl">
        نظام تحفيز بالنقاط والمكافآت التفاعلية للطلاب
      </text>

      <!-- Bottom Feature Badges -->
      <g transform="translate(670, 480)">
        <rect x="-240" y="0" width="240" height="44" rx="14" fill="#0f766e" fill-opacity="0.6" stroke="#2dd4bf" stroke-width="1.2"/>
        <text x="-120" y="28" font-family="system-ui, -apple-system, sans-serif" font-size="17" font-weight="bold" fill="#ffffff" text-anchor="middle" direction="rtl">
          📖 9 حلقات معتمدة
        </text>

        <rect x="-500" y="0" width="245" height="44" rx="14" fill="#0f766e" fill-opacity="0.6" stroke="#2dd4bf" stroke-width="1.2"/>
        <text x="-377" y="28" font-family="system-ui, -apple-system, sans-serif" font-size="17" font-weight="bold" fill="#ffffff" text-anchor="middle" direction="rtl">
          ⭐ رصيد تراكمي وتكريم
        </text>
      </g>
    </svg>
  `;

  // Composite the SVG card and the official logo
  await sharp(Buffer.from(svgOverlay))
    .composite([
      {
        input: logoForOg,
        top: 145,
        left: 775,
      },
    ])
    .png({ quality: 90, compressionLevel: 8 })
    .toFile('public/og-image.png');
  console.log('✓ Created public/og-image.png (1200x630 WhatsApp OpenGraph Card)');

  // 7. Generate og-image-square.png (600x600 for WhatsApp square preview)
  const squareSvg = `
    <svg width="600" height="600" viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sqGrad" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#042f2e"/>
          <stop offset="100%" stop-color="#0a584f"/>
        </linearGradient>
      </defs>
      <rect width="600" height="600" fill="url(#sqGrad)"/>
      <rect x="16" y="16" width="568" height="568" rx="36" fill="none" stroke="#2dd4bf" stroke-opacity="0.3" stroke-width="2"/>
      <rect x="60" y="50" width="480" height="430" rx="32" fill="#ffffff"/>
      <text x="300" y="530" font-family="system-ui, -apple-system, sans-serif" font-size="30" font-weight="900" fill="#ffffff" text-anchor="middle" direction="rtl">
        حلقات مسجد زهية لنجاوي
      </text>
      <text x="300" y="565" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="bold" fill="#a7f3d0" text-anchor="middle" direction="rtl">
        تحفيز الطلاب
      </text>
    </svg>
  `;

  const squareLogo = await sharp(sourceLogoPath)
    .resize(360, 360, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .toBuffer();

  await sharp(Buffer.from(squareSvg))
    .composite([
      {
        input: squareLogo,
        top: 85,
        left: 120,
      },
    ])
    .png({ quality: 90, compressionLevel: 8 })
    .toFile('public/og-image-square.png');
  console.log('✓ Created public/og-image-square.png (600x600 square preview)');

  console.log('All assets successfully generated!');
}

generateAssets().catch((err) => {
  console.error('Error generating assets:', err);
  process.exit(1);
});
