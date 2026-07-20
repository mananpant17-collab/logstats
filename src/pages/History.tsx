import { useState, useEffect, useMemo } from 'react';
import { collection, query, getDocs, doc, writeBatch } from 'firebase/firestore';
import { db, auth, reAuthWithGoogle } from '../App';
import { appendToSheet, getUserSpreadsheetId } from '../lib/sheets';
import { exerciseProgress } from '../lib/insights';
import { Line, LineChart, ResponsiveContainer } from 'recharts';

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
  const exerciseData = useMemo(() => exerciseProgress(Object.values(groupedLogs).map(log => log.health).filter(Boolean)), [groupedLogs]);

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

      const [hSnap, sSnap, wSnap, mSnap, dSnap] = await Promise.all([
        getDocs(hQ), getDocs(sQ), getDocs(wQ), getDocs(mQ), getDocs(dQ)
      ]);

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
            workoutCategory: workout,
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

      <section className="bg-bg-secondary border border-bg-tertiary rounded-2xl p-6 space-y-5">
        <h2 className="text-xs font-semibold tracking-[0.25em] uppercase text-accent-teal border-b border-bg-tertiary pb-4">Progressive Overload</h2>
        {exerciseData.length ? (
          <div className="space-y-3">
            {exerciseData.map(exercise => (
              <div key={exercise.name} className="flex items-center gap-3 border-b border-bg-tertiary pb-4 last:border-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-text-primary">{exercise.name}</div>
                  <div className="text-[10px] uppercase tracking-widest text-text-tertiary">{exercise.thisMonth.toFixed(1)} kg weighted intensity this month</div>
                </div>
                <div className={`text-xs ${exercise.changePct !== null && exercise.changePct >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                  {exercise.changePct === null ? '—' : `${exercise.changePct >= 0 ? '▲' : '▼'} ${Math.abs(exercise.changePct).toFixed(0)}%`}
                </div>
                <div className="w-24 h-8">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={exercise.sessions}>
                      <Line type="monotone" dataKey="intensity" stroke="#5a9e8f" strokeWidth={1.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-xs text-text-tertiary">Log structured exercises on the Log tab to track progressive overload here.</p>}
      </section>

      {loading ? (
        <div className="text-center text-text-tertiary py-10 animate-pulse text-xs tracking-widest uppercase">Loading...</div>
      ) : Object.keys(groupedLogs).length === 0 ? (
        <div className="text-center text-text-tertiary py-10 text-xs tracking-widest uppercase">No entries found.</div>
      ) : (
        <div className="space-y-4">
          {Object.entries(
            Object.values(groupedLogs).reduce((acc: any, log: any) => {
              const [year, month] = log.date.split('-');
              const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1);
              const monthStr = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
              if (!acc[monthStr]) acc[monthStr] = [];
              acc[monthStr].push(log);
              return acc;
            }, {})
          ).map(([monthStr, logs]: [string, any]) => (
            <div key={monthStr} className="space-y-5">
              <h2 className="text-xs font-semibold tracking-[0.25em] uppercase text-text-tertiary mt-8 mb-5 border-b border-bg-tertiary pb-3">{monthStr}</h2>
              {logs.map((log: any) => (
            <div key={log.date} className="bg-bg-secondary border border-bg-tertiary rounded-2xl overflow-hidden transition-all">
              <button 
                onClick={() => setExpandedDate(expandedDate === log.date ? null : log.date)}
                className="w-full p-5 flex items-center justify-between text-left focus:outline-none"
              >
                <span className="text-sm font-semibold tracking-widest uppercase">{log.date}</span>
                <span className="text-text-tertiary">{expandedDate === log.date ? '−' : '+'}</span>
              </button>
              
              {expandedDate === log.date && (
                <div className="px-5 pb-5 space-y-7 text-sm text-text-secondary border-t border-bg-tertiary pt-5">
                  
                  {log.daily?.goals && (
                    <div>
                      <h3 className="text-[10px] text-accent-amber uppercase tracking-[2px] mb-2 font-semibold">Goals</h3>
                      <ul className="list-disc pl-4 space-y-1">
                        {log.daily.goals.map((g: any, i: number) => {
                          const text = typeof g === 'string' ? g : g.text;
                          const done = typeof g === 'string' ? false : g.done;
                          return text?.trim() ? (
                            <li key={i} className={done ? 'line-through text-text-tertiary' : ''}>{text}</li>
                          ) : null;
                        })}
                      </ul>
                    </div>
                  )}

                  {log.mood && log.mood.mood && (
                    <div>
                      <h3 className="text-[10px] text-accent-teal uppercase tracking-[2px] mb-2 font-semibold">Mood</h3>
                      <div><strong className="text-text-primary font-medium">Feeling:</strong> {log.mood.mood}</div>
                    </div>
                  )}

                  {log.health && (
                    <div>
                      <h3 className="text-[10px] text-accent-teal uppercase tracking-[2px] mb-2 font-semibold">Health</h3>
                      {log.health.weight ? <div><strong className="text-text-primary font-medium">Weight:</strong> {log.health.weight} kg</div> : null}
                      {log.health.sleepHours ? <div><strong className="text-text-primary font-medium">Sleep:</strong> {log.health.sleepHours} hours</div> : null}
                      {log.health.water ? <div><strong className="text-text-primary font-medium">Water:</strong> {log.health.water} glasses</div> : null}
                      {log.health.steps ? <div><strong className="text-text-primary font-medium">Steps:</strong> {log.health.steps}</div> : null}
                      {log.health.screenTime ? <div><strong className="text-text-primary font-medium">Screen time:</strong> {log.health.screenTime} hours</div> : null}
                      {log.health.workoutCategory ? <div><strong className="text-text-primary font-medium">Workout:</strong> {log.health.workoutCategory}</div> : null}
                      {log.health.workoutNotes ? <div className="whitespace-pre-wrap"><strong className="text-text-primary font-medium">Notes:</strong><br/>{log.health.workoutNotes}</div> : null}
                      {log.health.foodHealthy?.length > 0 ? <div><strong className="text-text-primary font-medium">Healthy Food:</strong> {log.health.foodHealthy.join(', ')}</div> : null}
                      {log.health.foodJunk?.length > 0 ? <div><strong className="text-text-primary font-medium">Junk Food:</strong> {log.health.foodJunk.join(', ')}</div> : null}
                      {log.health.foodOut?.length > 0 ? <div><strong className="text-text-primary font-medium">Eating Out:</strong> {log.health.foodOut.join(', ')}</div> : null}
                      {log.health.exercises?.length > 0 ? <div><strong className="text-text-primary font-medium">Exercises:</strong> {log.health.exercises.map((exercise: any) => `${exercise.name} ${exercise.weight}kg · ${exercise.sets}×${exercise.reps}`).join(', ')}</div> : null}
                    </div>
                  )}
                  
                  {log.study && (
                    <div>
                      <h3 className="text-[10px] text-accent-amber uppercase tracking-[2px] mb-2 font-semibold">Study</h3>
                      {log.study.practiceHours ? <div><strong className="text-text-primary font-medium">Practice Hours:</strong> {log.study.practiceHours}</div> : null}
                      {log.study.schoolNotes ? <div className="whitespace-pre-wrap"><strong className="text-text-primary font-medium">School Notes:</strong><br/>{log.study.schoolNotes}</div> : null}
                      {log.study.learningNotes ? <div className="whitespace-pre-wrap"><strong className="text-text-primary font-medium">Learning Notes:</strong><br/>{log.study.learningNotes}</div> : null}
                    </div>
                  )}

                  {log.work && (
                    <div>
                      <h3 className="text-[10px] text-accent-red uppercase tracking-[2px] mb-2 font-semibold">Work</h3>
                      {log.work.workNotes ? <div className="whitespace-pre-wrap"><strong className="text-text-primary font-medium">Work Notes:</strong><br/>{log.work.workNotes}</div> : null}
                      {log.work.networkNotes ? <div className="whitespace-pre-wrap"><strong className="text-text-primary font-medium">Network Notes:</strong><br/>{log.work.networkNotes}</div> : null}
                      {log.work.workEnjoyment ? <div><strong className="text-text-primary font-medium">Work enjoyment:</strong> {log.work.workEnjoyment}/5</div> : null}
                    </div>
                  )}
                  
                  {!log.health && !log.study && !log.work && !log.mood && !log.daily && (
                    <div className="text-text-tertiary text-xs italic">No specific details logged for this date.</div>
                  )}
                </div>
              )}
            </div>
                  ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
