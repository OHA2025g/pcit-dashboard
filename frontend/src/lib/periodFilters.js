/** First period strictly after `base` in chronological order (array order). */
export function firstPeriodAfter(periods, base) {
  const list = periods || [];
  const idx = list.indexOf(base);
  if (idx < 0) return list[0] || null;
  return list[idx + 1] || null;
}

/** Base period and every earlier period — invalid for Latest. */
export function periodsAtOrBefore(periods, base) {
  const list = periods || [];
  const idx = list.indexOf(base);
  if (idx < 0) return base ? [base] : [];
  return list.slice(0, idx + 1);
}

/** Keep Latest strictly after Base; otherwise bump to the next valid period. */
export function clampLatestToBase(periods, base, latest) {
  const list = periods || [];
  const baseIdx = list.indexOf(base);
  const latestIdx = list.indexOf(latest);
  if (baseIdx < 0) return latest;
  if (latestIdx > baseIdx) return latest;
  return firstPeriodAfter(list, base) || latest;
}
