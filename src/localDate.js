// "YYYY-MM-DD" for a Date on this phone's own calendar. Use it instead of
// date.toISOString().slice(0, 10), which is the UTC date: after 6 pm in
// Chicago (4 pm in California) that's already tomorrow, so a purchase made
// on the evening of Dec 31 would land in the next year.
export function localIso(d = new Date()) {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
