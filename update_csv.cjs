const fs = require('fs');
const content = fs.readFileSync('src/pages/History.tsx', 'utf-8');

const newData = `Date,Weight,Mood,Workout,Mood Score,Workout Score,Workout Done
17-Feb,63.15,,No,,0,0
18-Feb,62.6,,Yes (Great),,2,1
19-Feb,63.8,,No,,0,0
20-Feb,,,No,,0,0
21-Feb,63.85,,Yes (Great),,2,1
22-Feb,62.95,,Yes (Great),,2,1
23-Feb,64.55,,No,,0,0
24-Feb,62.6,,No,,0,0
25-Feb,62.6,,Yes (Light),,1,1
26-Feb,64.3,Average/Alright,Yes (Great),3,2,1
27-Feb,63.55,Bad/Problematic/Zero Day,No,2,0,0
28-Feb,61.8,Average/Alright,Yes (Great),3,2,1
1-Mar,62.5,Good/Calm/Productive,Yes (Great),4,2,1
2-Mar,63.4,Bad/Problematic/Zero Day,No,2,0,0
3-Mar,63.4,Average/Alright,No,3,0,0
4-Mar,63.4,Energetic/Great,No,5,0,0
5-Mar,63.15,Energetic/Great,Yes (Great),5,2,1
6-Mar,63.8,Energetic/Great,Yes (Great),5,2,1
7-Mar,63.8,Bad/Problematic/Zero Day,No,2,0,0
8-Mar,62.75,Awful,No,1,0,0
9-Mar,64,Good/Calm/Productive,Yes (Great),4,2,1
10-Mar,63,Bad/Problematic/Zero Day,No,2,0,0
11-Mar,,Bad/Problematic/Zero Day,No,2,0,0
12-Mar,,Bad/Problematic/Zero Day,No,2,0,0
13-Mar,62.85,Awful,No,1,0,0
14-Mar,62.2,Bad/Problematic/Zero Day,No,2,0,0
15-Mar,61.85,Good/Calm/Productive,No,4,0,0
16-Mar,62.8,Good/Calm/Productive,No,4,0,0
17-Mar,62.1,Good/Calm/Productive,No,4,0,0
18-Mar,62.1,Average/Alright,Yes (Great),3,2,1
19-Mar,63.45,Average/Alright,Yes (Light),3,1,1
20-Mar,63.9,Bad/Problematic/Zero Day,No,2,0,0
21-Mar,63.962,Bad/Problematic/Zero Day,No,2,0,0
22-Mar,62.85,Average/Alright,Yes (Great),3,2,1
23-Mar,64,Bad/Problematic/Zero Day,No,2,0,0
24-Mar,64.1,Average/Alright,No,3,0,0
25-Mar,62.75,Bad/Problematic/Zero Day,Yes (Great),2,2,1
26-Mar,63,Average/Alright,Yes (Great),3,2,1
27-Mar,64.4,Good/Calm/Productive,No,4,0,0
28-Mar,63.15,Average/Alright,Yes (Great),3,2,1
29-Mar,63.7,Average/Alright,Yes (Great),3,2,1
30-Mar,64.55,Good/Calm/Productive,No,4,0,0
31-Mar,63.6,Bad/Problematic/Zero Day,No,2,0,0
1-Apr,,Bad/Problematic/Zero Day,Yes (Great),2,2,1
2-Apr,,Bad/Problematic/Zero Day,No,2,0,0
3-Apr,62.2,Awful,Yes (Great),1,2,1
4-Apr,62.6,Awful,Yes (Great),1,2,1
5-Apr,64.05,Good/Calm/Productive,Yes (Great),4,2,1
6-Apr,65,Good/Calm/Productive,No,4,0,0
7-Apr,62.95,Bad/Problematic/Zero Day,No,2,0,0
8-Apr,63.95,Average/Alright,Yes (Great),3,2,1
9-Apr,62.7,Average/Alright,Yes (Great),3,2,1
10-Apr,63.4,Bad/Problematic/Zero Day,No,2,0,0
11-Apr,63.05,Average/Alright,Yes (Great),3,2,1
12-Apr,63.7,Average/Alright,Yes (Light),3,1,1
13-Apr,65.2,Good/Calm/Productive,No,4,0,0
14-Apr,64,Bad/Problematic/Zero Day,No,2,0,0
15-Apr,63,Good/Calm/Productive,Yes (Great),4,2,1
16-Apr,64.2,Good/Calm/Productive,No,4,0,0
17-Apr,,,,,,
18-Apr,63.15,Good/Calm/Productive,Yes (Great),4,2,1
20-Apr,63.55,Good/Calm/Productive,No,4,0,0
19-Apr,64.1,Average/Alright,Yes (Great),3,2,1
21-Apr,64.1,Good/Calm/Productive,No,4,0,0
22-Apr,,,,,,
23-Apr,63.85,Average/Alright,Yes (Great),3,2,1
24-Apr,63.9,Average/Alright,Yes (Great),3,2,1
25-Apr,64.9,Good/Calm/Productive,Yes (Great),4,2,1
26-Apr,64.4,Average/Alright,Yes (Great),3,2,1
27-Apr,64.6,Bad/Problematic/Zero Day,No,2,0,0
28-Apr,64.6,Average/Alright,No,,,
29-Apr,,,,,,
30-Apr,64.25,Good/Calm/Productive,Yes (Great),4,2,1
1-May,64.9,Good/Calm/Productive,Yes (Great),4,2,1
2-May,65.5,Average/Alright,No,3,0,0
3-May,65.5,Good/Calm/Productive,Yes (Great),4,2,1
4-May,64.7,Bad/Problematic/Zero Day,Yes (Great),2,2,1
5-May,64.45,Bad/Problematic/Zero Day,No,2,0,0
6-May,,Awful,No,1,0,0
7-May,,Bad/Problematic/Zero Day,No,2,0,0
8-May,64.7,Good/Calm/Productive,Yes (Great),4,2,1
9-May,65.05,Good/Calm/Productive,Yes (Great),4,2,1
10-May,64.25,Average/Alright,Yes (Great),3,2,1
11-May,65.75,Good/Calm/Productive,Yes (Great),4,2,1
12-May,65.35,Bad/Problematic/Zero Day,No,2,0,0
13-May,65.5,Bad/Problematic/Zero Day,No,2,0,0
14-May,64.95,Average/Alright,No,3,0,0
15-May,64.2,Average/Alright,Yes (Great),3,2,1
16-May,,Bad/Problematic/Zero Day,,2,,
17-May,65.5,Average/Alright,Yes (Great),3,2,1
18-May,64.95,Bad/Problematic/Zero Day,Yes (Light),2,1,1
19-May,65,Average/Alright,No,3,0,0
20-May,64.1,Average/Alright,Yes (Great),3,2,1
21-May,,Awful,No,1,0,0
22-May,65.85,Bad/Problematic/Zero Day,No,2,0,0
23-May,65.2,Bad/Problematic/Zero Day,No,2,0,0
24-May,65.95,Average/Alright,No,3,0,0
25-May,66.7,Average/Alright,No,3,0,0
26-May,65.15,Average/Alright,No,3,0,0
25-May,66.7,Average/Alright,No,3,,0
26-May,65.15,Average/Alright,No,3,,0
27-May,65.95,Good/Calm/Productive,No,4,,0
28-May,65.3,Good/Calm/Productive,No,4,0,0
29-May,65.3,Good/Calm/Productive,Yes (Great),4,2,1
30-May,65.25,Average/Alright,No,3,0,0
31-May,65.25,Good/Calm/Productive,Yes (Great),4,2,1
1-Jun,66.15,Average/Alright,No,3,0,0
2-Jun,64.85,Energetic/Great,No,5,0,0
3-Jun,66.1,Bad/Problematic/Zero Day,No,2,0,0
4-Jun,65.75,Average/Alright,No,3,0,0
5-Jun,65.75,Bad/Problematic/Zero Day,No,2,0,0
6-Jun,65.25,Average/Alright,No,3,0,0
7-Jun,65.15,Good/Calm/Productive,No,4,0,0
8-Jun,64.25,Good/Calm/Productive,No,4,0,0
9-Jun,65.55,Good/Calm/Productive,No,4,0,0
10-Jun,64.85,Energetic/Great,No,5,0,0
11-Jun,63.75,Good/Calm/Productive,No,4,0,0
12-Jun,65.35,Good/Calm/Productive,No,4,0,0
13-Jun,64.25,Good/Calm/Productive,Yes (Great),4,2,1
14-Jun,65.15,Good/Calm/Productive,Yes (Great),4,2,1
15-Jun,64.8,Good/Calm/Productive,Yes (Great),4,2,1
16-Jun,,Bad/Problematic/Zero Day,No,2,0,0
17-Jun,,Bad/Problematic/Zero Day,No,2,0,0
18-Jun,65.2,Average/Alright,Yes (Light),3,1,1
19-Jun,65.45,Bad/Problematic/Zero Day,No,2,0,0
20-Jun,64.65,Average/Alright,No,3,0,0
21-Jun,65.9,Bad/Problematic/Zero Day,No,2,0,0
22-Jun,,Bad/Problematic/Zero Day,No,2,0,0
23-Jun,,Average/Alright,Yes (Light),3,1,1
24-Jun,66.15,Bad/Problematic/Zero Day,No,2,0,0
25-Jun,66.05,Energetic/Great,Yes (Great),5,2,1
26-Jun,65.2,Good/Calm/Productive,No,4,0,0
27-Jun,65.05,Good/Calm/Productive,Yes (Great),4,2,1
28-Jun,64.85,Good/Calm/Productive,No,4,,0
29-Jun,64.5,Bad/Problematic/Zero Day,No,2,,0
30-Jun,65.15,Bad/Problematic/Zero Day,No,2,,0
1-Jul,,Average/Alright,No,3,,0
2-Jul,65.35,Energetic/Great,Yes (Great),5,2,1
3-Jul,64.35,Average/Alright,No,3,,0
4-Jul,65.5,Average/Alright,Yes (Great),3,2,1
5-Jul,,Average/Alright,Yes (Great),3,2,1
6-Jul,64.8,Energetic/Great,Yes (Great),5,2,1
7-Jul,64.85,Energetic/Great,Yes (Great),5,2,1
8-Jul,65.65,Good/Calm/Productive,Yes (Great),4,2,1
9-Jul,65.6,Bad/Problematic/Zero Day,No,2,,0
10-Jul,65.7,Good/Calm/Productive,Yes (Great),4,2,1
11-Jul,65.5,Average/Alright,No,3,,0
12-Jul,65.6,Good/Calm/Productive,Yes (Great),4,2,1
13-Jul,65.05,Good/Calm/Productive,Yes (Great),4,2,1
14-Jul,65.55,Good/Calm/Productive,No,4,,0
15-Jul,65.05,Good/Calm/Productive,Yes (Great),4,2,1
16-Jul,64.85,Good/Calm/Productive,Yes (Great),,,
17-Jul,66.45,Average/Alright,No,3,,0
18-Jul,65.75,Good/Calm/Productive,Yes (Great),4,2,1
19-Jul,65.25,Average/Alright,,3,,`;

const startIndex = content.indexOf('const csvData = `');
const endIndex = content.indexOf('`;', startIndex) + 2;

const newContent = content.substring(0, startIndex) + 'const csvData = `' + newData + '`;' + content.substring(endIndex);

fs.writeFileSync('src/pages/History.tsx', newContent);
