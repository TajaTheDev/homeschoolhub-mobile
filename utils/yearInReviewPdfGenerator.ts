import type { YearInReviewData } from '@/lib/fetchPdfExportData';
import { format, parseISO } from 'date-fns';
import { printToFileAsync } from 'expo-print';

const BRAND_500 = '#A78BFA';
const BRAND_400 = '#B8A4E8';
const BRAND_700 = '#7E22CE';
const BRAND_50 = '#F5F3FF';
const WARM_BG = '#FAF6F0';
const JOURNAL_BG = '#FFFBF5';
const TEXT = '#2D3748';
const TEXT_LIGHT = '#718096';

const GRADE_GREEN = '#10B981';
const GRADE_GREEN_BG = '#D1FAE5';
const GRADE_TEAL = '#0D9488';
const GRADE_TEAL_BG = '#CCFBF1';
const GRADE_AMBER = '#D97706';
const GRADE_AMBER_BG = '#FEF3C7';
const GRADE_RED = '#DC2626';
const GRADE_RED_BG = '#FEE2E2';
const GRADE_GRAY = '#6B7280';
const GRADE_GRAY_BG = '#F3F4F6';

type GenerateYearInReviewParams = {
  studentName: string;
  startDate: string;
  endDate: string;
  data: YearInReviewData;
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
    return format(parseISO(dateString), 'MMM d, yyyy');
  } catch {
    return dateString;
  }
}

function formatShortDate(dateString: string): string {
  try {
    return format(parseISO(dateString), 'MMM d');
  } catch {
    return dateString;
  }
}

function getGradeBadgeStyle(grade: string): { color: string; background: string } {
  const normalized = grade.trim().toUpperCase();
  const letter = normalized.charAt(0);

  if (letter === 'A') {
    return { color: GRADE_GREEN, background: GRADE_GREEN_BG };
  }
  if (letter === 'B') {
    return { color: GRADE_TEAL, background: GRADE_TEAL_BG };
  }
  if (letter === 'C') {
    return { color: GRADE_AMBER, background: GRADE_AMBER_BG };
  }
  if (letter === 'D' || letter === 'F') {
    return { color: GRADE_RED, background: GRADE_RED_BG };
  }
  return { color: GRADE_GRAY, background: GRADE_GRAY_BG };
}

function renderGradeBadge(grade: string): string {
  const style = getGradeBadgeStyle(grade);
  return `<span class="grade-pill" style="color:${style.color};background:${style.background};">${escapeHtml(grade)}</span>`;
}

function renderInlineThumbnails(photos: YearInReviewData['photoHighlights']): string {
  if (photos.length === 0) return '';
  return `
    <div class="inline-thumbs">
      ${photos
        .map(
          (photo) => `
        <img class="inline-thumb" src="${escapeHtml(photo.url)}" alt="Lesson photo" />
      `
        )
        .join('')}
    </div>
  `;
}

function renderStars(rating: number | null): string {
  if (!rating) return '';
  const filled = '★'.repeat(Math.min(5, Math.max(1, rating)));
  const empty = '☆'.repeat(5 - filled.length);
  return `<span class="stars">${filled}${empty}</span>`;
}

