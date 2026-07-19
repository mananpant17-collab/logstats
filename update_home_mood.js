import fs from 'fs';
let content = fs.readFileSync('src/pages/Home.tsx', 'utf8');

content = content.replace(
  /<button\s*key=\{m\.key\}\s*onClick=\{\(\) => setMood\(m\.key\)\}\s*className=\{`w-12 h-12 flex items-center justify-center rounded-xl border text-xl transition-all \$\{[\s\S]*?\}\`\}\s*title=\{m\.text\}\s*>\s*\{m\.emoji\}\s*<\/button>/g,
  `<button 
                key={m.key}
                onClick={() => setMood(m.key)}
                className={\`flex-1 py-3 px-2 flex flex-col items-center justify-center gap-1 rounded-xl border transition-all \${
                  mood === m.key
                    ? 'border-accent-teal bg-accent-teal/10 text-accent-teal'
                    : 'border-bg-tertiary text-text-secondary hover:border-text-tertiary'
                }\`}
              >
                <span className="text-xl">{m.emoji}</span>
                <span className="text-[9px] tracking-widest uppercase">{m.text}</span>
              </button>`
);

fs.writeFileSync('src/pages/Home.tsx', content);
