const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const iconPath = path.join(__dirname, '../assets/images/icon.png');
const data = fs.readFileSync(iconPath);
const png = PNG.sync.read(data);

console.log('Verifying generated icon:');
console.log('Size:', png.width, png.height);

// Check corner pixels (should have alpha = 0)
const corners = [
  { name: 'Top-Left', x: 0, y: 0 },
  { name: 'Top-Right', x: png.width - 1, y: 0 },
  { name: 'Bottom-Left', x: 0, y: png.height - 1 },
  { name: 'Bottom-Right', x: png.width - 1, y: png.height - 1 },
  { name: 'Card-Corner-Area (50, 50)', x: 50, y: 50 },
  { name: 'Card-Corner-Area (1200, 50)', x: 1200, y: 50 },
];

for (const c of corners) {
  const idx = (c.y * png.width + c.x) * 4;
  console.log(`${c.name}: RGBA(${png.data[idx]}, ${png.data[idx+1]}, ${png.data[idx+2]}, ${png.data[idx+3]})`);
}

// Check center pixel (should have full alpha)
const centerIdx = (Math.floor(png.height/2) * png.width + Math.floor(png.width/2)) * 4;
console.log(`Center: RGBA(${png.data[centerIdx]}, ${png.data[centerIdx+1]}, ${png.data[centerIdx+2]}, ${png.data[centerIdx+3]})`);
