const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const iconPath = path.join(__dirname, '../assets/images/ChatGPT Image 1 Oct 2026, 15_11_16.png');
const data = fs.readFileSync(iconPath);
const png = PNG.sync.read(data);

console.log('Size:', png.width, png.height);

// Let's sample along horizontal centerline and vertical centerline
const cy = Math.floor(png.height / 2);
const cx = Math.floor(png.width / 2);

console.log('Horizontal profile across center:');
for (let x = 0; x < png.width; x += 20) {
  const idx = (cy * png.width + x) * 4;
  const r = png.data[idx];
  const g = png.data[idx+1];
  const b = png.data[idx+2];
  const a = png.data[idx+3];
  if (x % 100 === 0) {
    console.log(`x=${x}: rgba(${r},${g},${b},${a})`);
  }
}

// Let's find the bounding box of the circular icon inside
// The rounded card has background color near white or shadow.
// Let's find where the outer glass circle ring begins.
