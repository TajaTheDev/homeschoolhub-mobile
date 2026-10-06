import type {
  CumulativeTranscriptData,
  TranscriptData,
  TranscriptSubjectRow,
  TranscriptYearSection,
  TranscriptSectionSummary,
} from '@/lib/fetchTranscriptData';
import { format, parseISO } from 'date-fns';
import { printToFileAsync } from 'expo-print';

const GRADE_NOT_RECORDED_LABEL = 'Grade not recorded';

type GenerateTranscriptPdfParams = {
  studentFullName: string;
  schoolName: string;
  gradeLevel: string;
  startDate: string;
  endDate: string;
  data: TranscriptData;
};

export type GenerateCumulativeTranscriptPdfParams = {
  studentFullName: string;
  schoolName: string;
  data: CumulativeTranscriptData;
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

function transcriptStyles(): string {
  return `
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
        .year-section {
          margin-bottom: 36px;
        }
        .year-section:last-of-type {
          margin-bottom: 0;
        }
        .section-heading {
          font-size: 16px;
          font-weight: 700;
          margin-bottom: 4px;
        }
        .section-dates {
          font-size: 13px;
          margin-bottom: 12px;
          color: #333333;
        }
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
  `;
}

function renderSubjectTable(
  subjects: TranscriptSubjectRow[],
  summary: TranscriptSectionSummary,
  emptyMessage: string
): string {
  const tableRows =
    subjects.length > 0
      ? subjects
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
          <td colspan="4" class="empty-row">${escapeHtml(emptyMessage)}</td>
        </tr>
      `;

  const weightedDisplay = summary.weightedAverage ?? '—';

  return `
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
            <td class="col-center">${summary.totalLessons}</td>
            <td class="col-center">${escapeHtml(weightedDisplay)}</td>
          </tr>
        </tbody>
      </table>
  `;
}

function formatSectionHeading(section: TranscriptYearSection): string {
  const label = section.label.trim();
  const grade = section.gradeLevel?.trim();
  if (grade) {
    return `${escapeHtml(grade)} — ${escapeHtml(label)}`;
  }
  return `${escapeHtml(GRADE_NOT_RECORDED_LABEL)} — ${escapeHtml(label)}`;
}

function formatSectionDateRange(section: TranscriptYearSection): string {
  const start = section.startDate?.trim();
  const end = section.endDate?.trim();

  if (start && end) {
    return `${formatDisplayDate(start)} – ${formatDisplayDate(end)}`;
  }
  if (start && section.isCurrentYear) {
    return `${formatDisplayDate(start)} – Present`;
  }
  if (start) {
    return formatDisplayDate(start);
  }
  if (end) {
    return formatDisplayDate(end);
  }
  return '—';
}

function computeDocumentYearSpan(sections: TranscriptYearSection[]): string {
  if (sections.length === 0) {
    return 'All recorded years';
  }

  const startDates = sections
    .map((section) => section.startDate?.trim())
    .filter((value): value is string => Boolean(value));
  const endDates = sections
    .map((section) => {
      if (section.endDate?.trim()) {
        return section.endDate.trim();
      }
      if (section.isCurrentYear) {
        return format(new Date(), 'yyyy-MM-dd');
      }
      return null;
    })
    .filter((value): value is string => Boolean(value));

  if (startDates.length === 0 && endDates.length === 0) {
    return 'All recorded years';
  }

  const earliest = startDates.reduce((min, value) => (value < min ? value : min));
  const latest = endDates.reduce((max, value) => (value > max ? value : max));

  return `${formatDisplayDate(earliest)} – ${formatDisplayDate(latest)}`;
}

function renderCertification(resolvedSchoolName: string, generatedDate: string): string {
  return `
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
  `;
}

/** Legacy single date-range transcript (used by export until Step 6). */
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

  const tableHtml = renderSubjectTable(
    data.subjects,
    data.summary,
    'No academic records for this period.'
  );

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>${transcriptStyles()}</style>
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

      ${tableHtml}

      ${renderCertification(resolvedSchoolName, generatedDate)}
    </body>
    </html>
  `;

  const { uri } = await printToFileAsync({ html });
  return uri;
}

/**
 * Cumulative transcript: one block per school year section (oldest → newest).
 */
export async function generateCumulativeTranscriptPdf({
  studentFullName,
  schoolName,
  data,
}: GenerateCumulativeTranscriptPdfParams): Promise<string> {
  const resolvedSchoolName = schoolName.trim() || 'Home Academy';
  const generatedDate = format(new Date(), 'MMMM d, yyyy');
  const yearSpan = computeDocumentYearSpan(data.sections);

  const sectionsHtml =
    data.sections.length > 0
      ? data.sections
          .map((section) => {
            const emptyMessage = section.isCurrentYear
              ? 'No academic records for the current school year yet.'
              : 'No academic records for this school year.';
            return `
        <div class="year-section">
          <div class="section-heading">${formatSectionHeading(section)}</div>
          <div class="section-dates">${escapeHtml(formatSectionDateRange(section))}</div>
          ${renderSubjectTable(section.subjects, section.summary, emptyMessage)}
        </div>
      `;
          })
          .join('')
      : `
        <div class="year-section">
          <div class="section-heading">${escapeHtml(GRADE_NOT_RECORDED_LABEL)} — No recorded school years</div>
          ${renderSubjectTable([], { totalLessons: 0, weightedAverage: null }, 'No academic records on file.')}
        </div>
      `;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>${transcriptStyles()}</style>
    </head>
    <body>
      <div class="school-name">${escapeHtml(resolvedSchoolName)}</div>
      <div class="doc-label">Academic Transcript (Cumulative)</div>

      <div class="meta-block">
        <div class="meta-line"><span class="meta-label">Student:</span> ${escapeHtml(studentFullName)}</div>
        <div class="meta-line"><span class="meta-label">Years Covered:</span> ${escapeHtml(yearSpan)}</div>
        <div class="meta-line"><span class="meta-label">Date Generated:</span> ${generatedDate}</div>
      </div>

      ${sectionsHtml}

      ${renderCertification(resolvedSchoolName, generatedDate)}
    </body>
    </html>
  `;

  const { uri } = await printToFileAsync({ html });
  return uri;
}
