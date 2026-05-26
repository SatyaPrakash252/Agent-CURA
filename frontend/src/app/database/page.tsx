'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Badge from '../../components/ui/Badge';
import Loader from '../../components/ui/Loader';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { ToastContainer } from '../../components/ui/Toast';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../hooks/useAuth'; // updated ref
import { API_V1 } from '../../lib/constants';

interface DBTable {
  name: string;
  rows: number;
  mode: string;
}

export default function DatabaseExplorerPage() {
  const { user } = useAuth();
  const { toasts, dismissToast, success: toastSuccess, error: toastError, info: toastInfo } = useToast();

  const [tables, setTables] = useState<DBTable[]>([]);
  const [activeTable, setActiveTable] = useState<string>('patients');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tablesLoading, setTablesLoading] = useState(true);
  
  // Search & Filters
  const [search, setSearch] = useState('');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  
  // Modals
  const [deleteTarget, setDeleteTarget] = useState<{ table: string; id: any } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [jsonViewerData, setJsonViewerData] = useState<{ title: string; json: any } | null>(null);

  // Fetch Tables Metadata
  const fetchTables = async () => {
    try {
      const token = localStorage.getItem('cura_token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_V1}/database/tables`, { headers });
      if (res.ok) {
        setTables(await res.json());
      }
    } catch (err) {
      console.error('Failed to load tables metadata:', err);
    } finally {
      setTablesLoading(false);
    }
  };

  // Fetch Table Rows
  const fetchTableRows = async (tableName: string) => {
    setLoading(true);
    setExpandedRowId(null);
    try {
      const token = localStorage.getItem('cura_token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_V1}/database/tables/${tableName}?limit=100`, { headers });
      if (res.ok) {
        setRows(await res.json());
      } else {
        setRows([]);
        toastError(`Failed to fetch records: ${res.statusText}`);
      }
    } catch (err) {
      console.error(err);
      setRows([]);
      toastError('Network error reading database table.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  useEffect(() => {
    if (activeTable) {
      fetchTableRows(activeTable);
    }
  }, [activeTable]);

  // Handle Deletion
  const handleDeleteRow = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const token = localStorage.getItem('cura_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_V1}/database/tables/${deleteTarget.table}/${deleteTarget.id}`, {
        method: 'DELETE',
        headers,
      });

      if (res.ok) {
        toastSuccess('Record evicted successfully!');
        setDeleteTarget(null);
        fetchTables();
        fetchTableRows(activeTable);
      } else {
        const err = await res.json();
        toastError(err.detail || 'Access denied. Administrator rights required.');
      }
    } catch (err) {
      console.error(err);
      toastError('Error connecting to database eviction pipeline.');
    } finally {
      setDeleting(false);
    }
  };

  // Safe JSON extraction
  const viewJson = (title: string, rawVal: any) => {
    let parsed = rawVal;
    if (typeof rawVal === 'string') {
      try {
        parsed = JSON.parse(rawVal);
      } catch {
        parsed = { text: rawVal };
      }
    }
    setJsonViewerData({ title, json: parsed });
  };

  // Filtered Rows for display search
  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => {
      return Object.values(r).some((v) => {
        if (v == null) return false;
        if (typeof v === 'object') return JSON.stringify(v).toLowerCase().includes(q);
        return String(v).toLowerCase().includes(q);
      });
    });
  }, [rows, search]);

  const activeTableMetadata = tables.find((t) => t.name === activeTable);

  return (
    <div className="space-y-6 animate-in">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Header and overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-[13px] text-[var(--text-muted)] font-medium mb-1.5 uppercase tracking-wider">Management</p>
          <h1 className="text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">Database Explorer</h1>
          <p className="text-[12.5px] text-[var(--text-secondary)] mt-1">
            Verified Clinical Sandbox Mode &bull; Database Type: <span className="font-mono text-[#6366f1] font-semibold">{activeTableMetadata?.mode || 'SQLite / Supabase Fallback'}</span>
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { fetchTables(); fetchTableRows(activeTable); }}>
          🔄 Refresh tables
        </Button>
      </div>

      {/* Tables sidebar + Grid row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Table selector sidebar */}
        <div className="lg:col-span-3 space-y-2">
          <p className="text-[11px] text-[var(--text-muted)] font-bold uppercase tracking-wider px-2">Data Tables</p>
          {tablesLoading ? (
            <div className="p-4"><Loader text="Loading metadata…" /></div>
          ) : (
            <div className="flex flex-col gap-1">
              {tables.map((t) => {
                const active = t.name === activeTable;
                return (
                  <button
                    key={t.name}
                    onClick={() => setActiveTable(t.name)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between transition-all duration-150 border ${
                      active
                        ? 'bg-[var(--bg-hover)] border-[var(--border-hover)] text-white font-semibold shadow-sm'
                        : 'border-transparent text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)]/30'
                    }`}
                  >
                    <span className="text-[13.5px] capitalize">{t.name.replace('_', ' ')}</span>
                    <Badge variant={active ? 'info' : 'neutral'} label={String(t.rows)} size="sm" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Data list view */}
        <div className="lg:col-span-9 space-y-4">
          {/* Controls header */}
          <div className="flex items-center gap-3 surface px-4 py-3">
            <svg className="w-4 h-4 text-[#52525b] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder={`Filter through ${activeTableMetadata?.rows || 0} columns...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input flex-1 bg-transparent border-0 p-0 text-[13.5px]"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-[11.5px] text-[#71717a] hover:text-white">Clear</button>
            )}
          </div>

          {/* Table Container */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden shadow-sm">
            {loading ? (
              <div className="py-20 text-center">
                <Loader variant="ring" text={`Querying ${activeTable.replace('_', ' ')}...`} />
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="py-16 text-center text-[var(--text-muted)] space-y-1">
                <p className="text-[14px] font-medium">No rows found</p>
                <p className="text-[12px]">The queried table is empty or has been filtered completely.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-[var(--bg-raised)] text-[var(--text-muted)] font-semibold uppercase text-[10px] tracking-wider border-b border-[var(--border)]">
                      <th className="py-3 px-4 w-12 text-center">ID</th>
                      {activeTable === 'patients' && (
                        <>
                          <th className="py-3 px-4">Patient ID</th>
                          <th className="py-3 px-4">Name</th>
                          <th className="py-3 px-4">Age / Gender</th>
                          <th className="py-3 px-4">Contact</th>
                        </>
                      )}
                      {activeTable === 'consultations' && (
                        <>
                          <th className="py-3 px-4">Patient ID</th>
                          <th className="py-3 px-4">Assessment / Plan</th>
                          <th className="py-3 px-4 text-center">Score</th>
                          <th className="py-3 px-4">Created At</th>
                        </>
                      )}
                      {activeTable === 'audio_recordings' && (
                        <>
                          <th className="py-3 px-4">Session ID</th>
                          <th className="py-3 px-4">Patient ID</th>
                          <th className="py-3 px-4">Audio URL</th>
                          <th className="py-3 px-4">Duration</th>
                        </>
                      )}
                      {activeTable === 'users' && (
                        <>
                          <th className="py-3 px-4">Username</th>
                          <th className="py-3 px-4">Full Name</th>
                          <th className="py-3 px-4">Role</th>
                          <th className="py-3 px-4">Expertise</th>
                        </>
                      )}
                      {activeTable === 'audit_log' && (
                        <>
                          <th className="py-3 px-4">Operator</th>
                          <th className="py-3 px-4">Action</th>
                          <th className="py-3 px-4">Target Resource</th>
                          <th className="py-3 px-4">Details</th>
                        </>
                      )}
                      {activeTable === 'fhir_transmissions' && (
                        <>
                          <th className="py-3 px-4">Session ID</th>
                          <th className="py-3 px-4">Patient ID</th>
                          <th className="py-3 px-4 text-center">Status</th>
                          <th className="py-3 px-4">Transmitted At</th>
                        </>
                      )}
                      <th className="py-3 px-4 text-right w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {filteredRows.map((r, index) => {
                      const id = r.id;
                      const expanded = expandedRowId === String(id);
                      return (
                        <React.Fragment key={id || index}>
                          <tr className={`hover:bg-[var(--bg-hover)]/30 transition-colors ${expanded ? 'bg-[var(--bg-hover)]/20' : ''}`}>
                            <td className="py-3.5 px-4 text-center font-mono text-[11px] text-[var(--text-muted)]">{id || '—'}</td>
                            
                            {/* Patients Columns */}
                            {activeTable === 'patients' && (
                              <>
                                <td className="py-3.5 px-4 font-mono font-semibold text-white">{r.patient_id}</td>
                                <td className="py-3.5 px-4 font-medium text-white">{r.name || '—'}</td>
                                <td className="py-3.5 px-4 text-[var(--text-secondary)]">
                                  {r.age != null ? `${r.age} yrs` : '—'} &bull; <span className="capitalize">{r.gender || 'unknown'}</span>
                                </td>
                                <td className="py-3.5 px-4 font-mono text-[12px] text-[var(--text-secondary)]">{r.contact || '—'}</td>
                              </>
                            )}

                            {/* Consultations Columns */}
                            {activeTable === 'consultations' && (
                              <>
                                <td className="py-3.5 px-4 font-mono font-semibold text-white">{r.patient_id || '—'}</td>
                                <td className="py-3.5 px-4 max-w-[280px] truncate" title={r.soap_assessment || r.assessment}>
                                  <span className="font-semibold text-white">A:</span> {r.soap_assessment || r.assessment || '—'}
                                </td>
                                <td className="py-3.5 px-4 text-center">
                                  {r.confidence_score != null ? (
                                    <Badge variant={r.confidence_score >= 80 ? 'success' : 'warning'} label={`${r.confidence_score}%`} size="sm" />
                                  ) : '—'}
                                </td>
                                <td className="py-3.5 px-4 text-[var(--text-muted)] font-mono text-[11px]">
                                  {r.created_at?.slice(0, 16).replace('T', ' ') || '—'}
                                </td>
                              </>
                            )}

                            {/* Audio Recordings Columns */}
                            {activeTable === 'audio_recordings' && (
                              <>
                                <td className="py-3.5 px-4 font-mono text-[11px] truncate max-w-[120px]" title={r.session_id}>{r.session_id}</td>
                                <td className="py-3.5 px-4 font-mono font-semibold text-white">{r.patient_id}</td>
                                <td className="py-3.5 px-4 truncate max-w-[180px] font-mono text-[11px] text-[var(--text-secondary)]" title={r.file_url}>
                                  {r.file_url || '—'}
                                </td>
                                <td className="py-3.5 px-4 font-semibold text-white">
                                  {r.duration_seconds != null ? `${r.duration_seconds.toFixed(1)}s` : '—'}
                                </td>
                              </>
                            )}

                            {/* Users Columns */}
                            {activeTable === 'users' && (
                              <>
                                <td className="py-3.5 px-4 font-mono font-semibold text-white">{r.username}</td>
                                <td className="py-3.5 px-4 font-medium text-white">{r.full_name || '—'}</td>
                                <td className="py-3.5 px-4">
                                  <Badge variant={r.role === 'admin' ? 'danger' : 'info'} label={r.role || 'doctor'} size="sm" />
                                </td>
                                <td className="py-3.5 px-4 text-[var(--text-secondary)]">{r.expertise || '—'}</td>
                              </>
                            )}

                            {/* Audit Log Columns */}
                            {activeTable === 'audit_log' && (
                              <>
                                <td className="py-3.5 px-4 font-semibold text-white">{r.username || 'system'}</td>
                                <td className="py-3.5 px-4 font-mono text-[12px] text-indigo-400">{r.action}</td>
                                <td className="py-3.5 px-4 font-mono text-[11px] text-[var(--text-secondary)]">
                                  {r.resource_type ? `${r.resource_type} : ${r.resource_id || '—'}` : '—'}
                                </td>
                                <td className="py-3.5 px-4">
                                  <button onClick={() => viewJson('Audit Details', r.details)} className="text-[11.5px] text-[#6366f1] hover:underline">
                                    View JSON
                                  </button>
                                </td>
                              </>
                            )}

                            {/* FHIR Transmissions Columns */}
                            {activeTable === 'fhir_transmissions' && (
                              <>
                                <td className="py-3.5 px-4 font-mono text-[11px] truncate max-w-[120px]" title={r.session_id}>{r.session_id}</td>
                                <td className="py-3.5 px-4 font-mono font-semibold text-white">{r.patient_id}</td>
                                <td className="py-3.5 px-4 text-center">
                                  <Badge variant={r.status === 'transmitted' ? 'success' : 'warning'} label={r.status || 'pending'} size="sm" />
                                </td>
                                <td className="py-3.5 px-4 text-[var(--text-muted)] font-mono text-[11px]">
                                  {r.transmitted_at?.slice(0, 16).replace('T', ' ') || '—'}
                                </td>
                              </>
                            )}

                            {/* Actions column */}
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex justify-end items-center gap-2">
                                <button
                                  onClick={() => setExpandedRowId(expanded ? null : String(id))}
                                  className="p-1 text-[#71717a] hover:text-white hover:bg-white/[0.04] rounded transition-colors"
                                  title="Inspect JSON row"
                                >
                                  <svg className={`w-4 h-4 transform transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                                {user?.role === 'admin' && (
                                  <button
                                    onClick={() => setDeleteTarget({ table: activeTable, id: id })}
                                    className="p-1 text-[#a1a1aa] hover:text-red-400 hover:bg-red-500/5 rounded transition-colors"
                                    title="Delete database row"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Expanded row JSON View */}
                          {expanded && (
                            <tr>
                              <td colSpan={10} className="bg-[var(--bg-raised)]/30 border-t border-b border-[var(--border)] px-6 py-4">
                                <div className="space-y-3 animate-in">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11.5px] text-[var(--text-muted)] font-mono font-bold uppercase tracking-wider">Raw Database Payload</span>
                                    <Button variant="ghost" size="sm" onClick={() => viewJson(`Row ${id} Details`, r)}>
                                      🖥️ Open in Modal Viewer
                                    </Button>
                                  </div>
                                  <pre className="text-[11.5px] font-mono p-3.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] overflow-x-auto text-[#a1a1aa] leading-relaxed max-h-[250px] overflow-y-auto">
                                    {JSON.stringify(r, null, 2)}
                                  </pre>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* JSON Viewer Modal */}
      <Modal
        isOpen={jsonViewerData !== null}
        onClose={() => setJsonViewerData(null)}
        title={jsonViewerData?.title || 'Data Inspector'}
        size="lg"
      >
        {jsonViewerData && (
          <div className="space-y-4">
            <pre className="text-[12px] font-mono p-4 rounded-lg bg-[var(--bg-base)] border border-[var(--border)] overflow-auto text-[#a1a1aa] leading-relaxed max-h-[500px]">
              {JSON.stringify(jsonViewerData.json, null, 2)}
            </pre>
            <div className="flex justify-end">
              <Button variant="primary" onClick={() => setJsonViewerData(null)}>Close Viewer</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Eviction Confirmation Modal */}
      <Modal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Confirm Eviction"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteRow} disabled={deleting}>
              {deleting ? 'Evicting…' : 'Evict Record'}
            </Button>
          </>
        }
      >
        {deleteTarget && (
          <div className="space-y-3">
            <p className="text-[13.5px] text-[var(--text-secondary)] leading-relaxed">
              Are you sure you want to permanently delete row <span className="font-mono text-white font-semibold">#{deleteTarget.id}</span> from the <span className="font-mono text-white capitalize">{deleteTarget.table.replace('_', ' ')}</span> database?
            </p>
            <p className="text-[11.5px] text-[#f87171] leading-relaxed font-semibold">
              ⚠️ Warning: This eviction is irreversible and may cause orphan logs or reference issues.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
