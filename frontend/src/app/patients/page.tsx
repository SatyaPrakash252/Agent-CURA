'use client';

import React, { useEffect, useState } from 'react';
import PatientList from '../../components/patients/PatientList';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { API_BASE_URL } from '../../lib/constants';
import type { PatientResponse, ConsultationResult } from '../../types';

export default function PatientsPage() {
  const [patients, setPatients] = useState<PatientResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientResponse | null>(null);
  const [history, setHistory] = useState<ConsultationResult[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [form, setForm] = useState({ patient_id: '', name: '', age: '', gender: '', contact: '', notes: '' });

  const fetchPatients = async (search = '') => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/patients?search=${encodeURIComponent(search)}&limit=50`);
      if (res.ok) setPatients(await res.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchPatients(); }, []);

  const handleAdd = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/patients`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, age: form.age ? parseInt(form.age) : null }),
      });
      if (res.ok) { setShowModal(false); setForm({ patient_id: '', name: '', age: '', gender: '', contact: '', notes: '' }); fetchPatients(); }
    } catch (err) { console.error(err); }
  };

  const handleSelectPatient = async (patient: PatientResponse) => {
    setSelectedPatient(patient);
    setHistoryLoading(true);
    try { const res = await fetch(`${API_BASE_URL}/api/patients/${patient.patient_id}/history`); if (res.ok) setHistory(await res.json()); }
    catch { setHistory([]); }
    setHistoryLoading(false);
  };

  return (
    <div className="space-y-5 animate-in">
      <PatientList patients={patients} isLoading={loading} onSearch={(q) => fetchPatients(q)} onAddNew={() => setShowModal(true)} onSelectPatient={handleSelectPatient} />

      {selectedPatient && (
        <div className="surface p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-medium text-white">History: {selectedPatient.name || selectedPatient.patient_id}</p>
              <Badge variant="info" label={selectedPatient.patient_id} size="sm" />
            </div>
            <button onClick={() => setSelectedPatient(null)} className="text-[#52525b] hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          {historyLoading ? (
            <p className="text-[12px] text-[#71717a] py-4 text-center">Loading…</p>
          ) : history.length === 0 ? (
            <p className="text-[12px] text-[#71717a] py-4 text-center">No consultations found</p>
          ) : (
            <div className="space-y-2">
              {history.map((c: any, i: number) => (
                <div key={i} className="p-3 rounded-md bg-[#09090b] border border-white/[0.04] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#52525b] font-mono">{(c.created_at || '—').slice(0, 16).replace('T', ' ')}</span>
                    <Badge variant={c.confidence_score >= 80 ? 'success' : 'warning'} label={`${c.confidence_score || 0}%`} size="sm" />
                  </div>
                  <p className="text-[12px] text-[#a1a1aa]"><span className="text-white font-medium">Assessment:</span> {c.soap_assessment || c.soap?.assessment || '—'}</p>
                  <p className="text-[12px] text-[#a1a1aa]"><span className="text-white font-medium">Plan:</span> {c.soap_plan || c.soap?.plan || '—'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add patient" size="md"
        footer={<><Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button><Button variant="primary" onClick={handleAdd} disabled={!form.patient_id}>Create</Button></>}
      >
        <div className="space-y-3">
          {[
            { key: 'patient_id', label: 'Patient ID *', ph: 'PAT-XXXX' },
            { key: 'name', label: 'Full name', ph: 'John Doe' },
            { key: 'age', label: 'Age', ph: '25', type: 'number' },
            { key: 'gender', label: 'Gender', ph: 'Male / Female / Other' },
            { key: 'contact', label: 'Contact', ph: 'Phone or email' },
            { key: 'notes', label: 'Notes', ph: 'Additional notes…' },
          ].map((f) => (
            <div key={f.key}>
              <label className="text-[11px] text-[#71717a] font-medium mb-1 block">{f.label}</label>
              <input type={f.type || 'text'} placeholder={f.ph}
                value={form[f.key as keyof typeof form]}
                onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                className="input" />
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
