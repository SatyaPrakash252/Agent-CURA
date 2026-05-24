'use client';

import type { ConsultationResult, SpeakerSegment } from '../types';

interface ReportData {
  patientId: string;
  sessionId: string;
  date: string;
  segments: SpeakerSegment[];
  result: ConsultationResult | null;
}

type RGB = [number, number, number];
const fill = (doc: any, c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
const textC = (doc: any, c: RGB) => doc.setTextColor(c[0], c[1], c[2]);

/**
 * Extract medication lines from the SOAP Plan section.
 * Looks for patterns like drug names, dosages, frequencies.
 */
function extractMedicationsFromPlan(plan: string): { drug: string; instruction: string }[] {
  if (!plan) return [];
  const lines = plan.split(/\n|(?:\d+\.\s)/).filter(l => l.trim());
  const meds: { drug: string; instruction: string }[] = [];
  const medKeywords = /prescri|medicat|mg|mcg|tablet|capsule|oral|inject|topical|qhs|bid|tid|qid|prn|daily|twice|thrice|once/i;
  for (const line of lines) {
    const trimmed = line.trim().replace(/^[-•*]\s*/, '');
    if (medKeywords.test(trimmed)) {
      const parts = trimmed.split(/[-–:]/, 2);
      meds.push({
        drug: parts[0]?.trim() || trimmed,
        instruction: parts[1]?.trim() || trimmed,
      });
    }
  }
  return meds;
}

export async function generateReport(data: ReportData): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const W = 210;
  const M = 18;
  const CW = W - 2 * M;
  let y = 0;

  const INDIGO: RGB = [99, 102, 241];
  const DARK: RGB = [15, 15, 20];
  const WHITE: RGB = [255, 255, 255];
  const GRAY: RGB = [140, 140, 155];

  const checkPage = (need: number) => { if (y + need > 280) { doc.addPage(); y = 20; } };

  // Get actual data from result or use placeholder text
  const soap = data.result?.soap || {
    subjective: 'No data available — consultation not finalized.',
    objective: 'No objective data recorded.',
    assessment: 'No assessment generated.',
    plan: 'No plan generated.',
  };
  const confidence = data.result?.confidence_score ?? 0;
  const billingCodes = data.result?.billing_codes || [];
  const intents = data.result?.intents || [];
  const safetyFlags = data.result?.safety_flags || [];

  // === HEADER ===
  fill(doc, DARK); doc.rect(0, 0, W, 44, 'F');
  fill(doc, INDIGO); doc.rect(0, 44, W, 2, 'F');

  doc.setFont('helvetica', 'bold'); doc.setFontSize(22); textC(doc, WHITE);
  doc.text('Project Cura', M, 20);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); textC(doc, GRAY);
  doc.text('AI Clinical Documentation System — Consultation Report', M, 28);
  doc.text(data.date, W - M, 20, { align: 'right' });
  doc.text(`Session: ${data.sessionId.slice(0, 24)}`, W - M, 28, { align: 'right' });

  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); textC(doc, WHITE);
  doc.text('CLINICAL CONSULTATION REPORT', M, 38);
  y = 54;

  // === PATIENT INFO BOX ===
  doc.setFillColor(245, 245, 250); doc.roundedRect(M, y, CW, 22, 3, 3, 'F');
  doc.setDrawColor(220, 220, 235); doc.roundedRect(M, y, CW, 22, 3, 3, 'S');

  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(100, 100, 120);
  doc.text('PATIENT ID', M + 6, y + 8);
  doc.text('DATE', M + 55, y + 8);
  doc.text('CONFIDENCE', M + 110, y + 8);
  doc.text('SEGMENTS', M + 150, y + 8);

  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(30, 30, 40);
  doc.text(data.patientId, M + 6, y + 17);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.text(data.date, M + 55, y + 17);
  doc.setFont('helvetica', 'bold'); textC(doc, INDIGO);
  doc.text(`${confidence}%`, M + 110, y + 17);
  doc.setTextColor(30, 30, 40);
  doc.text(`${data.segments.length}`, M + 150, y + 17);
  y += 30;

  // === SOAP NOTE (from real AI) ===
  const soapSections: { key: string; label: string; text: string; color: RGB }[] = [
    { key: 'S', label: 'SUBJECTIVE', text: soap.subjective, color: [79, 70, 229] },
    { key: 'O', label: 'OBJECTIVE', text: soap.objective, color: [34, 197, 94] },
    { key: 'A', label: 'ASSESSMENT', text: soap.assessment, color: [245, 158, 11] },
    { key: 'P', label: 'PLAN', text: soap.plan, color: [99, 102, 241] },
  ];

  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(30, 30, 40);
  doc.text('SOAP Note', M, y);
  fill(doc, INDIGO); doc.rect(M, y + 2, 24, 0.8, 'F');
  y += 8;

  for (const s of soapSections) {
    checkPage(30);
    fill(doc, s.color); doc.roundedRect(M, y, 7, 7, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); textC(doc, WHITE);
    doc.text(s.key, M + 2.3, y + 5.2);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(100, 100, 120);
    doc.text(s.label, M + 10, y + 3);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(50, 50, 60);
    const lines = doc.splitTextToSize(s.text || 'N/A', CW - 12);
    doc.text(lines, M + 10, y + 8);
    y += 10 + lines.length * 4.2;
  }
  y += 4;

  // === DIAGNOSIS (from real AI assessment) ===
  checkPage(35);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(30, 30, 40);
  doc.text('Diagnosis & Clinical Assessment', M, y);
  doc.setFillColor(34, 197, 94); doc.rect(M, y + 2, 48, 0.8, 'F');
  y += 10;

  doc.setFillColor(240, 253, 244); doc.roundedRect(M, y, CW, 20, 3, 3, 'F');
  doc.setDrawColor(187, 247, 208); doc.roundedRect(M, y, CW, 20, 3, 3, 'S');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(22, 101, 52);
  doc.text('PRIMARY DIAGNOSIS (AI-Generated from consultation)', M + 6, y + 7);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(30, 30, 40);
  const diagLines = doc.splitTextToSize(soap.assessment || 'No assessment', CW - 14);
  doc.text(diagLines, M + 6, y + 13);
  y += 24 + Math.max(0, (diagLines.length - 1) * 4);

  // === PRESCRIPTION (extracted from AI Plan — NOT hardcoded) ===
  const medications = extractMedicationsFromPlan(soap.plan);
  if (medications.length > 0 || intents.length > 0) {
    checkPage(40);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(30, 30, 40);
    doc.text('Prescription & Orders', M, y);
    fill(doc, INDIGO); doc.rect(M, y + 2, 34, 0.8, 'F');
    y += 10;

    // Medications from plan
    if (medications.length > 0) {
      doc.setFillColor(245, 245, 250); doc.rect(M, y, CW, 7, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(100, 100, 120);
      doc.text('MEDICATION', M + 4, y + 5);
      doc.text('INSTRUCTIONS', M + 70, y + 5);
      y += 9;

      for (const rx of medications) {
        checkPage(10);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); textC(doc, INDIGO);
        doc.text(rx.drug.slice(0, 40), M + 4, y + 4);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 60);
        const instrLines = doc.splitTextToSize(rx.instruction, CW - 74);
        doc.text(instrLines, M + 70, y + 4);
        doc.setDrawColor(230, 230, 240); doc.line(M, y + 7, M + CW, y + 7);
        y += 8 + Math.max(0, (instrLines.length - 1) * 4);
      }
      y += 4;
    }

    // Clinical intents (labs, imaging, referrals)
    if (intents.length > 0) {
      checkPage(15);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(100, 100, 120);
      doc.text('CLINICAL ORDERS', M + 4, y + 4);
      y += 7;
      for (const intent of intents) {
        checkPage(8);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); textC(doc, INDIGO);
        doc.text(`[${intent.type}]`, M + 4, y + 4);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 60);
        doc.text(intent.item, M + 30, y + 4);
        y += 6;
      }
      y += 4;
    }
  }

  // === SAFETY ALERTS (from real AI) ===
  if (safetyFlags.length > 0) {
    checkPage(20);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(30, 30, 40);
    doc.text('Safety Alerts', M, y);
    doc.setFillColor(248, 113, 113); doc.rect(M, y + 2, 22, 0.8, 'F');
    y += 10;

    for (const flag of safetyFlags) {
      checkPage(10);
      const isHigh = flag.level === 'CRITICAL';
      doc.setFillColor(isHigh ? 254 : 255, isHigh ? 226 : 251, isHigh ? 226 : 235);
      doc.roundedRect(M, y, CW, 8, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
      doc.setTextColor(isHigh ? 153 : 146, isHigh ? 27 : 64, isHigh ? 27 : 14);
      doc.text(`[${flag.level}]`, M + 3, y + 5.5);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(50, 50, 60);
      doc.text(flag.message.slice(0, 100), M + 22, y + 5.5);
      y += 10;
    }
    y += 4;
  }

  // === BILLING CODES (from real AI) ===
  if (billingCodes.length > 0) {
    checkPage(30);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(30, 30, 40);
    doc.text('Billing Codes', M, y);
    doc.setFillColor(245, 158, 11); doc.rect(M, y + 2, 22, 0.8, 'F');
    y += 10;

    for (const b of billingCodes) {
      checkPage(8);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); textC(doc, INDIGO);
      doc.text(b.code, M + 4, y + 4);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 60);
      doc.text(b.description, M + 30, y + 4);
      doc.setFontSize(7); doc.setTextColor(120, 120, 140);
      doc.text(b.code_type || '', M + CW - 22, y + 4);
      y += 7;
    }
    y += 6;
  }

  // === TRANSCRIPT ===
  if (data.segments.length > 0) {
    checkPage(20);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(30, 30, 40);
    doc.text('Consultation Transcript', M, y);
    doc.setFillColor(100, 100, 120); doc.rect(M, y + 2, 36, 0.8, 'F');
    y += 10;

    for (const seg of data.segments) {
      checkPage(12);
      const isDoc = (seg.speaker || '').toLowerCase().includes('doctor');
      const isPat = (seg.speaker || '').toLowerCase().includes('patient');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
      
      if (isDoc) {
        doc.setTextColor(99, 102, 241); // Indigo for Doctor
      } else if (isPat) {
        doc.setTextColor(16, 185, 129); // Emerald for Patient
      } else {
        doc.setTextColor(140, 140, 155); // Gray default
      }
      
      doc.text((seg.speaker || 'Unknown').toUpperCase(), M + 4, y + 4);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(70, 70, 80);
      const tl = doc.splitTextToSize(seg.text, CW - 40);
      doc.text(tl, M + 30, y + 4);
      y += 4 + tl.length * 3.8;
    }
  }

  // === DISCLAIMER ===
  checkPage(18);
  y += 4;
  doc.setFillColor(255, 251, 235); doc.roundedRect(M, y, CW, 12, 2, 2, 'F');
  doc.setDrawColor(253, 230, 138); doc.roundedRect(M, y, CW, 12, 2, 2, 'S');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(146, 64, 14);
  doc.text('IMPORTANT DISCLAIMER', M + 4, y + 5);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
  doc.text('This report was generated by AI (Groq Llama 3.3 70B). All diagnoses, prescriptions, and treatment plans MUST be reviewed and approved by a licensed physician before use.', M + 4, y + 9.5);

  // === FOOTER ===
  const pc = doc.getNumberOfPages();
  for (let p = 1; p <= pc; p++) {
    doc.setPage(p);
    fill(doc, DARK); doc.rect(0, 287, W, 10, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); textC(doc, GRAY);
    doc.text('Generated by Project Cura AI Clinical Documentation System | AI-assisted — Requires physician review', M, 293);
    doc.text(`Page ${p} of ${pc}`, W - M, 293, { align: 'right' });
    fill(doc, INDIGO); doc.rect(0, 287, W, 0.5, 'F');
  }

  // Unique filename: PatientID + Date + Time
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  doc.save(`Cura_Report_${data.patientId}_${ts}.pdf`);
}
