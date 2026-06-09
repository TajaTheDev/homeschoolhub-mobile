import type { TranscriptData } from '@/lib/fetchTranscriptData';
import { format, parseISO } from 'date-fns';
import { printToFileAsync } from 'expo-print';

type GenerateTranscriptPdfParams = {
  studentFullName: string;
  schoolName: string;
  gradeLevel: string;
  startDate: string;
  endDate: string;
  data: TranscriptData;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDisplayDate(dateString: string): string {
  try {
    return format(parseISO(dateString), 'MMMM d, yyyy');
  } catch {
    return dateString;
  }
}

function displayValue(value: string | null | undefined, fallback = '—'): string {
  const trimmed = value?.trim();
  return trimmed ? escapeHtml(trimmed) : fallback;
}

export async function generateTranscriptPdf({
  studentFullName,
  schoolName,
  gradeLevel,
  startDate,
  endDate,
  data,
}: GenerateTranscriptPdfParams): Promise<string> {
  const resolvedSchoolName = schoolName.trim() || 'Home Academy';
  const generatedDate = format(new Date(), 'MMMM d, yyyy');
  const yearRange = `${formatDisplayDate(startDate)} – ${formatDisplayDate(endDate)}`;

  const tableRows =
    data.subjects.length > 0
      ? data.subjects
          .map(
            (row, index) => `
          <tr class="${index % 2 === 0 ? 'row-even' : 'row-odd'}">
            <td>${escapeHtml(row.subject)}</td>
            <td>${displayValue(row.curriculumName)}</td>
            <td class="col-center">${row.lessonsCompleted}</td>
            <td class="col-center">${escapeHtml(row.finalGrade)}</td>
          </tr>
        `
          )
          .join('')
      : `
        <tr class="row-even">
          <td colspan="4" class="empty-row">No academic records for this period.</td>
        </tr>
      `;

  const weightedDisplay = data.summary.weightedAverage ?? '—';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Times New Roman', Times, Georgia, serif;
          background: #ffffff;
          color: #000000;
          line-height: 1.45;
          padding: 48px 56px;
        }
        .school-name {
          font-size: 28px;
          font-weight: 700;
          text-align: center;
          letter-spacing: 0.5px;
          margin-bottom: 6px;
        }
        .doc-label {
          font-size: 13px;
          text-align: center;
          text-transform: uppercase;
          letter-spacing: 2px;
          margin-bottom: 28px;
        }
        .meta-block {
          margin-bottom: 32px;
          font-size: 14px;
        }
        .meta-line { margin-bottom: 4px; }
        .meta-label { font-weight: 700; }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 0;
          font-size: 13px;
        }
        thead th {
          background: #ffffff;
          border: 1px solid #000000;
          border-bottom: 2px solid #000000;
          padding: 10px 12px;
          text-align: left;
          font-weight: 700;
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 0.5px;
        }
        tbody td {
          border: 1px solid #000000;
          padding: 9px 12px;
          vertical-align: top;
        }
        .row-even { background: #ffffff; }
        .row-odd { background: #f5f5f5; }
        .col-center { text-align: center; }
        .empty-row {
          text-align: center;
          font-style: italic;
          color: #333333;
        }
        .summary-row td {
          font-weight: 700;
          border-top: 2px solid #000000;
          background: #f0f0f0;
        }
        .certification {
          margin-top: 40px;
          font-size: 11px;
          line-height: 1.6;
          color: #000000;
        }
        .cert-text { margin-bottom: 28px; }
        .signature-block { margin-top: 32px; }
        .signature-line {
          border-bottom: 1px solid #000000;
          width: 280px;
          margin-bottom: 6px;
          height: 28px;
        }
        .signature-label {
          font-size: 11px;
        }
        .printed-date {
          margin-top: 20px;
          font-size: 11px;
        }
      </style>
    </head>
    <body>
      <div class="school-name">${escapeHtml(resolvedSchoolName)}</div>
      <div class="doc-label">Academic Transcript</div>

      <div class="meta-block">
        <div class="meta-line"><span class="meta-label">Student:</span> ${escapeHtml(studentFullName)}</div>
        ${
          gradeLevel.trim()
            ? `<div class="meta-line"><span class="meta-label">Grade Level:</span> ${escapeHtml(gradeLevel.trim())}</div>`
            : ''
        }
        <div class="meta-line"><span class="meta-label">School Year:</span> ${yearRange}</div>
        <div class="meta-line"><span class="meta-label">Date Generated:</span> ${generatedDate}</div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Subject</th>
            <th>Curriculum</th>
            <th class="col-center">Lessons Completed</th>
            <th class="col-center">Grade</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
          <tr class="summary-row">
            <td colspan="2">Total</td>
            <td class="col-center">${data.summary.totalLessons}</td>
            <td class="col-center">${escapeHtml(weightedDisplay)}</td>
          </tr>
        </tbody>
      </table>

      <div class="certification">
        <p class="cert-text">
          This transcript was generated by The Homeschool Hub.
          ${escapeHtml(resolvedSchoolName)} certifies this as an accurate record of academic work completed.
        </p>
        <div class="printed-date">Printed: ${generatedDate}</div>
        <div class="signature-block">
          <div class="signature-line"></div>
          <div class="signature-label">Parent/Guardian Signature</div>
        </div>
      </div>
    </body>
    </html>
  `;

  const { uri } = await printToFileAsync({ html });
  return uri;
}
