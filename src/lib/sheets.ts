import { getAccessToken, db, auth } from '../App';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export async function getUserSpreadsheetId(): Promise<string | null> {
  if (!auth.currentUser) return null;
  const docRef = doc(db, 'users', auth.currentUser.uid, 'settings', 'sheets');
  const snap = await getDoc(docRef);
  if (snap.exists() && snap.data().spreadsheetId) {
    return snap.data().spreadsheetId;
  }
  return null;
}

export async function createSpreadsheet(title: string): Promise<string> {
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated with Google. Please sign in again.');

  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        title: title
      }
    })
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Failed to create Google Sheet');
  }
  
  const data = await response.json();
  const spreadsheetId = data.spreadsheetId;
  
  if (auth.currentUser) {
    const docRef = doc(db, 'users', auth.currentUser.uid, 'settings', 'sheets');
    await setDoc(docRef, { spreadsheetId, createdAt: new Date() }, { merge: true });
  }
  
  return spreadsheetId;
}

export async function fetchSheetData(spreadsheetId: string, range: string) {
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated with Google. Please sign in again.');
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Failed to read sheet');
  }
  const data = await response.json();
  return data.values;
}

export async function appendToSheet(range: string, values: any[][]) {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Google Access Token not found. Please sign out and sign in again to re-authenticate with Google Sheets.');
  }

  let spreadsheetId = await getUserSpreadsheetId();
  if (!spreadsheetId) {
    // Automatically create a new comprehensive sheet if they don't have one!
    spreadsheetId = await createSpreadsheet('Log Stats - Comprehensive Tracker');
    
    // We should also initialize the headers for this new sheet
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:J1:append?valueInputOption=USER_ENTERED`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [
          ['Date', 'Goals', 'Mood', 'Weight (kg)', 'Workout Category', 'Workout Notes', 'Nutrition', 'Study Hours', 'Study Notes', 'Work & Networking']
        ]
      })
    });
  }

  try {
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Google Sheets API Error:', errorData);
      
      if (response.status === 401) {
        throw new Error('Google authentication expired. Please sign out and sign in again.');
      } else if (response.status === 403 || response.status === 404) {
        // If they deleted it or lost access, let's remove it from firestore so they can make a new one next time
        if (auth.currentUser) {
           await setDoc(doc(db, 'users', auth.currentUser.uid, 'settings', 'sheets'), { spreadsheetId: null }, { merge: true });
        }
        throw new Error('Access denied or Spreadsheet was deleted. We will create a new one for you on your next save.');
      }
      
      throw new Error(errorData.error?.message || 'Failed to sync to Sheets');
    }
  } catch (err) {
    console.error('Failed to append to Sheets:', err);
    throw err;
  }
}