export async function generateYearInReviewPdf({
  studentName,
  startDate,
  endDate,
  data,
}: GenerateYearInReviewParams): Promise<string> {
  const year = parseISO(endDate).getFullYear();
  const rangeLabel = `${formatDisplayDate(startDate)} – ${formatDisplayDate(endDate)}`;

  const subjectSectionsHtml =
    data.subjectSections.length > 0
      ? data.subjectSections
          .map((section) => {
            const curriculumLine = section.curriculumName
              ? `<p class="curriculum-name">${escapeHtml(section.curriculumName)}</p>`
              : '';

            const monthsHtml = section.months
              .map((month) => {
                const lessonsHtml = month.lessons
                  .map((lesson) => {
                    const gradeHtml = lesson.grade ? renderGradeBadge(lesson.grade) : '';
                    const thumbsHtml = renderInlineThumbnails(lesson.photos);
                    return `
                      <div class="lesson-row">
                        <span class="lesson-date-col">${formatShortDate(lesson.date)}</span>
                        <div class="lesson-body">
                          <div class="lesson-title-row">
                            <span class="lesson-title">${escapeHtml(lesson.title)}</span>
                            ${gradeHtml}
                          </div>
                          ${thumbsHtml}
                        </div>
                      </div>
                    `;
                  })
                  .join('');

                return `
                  <div class="month-block">
                    <h3 class="month-heading">${escapeHtml(month.monthLabel)}</h3>
                    <div class="lesson-list">${lessonsHtml}</div>
                  </div>
                `;
              })
              .join('');

            return `
              <div class="subject-section">
                <h2 class="section-heading">${escapeHtml(section.subject)}</h2>
                ${curriculumLine}
                ${monthsHtml}
              </div>
            `;
          })
          .join('')
      : '';

  const consistencyHtml = `
    <div class="page-section consistency-section">
      <h2 class="section-heading">Consistency</h2>
      <div class="streak-hero">
        <div class="streak-emoji">🔥</div>
        <div class="streak-value">${data.consistency.longestStreak}</div>
        <div class="streak-label">Longest Streak — consecutive school days</div>
      </div>
      <div class="consistency-grid">
        <div class="consistency-card">
          <div class="consistency-emoji">📅</div>
          <div class="consistency-num">${data.consistency.schoolDays}</div>
          <div class="consistency-text">Total school days</div>
        </div>
        <div class="consistency-card">
          <div class="consistency-emoji">📚</div>
          <div class="consistency-num">${data.consistency.busiestMonth ? escapeHtml(data.consistency.busiestMonth) : '—'}</div>
          <div class="consistency-text">Busiest month${data.consistency.busiestMonthCount > 0 ? ` (${data.consistency.busiestMonthCount} lessons)` : ''}</div>
        </div>
        <div class="consistency-card">
          <div class="consistency-emoji">📷</div>
          <div class="consistency-num">${data.consistency.photosTaken}</div>
          <div class="consistency-text">Photos taken</div>
        </div>
      </div>
    </div>
  `;

  const gradesSummaryHtml =
    data.gradesSummary.length > 0
      ? `
        <div class="page-section">
          <h2 class="section-heading">Grades Summary</h2>
          <table class="grades-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Lessons Graded</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>
              ${data.gradesSummary
                .map(
                  (row) => `
                <tr>
                  <td><strong>${escapeHtml(row.subject)}</strong></td>
                  <td>${row.gradedCount}</td>
                  <td>${escapeHtml(row.display)}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `
      : '';

  const booksHtml =
    data.finishedBooks.length > 0
      ? `
        <div class="page-section">
          <h2 class="section-heading">Books Read</h2>
          <div class="book-list">
            ${data.finishedBooks
              .map((book) => {
                const author = book.author ? escapeHtml(book.author) : '';
                const dateLine = book.date_finished
                  ? formatDisplayDate(book.date_finished)
                  : '';
                return `
                  <div class="book-row">
                    <div class="book-main">
                      <span class="book-title">${escapeHtml(book.title)}</span>
                      ${author ? `<span class="book-author">by ${author}</span>` : ''}
                    </div>
                    <div class="book-meta">
                      ${book.rating ? renderStars(book.rating) : ''}
                      ${dateLine ? `<span class="book-date">${dateLine}</span>` : ''}
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>
      `
      : '';

  const photoHighlightsHtml =
    data.photoHighlights.length > 0
      ? `
        <div class="page-section">
          <h2 class="section-heading">Photo Highlights</h2>
          <div class="photo-grid">
            ${data.photoHighlights
              .map(
                (photo) => `
              <div class="photo-cell">
                <img src="${escapeHtml(photo.url)}" alt="Lesson photo" />
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      `
      : '';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Quicksand', Arial, sans-serif;
          background: white;
          color: ${TEXT};
          line-height: 1.5;
        }
        .cover {
          background: linear-gradient(135deg, ${BRAND_400} 0%, ${BRAND_500} 55%, ${BRAND_700} 100%);
          color: white;
          padding: 56px 40px;
          text-align: center;
          border-radius: 0 0 24px 24px;
          margin-bottom: 32px;
        }
        .cover-eyebrow {
          font-size: 13px;
          letter-spacing: 2px;
          text-transform: uppercase;
          opacity: 0.9;
          margin-bottom: 12px;
        }
        .cover-student {
          font-size: 36px;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .cover-title {
          font-size: 22px;
          font-weight: 600;
          margin-bottom: 10px;
        }
        .cover-range {
          font-size: 15px;
          opacity: 0.92;
          margin-bottom: 20px;
        }
        .cover-app {
          font-size: 13px;
          opacity: 0.85;
        }
        .content { padding: 0 32px 40px; }
        .stats-bar {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 36px;
        }
        .stat-card {
          background: ${BRAND_50};
          border: 2px solid ${BRAND_400};
          border-radius: 14px;
          padding: 16px 8px;
          text-align: center;
        }
        .stat-value {
          font-size: 28px;
          font-weight: 800;
          color: ${BRAND_700};
          line-height: 1.1;
          margin-bottom: 4px;
        }
        .stat-label {
          font-size: 9px;
          font-weight: 700;
          color: ${TEXT_LIGHT};
          text-transform: uppercase;
          letter-spacing: 0.4px;
          line-height: 1.3;
        }
        .page-section { margin-bottom: 32px; }
        .section-heading {
          font-size: 20px;
          font-weight: 700;
          color: ${BRAND_700};
          margin-bottom: 14px;
          padding-bottom: 8px;
          border-bottom: 3px solid ${BRAND_400};
        }
        .consistency-section { page-break-inside: avoid; }
        .streak-hero {
          text-align: center;
          background: linear-gradient(180deg, ${BRAND_50} 0%, white 100%);
          border: 3px solid ${BRAND_400};
          border-radius: 20px;
          padding: 28px 20px;
          margin-bottom: 20px;
        }
        .streak-emoji { font-size: 36px; margin-bottom: 8px; }
        .streak-value {
          font-size: 56px;
          font-weight: 900;
          color: ${BRAND_700};
          line-height: 1;
          margin-bottom: 8px;
        }
        .streak-label {
          font-size: 14px;
          font-weight: 600;
          color: ${TEXT_LIGHT};
        }
        .consistency-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }
        .consistency-card {
          background: ${JOURNAL_BG};
          border: 2px solid ${BRAND_400};
          border-radius: 14px;
          padding: 16px 10px;
          text-align: center;
        }
        .consistency-emoji { font-size: 22px; margin-bottom: 6px; }
        .consistency-num {
          font-size: 22px;
          font-weight: 800;
          color: ${BRAND_700};
          margin-bottom: 4px;
        }
        .consistency-text {
          font-size: 11px;
          font-weight: 600;
          color: ${TEXT_LIGHT};
          line-height: 1.3;
        }
        .subject-section {
          margin-bottom: 28px;
          page-break-inside: avoid;
        }
        .curriculum-name {
          font-size: 14px;
          color: ${TEXT_LIGHT};
          font-style: italic;
          margin-bottom: 14px;
        }
        .month-block {
          background: ${JOURNAL_BG};
          border: 1px solid #EDE9FE;
          border-radius: 14px;
          padding: 14px 16px;
          margin-bottom: 16px;
        }
        .month-heading {
          font-size: 15px;
          font-weight: 700;
          color: ${BRAND_700};
          margin-bottom: 12px;
          letter-spacing: 0.3px;
        }
        .lesson-list { display: flex; flex-direction: column; gap: 10px; }
        .lesson-row {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 10px 12px;
          background: white;
          border-radius: 10px;
          border-left: 4px solid ${BRAND_400};
          box-shadow: 0 1px 4px rgba(167, 139, 250, 0.12);
        }
        .lesson-date-col {
          font-size: 12px;
          font-weight: 700;
          color: ${BRAND_700};
          min-width: 48px;
          padding-top: 2px;
        }
        .lesson-body { flex: 1; min-width: 0; }
        .lesson-title-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
        }
        .lesson-title { font-weight: 600; font-size: 14px; }
        .grade-pill {
          display: inline-block;
          font-size: 11px;
          font-weight: 800;
          padding: 3px 10px;
          border-radius: 999px;
          letter-spacing: 0.3px;
        }
        .inline-thumbs {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 8px;
        }
        .inline-thumb {
          width: 60px;
          height: 60px;
          object-fit: cover;
          border-radius: 8px;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
        }
        .grades-table {
          width: 100%;
          border-collapse: collapse;
          background: ${JOURNAL_BG};
          border-radius: 12px;
          overflow: hidden;
        }
        .grades-table th {
          background: ${BRAND_50};
          padding: 12px 14px;
          text-align: left;
          font-size: 12px;
          font-weight: 700;
          color: ${BRAND_700};
          text-transform: uppercase;
          letter-spacing: 0.4px;
          border-bottom: 2px solid ${BRAND_400};
        }
        .grades-table td {
          padding: 12px 14px;
          font-size: 14px;
          border-bottom: 1px solid #EDE9FE;
        }
        .grades-table tr:last-child td { border-bottom: none; }
        .book-list { display: flex; flex-direction: column; gap: 10px; }
        .book-row {
          padding: 12px 14px;
          background: ${WARM_BG};
          border-radius: 10px;
        }
        .book-title { font-weight: 600; font-size: 15px; display: block; }
        .book-author { font-size: 13px; color: ${TEXT_LIGHT}; display: block; margin-top: 2px; }
        .book-meta { margin-top: 6px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .stars { color: #F59E0B; font-size: 14px; letter-spacing: 1px; }
        .book-date { font-size: 12px; color: ${BRAND_700}; font-weight: 600; }
        .photo-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        .photo-cell {
          aspect-ratio: 1;
          overflow: hidden;
          border-radius: 12px;
          background: ${BRAND_50};
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        .photo-cell img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 12px;
        }
        .footer {
          margin-top: 40px;
          padding-top: 16px;
          border-top: 2px solid ${BRAND_50};
          text-align: center;
          font-size: 11px;
          color: ${TEXT_LIGHT};
        }
      </style>
    </head>
    <body>
      <div class="cover">
        <div class="cover-eyebrow">HomeschoolHub</div>
        <div class="cover-student">${escapeHtml(studentName)}</div>
        <div class="cover-title">Year in Review ${year}</div>
        <div class="cover-range">${rangeLabel}</div>
        <div class="cover-app">A celebration of learning</div>
      </div>

      <div class="content">
        <div class="stats-bar">
          <div class="stat-card">
            <div class="stat-value">${data.stats.lessonsCompleted}</div>
            <div class="stat-label">Lessons Completed</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${data.stats.subjectsCovered}</div>
            <div class="stat-label">Subjects Covered</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${data.stats.schoolDays}</div>
            <div class="stat-label">School Days Logged</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${data.stats.booksRead}</div>
            <div class="stat-label">Books Read</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">🔥 ${data.stats.longestStreak}</div>
            <div class="stat-label">Longest Streak</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">📷 ${data.stats.photosTaken}</div>
            <div class="stat-label">Photos Taken</div>
          </div>
        </div>

        ${consistencyHtml}

        ${
          subjectSectionsHtml
            ? `<div class="page-section"><h2 class="section-heading">Learning by Subject</h2>${subjectSectionsHtml}</div>`
            : ''
        }
        ${gradesSummaryHtml}
        ${booksHtml}
        ${photoHighlightsHtml}

        <div class="footer">
          Generated on ${format(new Date(), 'MMMM d, yyyy')} · HomeschoolHub
        </div>
      </div>
    </body>
    </html>
  `;

  const { uri } = await printToFileAsync({ html });
  return uri;
}
