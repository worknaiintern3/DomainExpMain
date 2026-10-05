const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const sourcePath = path.join(__dirname, '../assets/images/ChatGPT Image 1 Oct 2026, 15_11_16.png');
const data = fs.readFileSync(sourcePath);
const srcPng = PNG.sync.read(data);

const width = srcPng.width;
const height = srcPng.height;

// Circle parameters
const cx = 625.5;
const cy = 625.0;
const radius = 533.0; // exact circle radius of the glass logo

// Create circular masked PNG
const outPng = new PNG({ width, height });

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const srcIdx = (y * width + x) * 4;
    const dstIdx = srcIdx;

    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= radius - 1.5) {
      // Inside circle
      outPng.data[dstIdx] = srcPng.data[srcIdx];
      outPng.data[dstIdx + 1] = srcPng.data[srcIdx + 1];
      outPng.data[dstIdx + 2] = srcPng.data[srcIdx + 2];
      outPng.data[dstIdx + 3] = srcPng.data[srcIdx + 3];
    } else if (dist <= radius + 0.5) {
      // Smooth anti-aliased edge
      const alphaFactor = Math.max(0, Math.min(1, (radius + 0.5 - dist) / 2.0));
      outPng.data[dstIdx] = srcPng.data[srcIdx];
      outPng.data[dstIdx + 1] = srcPng.data[srcIdx + 1];
      outPng.data[dstIdx + 2] = srcPng.data[srcIdx + 2];
      outPng.data[dstIdx + 3] = Math.round(srcPng.data[srcIdx + 3] * alphaFactor);
    } else {
      // Outside circle - completely transparent!
      outPng.data[dstIdx] = 0;
      outPng.data[dstIdx + 1] = 0;
      outPng.data[dstIdx + 2] = 0;
      outPng.data[dstIdx + 3] = 0;
    }
  }
}

// Write to all target files
const targets = [
  path.join(__dirname, '../assets/images/icon.png'),
  path.join(__dirname, '../assets/images/splash-icon.png'),
  path.join(__dirname, '../assets/images/android-icon-foreground.png'),
  path.join(__dirname, '../assets/images/favicon.png'),
];

const buffer = PNG.sync.write(outPng);
for (const target of targets) {
  fs.writeFileSync(target, buffer);
  console.log(`Updated ${target}`);
}

console.log('Successfully generated clean circular logo with transparent background!');
