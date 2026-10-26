// Durable, inspectable exports. JSON keeps the complete evidence package; CSV is a flat index for review and spreadsheets.
export function evidencePayload(project, exportedAt = new Date().toISOString()) {
  return { format: 'plotcloud-simulation-evidence', schema: 1, exportedAt,
    project: { id: project.id, name: project.name, analysisOnly: !!project.analysisOnly },
    versions: project.versions.map((v) => ({ id: v.id, number: v.n, note: v.note, created: v.created, analysisModel: v.model?.analysisModel || null })),
    runs: project.runs };
}

const csvCell = (x) => `"${String(x ?? '').replace(/"/g, '""')}"`;
export function resultsCsv(project) {
  const rows = [['run_id', 'created', 'version', 'simulation', 'level', 'settings', 'figures', 'source_file', 'source_fingerprint', 'analysis_model', 'limitations']];
  for (const r of project.runs) { const v = project.versions.find((x) => x.id === r.versionId), input = r.input || {};
    rows.push([r.id, r.created, v ? `v${v.n}` : r.versionId, r.simId, input.level || r.settings?.level || 'all', JSON.stringify(r.settings || {}), JSON.stringify(r.results?.kpis || []),
      input.modelSource?.name || '', input.modelSource?.fingerprint || '', input.analysisModelId || '', JSON.stringify(input.readiness?.limits || [])]); }
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}
