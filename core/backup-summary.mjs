export function backupSummary(state) {
  const counts = {};
  for (const key of ['materials','lots','patterns','projects','purchases','movements','attachments']) counts[key] = state[key].length;
  counts.revisions = state.patterns.reduce((total, pattern) => total + (pattern.revisions?.length || 0), 0);
  counts.drafts = state.patterns.filter(pattern => pattern.draft).length;
  counts.catalogueCharts = Object.values(state.settings.preferences?.chartCollection || {}).filter(record => record.owned).length;
  return counts;
}
