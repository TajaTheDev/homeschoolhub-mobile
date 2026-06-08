import type { ReadingLogExportData } from '@/lib/fetchPdfExportData';
import { format, parseISO } from 'date-fns';
import { printToFileAsync } from 'expo-print';

const BRAND_500 = '#A78BFA';
const BRAND_400 = '#B8A4E8';
const BRAND_200 = '#DDD6FE';
const BRAND_700 = '#7E22CE';
const BRAND_50 = '#F5F3FF';
const WARM_BG = '#FAF6F0';
const TEXT = '#2D3748';
const TEXT_LIGHT = '#718096';

type GenerateReadingLogPdfParams = {
  studentName: string;
  data: ReadingLogExportData;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDisplayDate(dateString: string | null): string {
  if (!dateString) return '';
  try {
    return format(parseISO(dateString), 'MMM d, yyyy');
  } catch {
    return dateString;
  }
}

function renderStars(rating: number | null): string {
  if (!rating) return '';
  const filled = '★'.repeat(Math.min(5, Math.max(1, rating)));
  const empty = '☆'.repeat(5 - filled.length);
  return `<span class="stars">${filled}${empty}</span>`;
}

export async function generateReadingLogPdf({
  studentName,
  data,
}: GenerateReadingLogPdfParams): Promise<string> {
  const finishedHtml =
    data.finishedBooks.length > 0
      ? data.finishedBooks
          .map((book) => {
            const author = book.author ? escapeHtml(book.author) : '';
            const notes = book.notes?.trim()
              ? `<p class="book-notes">${escapeHtml(book.notes.trim())}</p>`
              : '';
            return `
              <div class="book-card finished">
                <div class="book-header">
                  <span class="book-title">${escapeHtml(book.title)}</span>
                  ${author ? `<span class="book-author">by ${author}</span>` : ''}
                </div>
                <div class="book-meta">
                  ${book.date_finished ? `<span class="book-date">Finished ${formatDisplayDate(book.date_finished)}</span>` : ''}
                  ${book.rating ? renderStars(book.rating) : ''}
                </div>
                ${notes}
              </div>
            `;
          })
          .join('')
      : `<p class="empty-text">No books finished this year yet.</p>`;

  const readingHtml =
    data.currentlyReading.length > 0
      ? data.currentlyReading
          .map((book) => {
            const author = book.author ? escapeHtml(book.author) : '';
            const started = book.date_started
              ? `<span class="book-date">Started ${formatDisplayDate(book.date_started)}</span>`
              : '';
            return `
              <div class="book-card reading">
                <div class="book-header">
                  <span class="book-title">${escapeHtml(book.title)}</span>
                  ${author ? `<span class="book-author">by ${author}</span>` : ''}
                </div>
                ${started ? `<div class="book-meta">${started}</div>` : ''}
              </div>
            `;
          })
          .join('')
      : `<p class="empty-text">No books currently being read.</p>`;

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
        .header {
          background: linear-gradient(135deg, ${BRAND_50} 0%, white 100%);
          padding: 40px 32px 28px;
          border-bottom: 4px solid ${BRAND_400};
          text-align: center;
        }
        .header-icon { font-size: 32px; margin-bottom: 8px; }
        .header-student {
          font-size: 30px;
          font-weight: 700;
          color: ${BRAND_700};
          margin-bottom: 6px;
        }
        .header-title {
          font-size: 20px;
          font-weight: 600;
          color: ${TEXT};
        }
        .content { padding: 28px 32px 40px; }
        .stats-bar {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 32px;
        }
        .stat-card {
          background: ${BRAND_50};
          border: 2px solid ${BRAND_400};
          border-radius: 14px;
          padding: 18px 10px;
          text-align: center;
        }
        .stat-value {
          font-size: 30px;
          font-weight: 800;
          color: ${BRAND_700};
          margin-bottom: 4px;
        }
        .stat-label {
          font-size: 10px;
          font-weight: 700;
          color: ${TEXT_LIGHT};
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .section { margin-bottom: 28px; }
        .section-heading {
          font-size: 18px;
          font-weight: 700;
          color: ${BRAND_700};
          margin-bottom: 14px;
          padding-bottom: 6px;
          border-bottom: 2px solid ${BRAND_500};
        }
        .book-card {
          padding: 14px 16px;
          border-radius: 12px;
          margin-bottom: 10px;
          page-break-inside: avoid;
        }
        .book-card.finished {
          background: ${WARM_BG};
          border-left: 4px solid ${BRAND_500};
        }
        .book-card.reading {
          background: white;
          border: 2px solid ${BRAND_200};
        }
        .book-title { font-size: 16px; font-weight: 700; display: block; }
        .book-author { font-size: 13px; color: ${TEXT_LIGHT}; display: block; margin-top: 2px; }
        .book-meta {
          margin-top: 8px;
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }
        .book-date { font-size: 12px; font-weight: 600; color: ${BRAND_700}; }
        .stars { color: #F59E0B; font-size: 14px; letter-spacing: 1px; }
        .book-notes {
          margin-top: 8px;
          font-size: 13px;
          color: ${TEXT_LIGHT};
          font-style: italic;
          line-height: 1.45;
        }
        .empty-text {
          font-size: 14px;
          color: ${TEXT_LIGHT};
          font-style: italic;
          padding: 8px 0;
        }
        .footer {
          margin-top: 32px;
          padding-top: 14px;
          border-top: 2px solid ${BRAND_50};
          text-align: center;
          font-size: 11px;
          color: ${TEXT_LIGHT};
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="header-icon">📚</div>
        <div class="header-student">${escapeHtml(studentName)}</div>
        <div class="header-title">Reading Log ${data.year}</div>
      </div>

      <div class="content">
        <div class="stats-bar">
          <div class="stat-card">
            <div class="stat-value">${data.stats.total}</div>
            <div class="stat-label">Total Books</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${data.stats.finished}</div>
            <div class="stat-label">Finished</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${data.stats.currentlyReading}</div>
            <div class="stat-label">Currently Reading</div>
          </div>
        </div>

        <div class="section">
          <h2 class="section-heading">Finished Books</h2>
          ${finishedHtml}
        </div>

        <div class="section">
          <h2 class="section-heading">Currently Reading</h2>
          ${readingHtml}
        </div>

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
