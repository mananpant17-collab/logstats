import { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, writeBatch } from 'firebase/firestore';
import { db, auth, reAuthWithGoogle } from '../App';
import { appendToSheet, getUserSpreadsheetId } from '../lib/sheets';
import { isWorkoutDay, metricBucket } from '../lib/insights';
import { moodEmoji } from '../lib/moods';
import { format, parseISO } from 'date-fns';

export default function History() {
  const [groupedLogs, setGroupedLogs] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{message: string, onConfirm: () => void} | null>(null);
  const [learningItems, setLearningItems] = useState<any[]>([]);
  const [workItems, setWorkItems] = useState<any[]>([]);

  const fetchLogsLocal = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const uid = auth.currentUser.uid;
      const hQ = query(collection(db, 'users', uid, 'healthLogs'));
      const sQ = query(collection(db, 'users', uid, 'studyLogs'));
      const wQ = query(collection(db, 'users', uid, 'workLogs'));
      const mQ = query(collection(db, 'users', uid, 'moodLogs'));
      const dQ = query(collection(db, 'users', uid, 'daily'));
      const learningQ = query(collection(db, 'users', uid, 'learningItems'));
      const workItemsQ = query(collection(db, 'users', uid, 'workItems'));

      const [hSnap, sSnap, wSnap, mSnap, dSnap, learningSnap, workItemsSnap] = await Promise.all([
        getDocs(hQ), getDocs(sQ), getDocs(wQ), getDocs(mQ), getDocs(dQ),
        getDocs(learningQ), getDocs(workItemsQ),
      ]);
      setLearningItems(learningSnap.docs.map(item => ({ id: item.id, ...item.data() })));
      setWorkItems(workItemsSnap.docs.map(item => ({ id: item.id, ...item.data() })));

      const groups: Record<string, any> = {};

      const addLogs = (snap: any, type: string) => {
        snap.docs.forEach((doc: any) => {
          const data = doc.data();
          const date = data.date || doc.id;
          if (!groups[date]) groups[date] = { date };
          groups[date][type] = data;
        });
      };

      addLogs(hSnap, 'health');
      addLogs(sSnap, 'study');
      addLogs(wSnap, 'work');
      addLogs(mSnap, 'mood');
      addLogs(dSnap, 'daily');

      const sortedGroups: Record<string, any> = {};
      Object.keys(groups).sort((a, b) => b.localeCompare(a)).forEach(key => {
        sortedGroups[key] = groups[key];
      });
      setGroupedLogs(sortedGroups);
    } catch (err: any) {
      console.warn("Firestore fetch error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function fetchLogs() {
      if (!auth.currentUser) return;
      try {
        const sid = await getUserSpreadsheetId();
        if (sid) setSheetId(sid);
      } catch (err: any) {
        console.warn(err);
      }
      fetchLogsLocal();
    }
    fetchLogs();
  }, []);

  const importLegacyData = async () => {
    setImporting(true);
    try {
      const csvData = `Date,Weight,Mood,Workout,Mood Score,Workout Score,Workout Done
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

      const lines = csvData.split('\n').map(l => l.trim()).filter(l => l !== '');
      let count = 0;
      
      let batch = writeBatch(db);
      let operationsInBatch = 0;
      
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',');
        if (!row[0]) continue;
        
        let dateStr = row[0];
        if (dateStr.includes('-')) {
          const [day, monthStr] = dateStr.split('-');
          const months: Record<string, string> = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
          const m = months[monthStr];
          if (m) {
            const dd = day.padStart(2, '0');
            dateStr = `2026-${m}-${dd}`;
          }
        }

        const weight = row[1] || '';
        const mood = row[2] || '';
        const workout = row[3] || '';

        const uid = auth.currentUser!.uid;

        if (weight || workout) {
          batch.set(doc(db, 'users', uid, 'healthLogs', dateStr), {
            date: dateStr,
            weight: weight,
            workoutCategory: workout.toLowerCase().startsWith('no') ? '' : workout,
            updatedAt: new Date()
          }, { merge: true });
          operationsInBatch++;
        }

        if (mood) {
          batch.set(doc(db, 'users', uid, 'moodLogs', dateStr), {
            date: dateStr,
            mood: mood,
            updatedAt: new Date()
          }, { merge: true });
          operationsInBatch++;
        }
        
        if (operationsInBatch >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          operationsInBatch = 0;
        }
        count++;
      }
      
      if (operationsInBatch > 0) {
        await batch.commit();
      }
      
      setFeedbackMsg(`Successfully imported ${count} entries!`);
      await fetchLogsLocal();
    } catch (err: any) {
      console.error(err);
      setFeedbackMsg('Error importing data: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  const exportAllToSheets = async () => {
    setConfirmDialog({
      message: 'This will export all your historical data to Google Sheets. Continue?',
      onConfirm: async () => {
        setConfirmDialog(null);
        setExporting(true);
        try {
          const rows = [];
          // Header row for the new comprehensive layout
          rows.push([
            'Date', 'Goals', 'Mood', 'Weight (kg)', 'Workout Category', 'Workout Notes', 'Nutrition', 'Study Hours', 'Study Notes', 'Work & Networking'
          ]);
    
          Object.values(groupedLogs).forEach((log: any) => {
            rows.push([
              log.date || '',
              log.daily?.goals?.map((g:any) => typeof g === 'string' ? g : (g.done ? '[x] ' + g.text : '[ ] ' + g.text)).filter(Boolean).join(' | ') || '',
              log.mood?.mood || '',
              log.health?.weight || '',
              log.health?.workoutCategory || '',
              log.health?.workoutNotes || '',
              log.health ? `Healthy: ${log.health.foodHealthy?.join(', ') || 'N/A'}\nJunk: ${log.health.foodJunk?.join(', ') || 'N/A'}\nOut: ${log.health.foodOut?.join(', ') || 'N/A'}` : '',
              log.study?.practiceHours || '',
              log.study ? `School: ${log.study.schoolNotes || ''}\nLearning: ${log.study.learningNotes || ''}` : '',
              log.work ? `Work: ${log.work.workNotes || ''}\nNet: ${log.work.networkNotes || ''}` : ''
            ]);
          });
    
          // Write everything starting from A1 (it will append if the sheet has content, but includes a header)
          await appendToSheet('Sheet1!A:J', rows);
          const sid = await getUserSpreadsheetId();
          if (sid) setSheetId(sid);
          setNeedsAuth(false);
          setFeedbackMsg('Successfully exported all history to Google Sheets!');
        } catch (err: any) {
          console.error(err);
          if (err.message.includes('Google Access Token not found') || err.message.includes('authentication expired') || err.message.includes('Not authenticated')) {
            setNeedsAuth(true);
          } else {
            setFeedbackMsg('Error exporting to sheets: ' + err.message);
          }
        } finally {
          setExporting(false);
        }
      }
    });
  };

  return (
    <div className="p-5 sm:p-6 pb-24 max-w-xl mx-auto space-y-9 text-text-primary">
      {confirmDialog && (
        <div className="fixed inset-0 z-50 bg-bg-primary/80 flex items-center justify-center p-4">
          <div className="bg-bg-secondary border border-bg-tertiary rounded-xl p-6 max-w-sm w-full space-y-6 shadow-2xl">
            <p className="text-sm">{confirmDialog.message}</p>
            <div className="flex justify-end gap-4">
              <button onClick={() => setConfirmDialog(null)} className="text-xs uppercase tracking-widest text-text-tertiary hover:text-text-primary transition-colors px-4 py-2">
                Cancel
              </button>
              <button onClick={confirmDialog.onConfirm} className="text-[10px] tracking-widest uppercase px-4 py-2 bg-text-primary text-bg-primary rounded-lg font-semibold hover:bg-text-secondary transition-colors">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
      
      {feedbackMsg && (
        <div className="bg-accent-teal/10 border border-accent-teal/30 rounded-xl p-4 flex items-center justify-between gap-4">
          <p className="text-sm text-text-secondary">{feedbackMsg}</p>
          <button onClick={() => setFeedbackMsg(null)} className="text-xs text-text-tertiary hover:text-text-primary uppercase tracking-widest px-2">
            Close
          </button>
        </div>
      )}

      {needsAuth && (
        <div className="bg-accent-amber/20 border border-accent-amber/50 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm">Your Google Sheets connection expired. Please reconnect to export.</p>
          <button
            onClick={async () => {
              try {
                await reAuthWithGoogle();
                setNeedsAuth(false);
                setFeedbackMsg("Successfully re-connected! You can now export.");
              } catch (err: any) {
                setFeedbackMsg("Error connecting: " + err.message);
              }
            }}
            className="text-[10px] tracking-widest uppercase px-4 py-2 bg-accent-amber text-[#1a0f07] font-semibold rounded-lg shrink-0"
          >
            Reconnect
          </button>
        </div>
      )}
      
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-serif text-3xl tracking-widest uppercase">History</h1>
        <div className="flex items-center gap-2">
          {sheetId && (
            <a 
              href={`https://docs.google.com/spreadsheets/d/${sheetId}/edit`}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] tracking-widest uppercase px-4 py-2 bg-accent-teal/10 text-accent-teal border border-accent-teal/30 rounded-lg hover:bg-accent-teal/20 transition-colors"
            >
              Open Sheet
            </a>
          )}
          <button
            onClick={importLegacyData}
            disabled={importing || loading}
            className="text-[10px] tracking-widest uppercase px-4 py-2 bg-bg-secondary border border-bg-tertiary rounded-lg hover:border-text-tertiary transition-colors disabled:opacity-50"
          >
            {importing ? 'Importing...' : 'Import Data'}
          </button>
          <button
            onClick={exportAllToSheets}
            disabled={exporting || loading || Object.keys(groupedLogs).length === 0}
            className="text-[10px] tracking-widest uppercase px-4 py-2 bg-bg-secondary border border-bg-tertiary rounded-lg hover:border-text-tertiary transition-colors disabled:opacity-50"
          >
            {exporting ? 'Exporting...' : 'Export All'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-text-tertiary py-10 animate-pulse text-xs tracking-widest uppercase">Loading...</div>
      ) : Object.keys(groupedLogs).length === 0 ? (
        <div className="text-center text-text-tertiary py-10 text-xs tracking-widest uppercase">No entries found.</div>
      ) : (
        <div className="space-y-4">
          {Object.entries(
            Object.values(groupedLogs).reduce((acc: any, log: any) => {
              const [year, month] = log.date.split('-');
              const dateObj = new Date(Number(year), Number(month) - 1, 1);
              const monthStr = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
              if (!acc[monthStr]) acc[monthStr] = [];
              acc[monthStr].push(log);
              return acc;
            }, {})
          ).map(([monthStr, logs]: [string, any]) => (
            <div key={monthStr} className="space-y-4">
              <h2 className="text-xs font-semibold tracking-[0.25em] uppercase text-text-tertiary mt-8 mb-5 border-b border-bg-tertiary pb-3">{monthStr}</h2>
              {logs.map((log: any) => {
                const mood = log.health?.mood || log.mood?.mood;
                const goals = (log.daily?.goals || []).filter((goal: any) => (typeof goal === 'string' ? goal : goal?.text)?.trim());
                const completedGoals = goals.filter((goal: any) => typeof goal !== 'string' && goal.done).length;
                const dayLearningItems = learningItems.filter(item => item.updatedDate === log.date);
                const dayWorkItems = workItems.filter(item => item.updatedDate === log.date);
                const hasDetails = log.health || log.study || log.work || log.mood || log.daily || dayLearningItems.length || dayWorkItems.length;
                return (
                  <div key={log.date} className="bg-bg-secondary border border-bg-tertiary rounded-2xl overflow-hidden transition-all">
                    <button
                      onClick={() => setExpandedDate(expandedDate === log.date ? null : log.date)}
                      className="w-full p-4 sm:p-5 flex items-center gap-3 text-left focus:outline-none hover:bg-bg-primary/20 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-text-primary">{format(parseISO(log.date), 'EEEE d MMMM')}</span>
                          <span className="text-xl leading-none">{moodEmoji(mood)}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] tracking-[0.08em] uppercase text-text-tertiary">
                          {log.health?.weight ? <span>{log.health.weight} kg</span> : null}
                          {goals.length ? <span>{completedGoals}/{goals.length} goals</span> : null}
                          {isWorkoutDay(log.health) ? <span>{Array.isArray(log.health.workoutCategories) && log.health.workoutCategories.length ? log.health.workoutCategories.join(' · ') : log.health.workoutCategory}</span> : null}
                        </div>
                      </div>
                      <span className="text-lg text-text-tertiary">{expandedDate === log.date ? '−' : '+'}</span>
                    </button>

                    {expandedDate === log.date && (
                      <div className="px-4 sm:px-5 pb-5 space-y-4 border-t border-bg-tertiary pt-5">
                        {goals.length > 0 && (
                          <section className="rounded-2xl border border-bg-tertiary bg-bg-primary/30 p-4 space-y-3">
                            <h3 className="text-[10px] text-accent-amber uppercase tracking-[0.2em] font-semibold">Goals</h3>
                            <ul className="space-y-2">
                              {goals.map((goal: any, i: number) => {
                                const text = typeof goal === 'string' ? goal : goal.text;
                                const done = typeof goal !== 'string' && goal.done;
                                return <li key={i} className={`text-sm ${done ? 'line-through text-text-tertiary' : 'text-text-secondary'}`}>{done ? '✓ ' : '○ '}{text}</li>;
                              })}
                            </ul>
                          </section>
                        )}

                        {(mood || log.health?.weight) && (
                          <section className="rounded-2xl border border-bg-tertiary bg-bg-primary/30 p-4 space-y-3">
                            <h3 className="text-[10px] text-accent-teal uppercase tracking-[0.2em] font-semibold">Mood & Weight</h3>
                            <div className="grid grid-cols-2 gap-3">
                              {mood && <div><div className="text-[9px] uppercase tracking-widest text-text-tertiary">Mood</div><div className="mt-1 text-sm text-text-primary">{moodEmoji(mood)} {mood}</div></div>}
                              {log.health?.weight ? <div><div className="text-[9px] uppercase tracking-widest text-text-tertiary">Weight</div><div className="mt-1 font-serif text-2xl text-text-primary">{log.health.weight}<span className="ml-1 text-xs font-sans text-text-tertiary">kg</span></div></div> : null}
                            </div>
                          </section>
                        )}

                        {log.health && (
                          <section className="rounded-2xl border border-bg-tertiary bg-bg-primary/30 p-4 space-y-4">
                            <h3 className="text-[10px] text-accent-teal uppercase tracking-[0.2em] font-semibold">Health & Workout</h3>
                            <div className="grid grid-cols-2 gap-3">
                              {(['sleep', 'water', 'steps', 'screen'] as const).map(metric => {
                                const value = metricBucket(log.health, metric);
                                const labels = { sleep: 'Sleep', water: 'Water', steps: 'Steps', screen: 'Screen time' };
                                return value ? <div key={metric}><div className="text-[9px] uppercase tracking-widest text-text-tertiary">{labels[metric]}</div><div className="mt-1 text-sm text-text-primary">{value}</div></div> : null;
                              })}
                            </div>
                            {isWorkoutDay(log.health) && <div><div className="text-[9px] uppercase tracking-widest text-text-tertiary">Workout</div><div className="mt-1 text-sm text-text-primary">{Array.isArray(log.health.workoutCategories) && log.health.workoutCategories.length ? log.health.workoutCategories.join(' · ') : log.health.workoutCategory}</div></div>}
                            {log.health.workoutNotes && <div className="whitespace-pre-wrap text-sm text-text-secondary"><div className="mb-1 text-[9px] uppercase tracking-widest text-text-tertiary">Workout notes</div>{log.health.workoutNotes}</div>}
                            {log.health.exercises?.length > 0 && (
                              <div className="space-y-2"><div className="text-[9px] uppercase tracking-widest text-text-tertiary">Structured exercises</div>{log.health.exercises.map((exercise: any, i: number) => <div key={i} className="flex justify-between gap-3 rounded-xl bg-bg-secondary px-3 py-2 text-xs"><span className="text-text-primary">{exercise.name}</span><span className="text-text-tertiary">{exercise.weight}kg · {exercise.sets}×{exercise.reps}</span></div>)}</div>
                            )}
                          </section>
                        )}

                        {log.health && (log.health.foodHome?.length || log.health.foodOutside?.length || log.health.foodHealthyOutside?.length || log.health.foodHealthy?.length || log.health.foodJunk?.length || log.health.foodOut?.length) ? (
                          <section className="rounded-2xl border border-bg-tertiary bg-bg-primary/30 p-4 space-y-3">
                            <h3 className="text-[10px] text-accent-green uppercase tracking-[0.2em] font-semibold">Nutrition</h3>
                            {log.health.foodHome?.length > 0 && <div><span className="text-[9px] uppercase tracking-widest text-text-tertiary">Home-cooked · </span>{log.health.foodHome.join(', ')}</div>}
                            {log.health.foodOutside?.length > 0 && <div><span className="text-[9px] uppercase tracking-widest text-text-tertiary">Outside · </span>{log.health.foodOutside.join(', ')}</div>}
                            {log.health.foodHealthyOutside?.length > 0 && <div><span className="text-[9px] uppercase tracking-widest text-text-tertiary">Healthy outside · </span>{log.health.foodHealthyOutside.join(', ')}</div>}
                            {log.health.foodHealthy?.length > 0 && <div><span className="text-[9px] uppercase tracking-widest text-text-tertiary">Healthy · </span>{log.health.foodHealthy.join(', ')}</div>}
                            {log.health.foodJunk?.length > 0 && <div><span className="text-[9px] uppercase tracking-widest text-text-tertiary">Junk · </span>{log.health.foodJunk.join(', ')}</div>}
                            {log.health.foodOut?.length > 0 && <div><span className="text-[9px] uppercase tracking-widest text-text-tertiary">Out · </span>{log.health.foodOut.join(', ')}</div>}
                          </section>
                        ) : null}

                        {(log.study || dayLearningItems.length > 0) && (
                          <section className="rounded-2xl border border-bg-tertiary bg-bg-primary/30 p-4 space-y-4">
                            <h3 className="text-[10px] text-accent-amber uppercase tracking-[0.2em] font-semibold">Study</h3>
                            {log.study?.practiceHours ? <div><span className="text-[9px] uppercase tracking-widest text-text-tertiary">Legacy practice hours · </span>{log.study.practiceHours}</div> : null}
                            {log.study?.studyEnjoyment ? <div><span className="text-[9px] uppercase tracking-widest text-text-tertiary">Daily enjoyment · </span>{log.study.studyEnjoyment}/5</div> : null}
                            {log.study?.schoolNotes && <div className="whitespace-pre-wrap"><div className="mb-1 text-[9px] uppercase tracking-widest text-text-tertiary">School notes</div>{log.study.schoolNotes}</div>}
                            {log.study?.learningNotes && <div className="whitespace-pre-wrap"><div className="mb-1 text-[9px] uppercase tracking-widest text-text-tertiary">Learning notes</div>{log.study.learningNotes}</div>}
                            {dayLearningItems.length > 0 && <div className="space-y-2"><div className="text-[9px] uppercase tracking-widest text-text-tertiary">Learning items updated</div>{dayLearningItems.map(item => <div key={item.id} className="rounded-xl bg-bg-secondary px-3 py-3"><div className="flex justify-between gap-3"><span className="text-sm text-text-primary">{item.title}</span><span className="text-[10px] text-accent-amber">{item.enjoyment || 0}/5</span></div><div className="mt-1 text-[9px] uppercase tracking-widest text-text-tertiary">{item.category} · {item.status}</div>{item.progressTotal ? <div className="mt-2 text-xs text-text-secondary">{item.progressCurrent ?? 0}/{item.progressTotal} {item.unit} · {Math.min(100, Math.round(((item.progressCurrent ?? 0) / item.progressTotal) * 100))}%</div> : null}{item.notes ? <div className="mt-2 whitespace-pre-wrap text-xs text-text-secondary">{item.notes}</div> : null}</div>)}</div>}
                          </section>
                        )}

                        {(log.work || dayWorkItems.length > 0) && (
                          <section className="rounded-2xl border border-bg-tertiary bg-bg-primary/30 p-4 space-y-4">
                            <h3 className="text-[10px] text-accent-red uppercase tracking-[0.2em] font-semibold">Work</h3>
                            {log.work?.workEnjoyment ? <div><span className="text-[9px] uppercase tracking-widest text-text-tertiary">Daily enjoyment · </span>{log.work.workEnjoyment}/5</div> : null}
                            {log.work?.workNotes && <div className="whitespace-pre-wrap"><div className="mb-1 text-[9px] uppercase tracking-widest text-text-tertiary">Work notes</div>{log.work.workNotes}</div>}
                            {log.work?.networkNotes && <div className="whitespace-pre-wrap"><div className="mb-1 text-[9px] uppercase tracking-widest text-text-tertiary">Networking notes</div>{log.work.networkNotes}</div>}
                            {dayWorkItems.length > 0 && <div className="space-y-2"><div className="text-[9px] uppercase tracking-widest text-text-tertiary">Work items updated</div>{dayWorkItems.map(item => <div key={item.id} className="rounded-xl bg-bg-secondary px-3 py-3"><div className="flex justify-between gap-3"><span className="text-sm text-text-primary">{item.title}</span><span className="text-[10px] text-accent-red">{item.enjoyment || 0}/5</span></div><div className="mt-1 text-[9px] uppercase tracking-widest text-text-tertiary">{item.category} · {item.status}</div>{item.notes ? <div className="mt-2 whitespace-pre-wrap text-xs text-text-secondary">{item.notes}</div> : null}</div>)}</div>}
                          </section>
                        )}

                        {!hasDetails && <div className="text-text-tertiary text-xs italic">No specific details logged for this date.</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
