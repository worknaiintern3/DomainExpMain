const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const iconPath = path.join(__dirname, '../assets/images/ChatGPT Image 1 Oct 2026, 15_11_16.png');
const data = fs.readFileSync(iconPath);
const png = PNG.sync.read(data);

const width = png.width;
const height = png.height;
const cy = Math.floor(height / 2);
const cx = Math.floor(width / 2);

// Check from left to center along cy to find where the circular ring starts
let leftX = 0;
for (let x = 0; x < cx; x++) {
  const idx = (cy * width + x) * 4;
  const r = png.data[idx];
  const g = png.data[idx+1];
  const b = png.data[idx+2];
  // If not near pure white card background
  if (!(r > 245 && g > 245 && b > 245)) {
    leftX = x;
    break;
  }
}

// Check from right to center along cy
let rightX = width - 1;
for (let x = width - 1; x > cx; x--) {
  const idx = (cy * width + x) * 4;
  const r = png.data[idx];
  const g = png.data[idx+1];
  const b = png.data[idx+2];
  if (!(r > 245 && g > 245 && b > 245)) {
    rightX = x;
    break;
  }
}

// Check from top to center along cx
let topY = 0;
for (let y = 0; y < cy; y++) {
  const idx = (y * width + cx) * 4;
  const r = png.data[idx];
  const g = png.data[idx+1];
  const b = png.data[idx+2];
  if (!(r > 245 && g > 245 && b > 245)) {
    topY = y;
    break;
  }
}

// Check from bottom to center along cx
let bottomY = height - 1;
for (let y = height - 1; y > cy; y--) {
  const idx = (y * width + cx) * 4;
  const r = png.data[idx];
  const g = png.data[idx+1];
  const b = png.data[idx+2];
  if (!(r > 245 && g > 245 && b > 245)) {
    bottomY = y;
    break;
  }
}

console.log('Left:', leftX, 'Right:', rightX, 'Top:', topY, 'Bottom:', bottomY);
const centerX = (leftX + rightX) / 2;
const centerY = (topY + bottomY) / 2;
const radiusX = (rightX - leftX) / 2;
const radiusY = (bottomY - topY) / 2;
console.log('Center:', centerX, centerY, 'Radius:', radiusX, radiusY);
