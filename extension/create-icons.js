// This is a Node.js script to generate placeholder icons
// Run with: node create-icons.js

const fs = require('fs');
const path = require('path');

// Create the icons directory if it doesn't exist
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir);
  console.log('Created icons directory');
}

// Function to create a simple SVG icon with a question mark
function createSvgIcon(size) {
  const padding = Math.floor(size * 0.2);
  const fontSize = Math.floor(size * 0.6);
  
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#4CAF50" rx="5" ry="5"/>
  <text x="50%" y="50%" font-family="Arial" font-size="${fontSize}px" fill="white" text-anchor="middle" dominant-baseline="middle">?</text>
</svg>`;
}

// List of icon sizes to generate
const sizes = [16, 48, 128];

// Generate and save each icon
sizes.forEach(size => {
  const svgContent = createSvgIcon(size);
  const filePath = path.join(iconsDir, `icon${size}.svg`);
  
  fs.writeFileSync(filePath, svgContent);
  console.log(`Created ${filePath}`);
});

console.log('Icon generation complete. Note: These are SVG placeholders. For production, convert to PNG.');
console.log('You can use online tools like https://svgtopng.com/ to convert these SVGs to PNG files.');