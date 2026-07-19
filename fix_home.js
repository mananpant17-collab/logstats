import fs from 'fs';
let content = fs.readFileSync('src/pages/Home.tsx', 'utf8');
content = content.replace(
  /className=\{`flex-1 bg-bg-primary border border-bg-tertiary rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-accent-amber transition-colors \$\{goal\.done \? 'line-through text-text-tertiary' : ''\}`\}\s*\/>\s*placeholder="Set a goal\.\.\."\s*\/>/g,
  `placeholder="Set a goal..."
                className={\`flex-1 bg-bg-primary border border-bg-tertiary rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-accent-amber transition-colors \${goal.done ? 'line-through text-text-tertiary' : ''}\`}
              />`
);
fs.writeFileSync('src/pages/Home.tsx', content);
