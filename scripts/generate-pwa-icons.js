import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const srcImage = path.resolve('public/branding/logo-zuhaia-trimmed.png');

async function generate() {
  console.log('Generating PWA icons from', srcImage);

  // 1. Apple Touch Icon 180x180 (solid white/light background for iOS)
  await sharp(srcImage)
    .resize(150, 150, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .extend({
      top: 15,
      bottom: 15,
      left: 15,
      right: 15,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    })
    .png()
    .toFile('public/apple-touch-icon.png');
  console.log('✓ Created public/apple-touch-icon.png');

  // 2. Standard 192x192
  await sharp(srcImage)
    .resize(170, 170, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .extend({
      top: 11,
      bottom: 11,
      left: 11,
      right: 11,
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    })
    .png()
    .toFile('public/pwa-192x192.png');
  console.log('✓ Created public/pwa-192x192.png');

  // 3. Standard 512x512
  await sharp(srcImage)
    .resize(460, 460, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .extend({
      top: 26,
      bottom: 26,
      left: 26,
      right: 26,
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    })
    .png()
    .toFile('public/pwa-512x512.png');
  console.log('✓ Created public/pwa-512x512.png');

  // 4. Maskable 512x512 (Safe-zone 80% circle with solid brand #042f2e / white background)
  await sharp(srcImage)
    .resize(380, 380, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .extend({
      top: 66,
      bottom: 66,
      left: 66,
      right: 66,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    })
    .png()
    .toFile('public/pwa-maskable-512x512.png');
  console.log('✓ Created public/pwa-maskable-512x512.png');

  // 5. Favicon 64x64
  await sharp(srcImage)
    .resize(64, 64, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile('public/favicon.ico');
  console.log('✓ Created public/favicon.ico');
}

generate().catch(console.error);
