const fs = require('fs');
const path = require('path');

const inputPath = path.resolve(__dirname, '..', 'public', 'logos', 'Megabunnish.webp');
const outputPath = path.resolve(__dirname, '..', 'public', 'logos', 'Megabunnish.base64.txt');

const data = fs.readFileSync(inputPath).toString('base64');
fs.writeFileSync(outputPath, data);
