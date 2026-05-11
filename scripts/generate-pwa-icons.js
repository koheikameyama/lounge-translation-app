import sharp from 'sharp';
import { readFileSync } from 'fs';

const svgBuffer = readFileSync('public/icon.svg');

// Generate 192x192
await sharp(svgBuffer)
  .resize(192, 192)
  .png()
  .toFile('public/pwa-192x192.png');

console.log('✓ Generated public/pwa-192x192.png');

// Generate 512x512
await sharp(svgBuffer)
  .resize(512, 512)
  .png()
  .toFile('public/pwa-512x512.png');

console.log('✓ Generated public/pwa-512x512.png');

// Generate apple-touch-icon (180x180)
await sharp(svgBuffer)
  .resize(180, 180)
  .png()
  .toFile('public/apple-touch-icon.png');

console.log('✓ Generated public/apple-touch-icon.png');

console.log('\n✓ All PWA icons generated successfully!');
