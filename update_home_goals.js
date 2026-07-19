import fs from 'fs';

let content = fs.readFileSync('src/pages/Home.tsx', 'utf8');

// Replace state
content = content.replace(
  /const \[goals, setGoals\] = useState\(\['', '', ''\]\);/,
  `const [goals, setGoals] = useState<{text: string, done: boolean}[]>([{text: '', done: false}, {text: '', done: false}, {text: '', done: false}]);`
);

// Replace load
content = content.replace(
  /if \(data.goals\) setGoals\(data.goals\);/,
  `if (data.goals) setGoals(data.goals.map((g: any) => typeof g === 'string' ? { text: g, done: false } : g));`
);

// Replace goals.join(' | ') in saveGoals
content = content.replace(
  /goals\.join\(' \| '\)/,
  `goals.map(g => g.text).join(' | ')`
);

// Replace handleGoalChange
content = content.replace(
  /const handleGoalChange = \(index: number, val: string\) => {\s*const newGoals = \[\.\.\.goals\];\s*newGoals\[index\] = val;\s*setGoals\(newGoals\);\s*};/,
  `const handleGoalChange = (index: number, val: string) => {
    const newGoals = [...goals];
    newGoals[index].text = val;
    setGoals(newGoals);
  };
  const toggleGoalDone = (index: number) => {
    const newGoals = [...goals];
    newGoals[index].done = !newGoals[index].done;
    setGoals(newGoals);
  };`
);

// Replace addGoal
content = content.replace(
  /const addGoal = \(\) => setGoals\(\[\.\.\.goals, ''\]\);/,
  `const addGoal = () => setGoals([...goals, {text: '', done: false}]);`
);

// Replace render
content = content.replace(
  /type="text"\s*value=\{goal\}\s*onChange=\{\(e\) => handleGoalChange\(i, e\.target\.value\)\}/g,
  `type="text"
                value={goal.text}
                onChange={(e) => handleGoalChange(i, e.target.value)}
                className={\`flex-1 bg-bg-primary border border-bg-tertiary rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-accent-amber transition-colors \${goal.done ? 'line-through text-text-tertiary' : ''}\`}
              />`
);

content = content.replace(
  /<div className="w-6 h-6 flex-shrink-0 flex items-center justify-center border border-bg-tertiary rounded-full text-xs text-text-tertiary">\s*\{i \+ 1\}\s*<\/div>/g,
  `<button 
                onClick={() => toggleGoalDone(i)}
                className={\`w-6 h-6 flex-shrink-0 flex items-center justify-center border rounded-full text-xs transition-colors \${goal.done ? 'bg-accent-amber border-accent-amber text-bg-primary' : 'border-bg-tertiary text-text-tertiary hover:border-text-secondary'}\`}
              >
                {goal.done ? '✓' : i + 1}
              </button>`
);

content = content.replace(
  /className="flex-1 bg-bg-primary border border-bg-tertiary rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-accent-amber transition-colors"/g,
  `` // removed in the previous replacement
);

// Emojis:
content = content.replace(
  /const MOODS = \[\s*\{\s*key: 'energetic', emoji: '🤩', text: 'Energetic'\s*\},[\s\S]*?\];/,
  `const MOODS = [
  { key: 'energetic', emoji: '⚡', text: 'Energetic' },
  { key: 'good/productive', emoji: '😊', text: 'Good/Productive' },
  { key: 'average', emoji: '😐', text: 'Average' },
  { key: 'bad/zero day', emoji: '😕', text: 'Bad/Zero Day' },
  { key: 'awful', emoji: '📉', text: 'Awful' },
];`
);

fs.writeFileSync('src/pages/Home.tsx', content);
