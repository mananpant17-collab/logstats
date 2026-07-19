import fs from 'fs';

let content = fs.readFileSync('src/pages/History.tsx', 'utf8');

content = content.replace(/Object.values\(groupedLogs\).map\(\(log: any\) => \(/g, 
`Object.entries(
            Object.values(groupedLogs).reduce((acc: any, log: any) => {
              const [year, month] = log.date.split('-');
              const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1);
              const monthStr = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
              if (!acc[monthStr]) acc[monthStr] = [];
              acc[monthStr].push(log);
              return acc;
            }, {})
          ).map(([monthStr, logs]: [string, any]) => (
            <div key={monthStr} className="space-y-4">
              <h2 className="text-xs font-semibold tracking-[3px] uppercase text-text-tertiary mt-8 mb-4 border-b border-bg-tertiary pb-2">{monthStr}</h2>
              {logs.map((log: any) => (`);

content = content.replace(/<\/div>\n\s*\)\)}/, `</div>\n                  ))}\n            </div>\n          ))}`);

fs.writeFileSync('src/pages/History.tsx', content);
