const parseDate = (d) => {
  const [day, monthStr] = d.split('-');
  const months = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
  const m = months[monthStr];
  const dd = day.padStart(2, '0');
  return `2026-${m}-${dd}`;
}
console.log(parseDate('17-Feb'));
console.log(parseDate('1-Mar'));
