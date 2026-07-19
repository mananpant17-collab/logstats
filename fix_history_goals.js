import fs from 'fs';
let content = fs.readFileSync('src/pages/History.tsx', 'utf8');

content = content.replace(
  /\{log\.daily\.goals\.map\(\(g: string, i: number\) => \(\s*g\.trim\(\) \? <li key=\{i\}>\{g\}<\/li> : null\s*\)\)\}/,
  `{log.daily.goals.map((g: any, i: number) => {
                          const text = typeof g === 'string' ? g : g.text;
                          const done = typeof g === 'string' ? false : g.done;
                          return text?.trim() ? (
                            <li key={i} className={done ? 'line-through text-text-tertiary' : ''}>{text}</li>
                          ) : null;
                        })}`
);

// also in export functionality!
content = content.replace(
  /log\.daily\?\.goals\?\.filter\(\(g: string\) => g\.trim\(\)\)\.join\(' \| '\) \|\| '',/,
  `log.daily?.goals?.map((g:any) => typeof g === 'string' ? g : (g.done ? '[x] ' + g.text : '[ ] ' + g.text)).filter(Boolean).join(' | ') || '',`
);


fs.writeFileSync('src/pages/History.tsx', content);
