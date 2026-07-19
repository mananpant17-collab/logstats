import fs from 'fs';
let content = fs.readFileSync('src/pages/Analytics.tsx', 'utf8');

content = content.replace(
  /<div className="pb-8">\s*<\/div>\s*<div className="max-w-6xl mx-auto p-6 space-y-8">/,
  `<div className="pb-8">\n      <div className="max-w-6xl mx-auto p-6 space-y-8">`
);

fs.writeFileSync('src/pages/Analytics.tsx', content);
