import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const svgPath = join(__dirname, '../public/icon.svg');
const outputDir = join(__dirname, '../public');

async function generateIcons() {
  try {
    // Generate 192x192 icon
    await sharp(svgPath)
      .resize(192, 192)
      .png()
      .toFile(join(outputDir, 'icon-192.png'));
    
    // Generate 512x512 icon
    await sharp(svgPath)
      .resize(512, 512)
      .png()
      .toFile(join(outputDir, 'icon-512.png'));
    
    console.log('✅ Icons generated successfully!');
  } catch (error) {
    console.error('❌ Error generating icons:', error);
  }
}

generateIcons();