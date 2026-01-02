import { printToFileAsync } from 'expo-print';
import { format } from 'date-fns';

interface GenerateReportCardParams {
  student: any;
  lessons: any[];
  attendance: any[];
  startDate: string;
  endDate: string;
}

export const generateReportCard = async ({
  student,
  lessons,
  attendance,
  startDate,
  endDate,
}: GenerateReportCardParams) => {
  
  // Filter lessons for this student in date range
  const studentLessons = lessons.filter(lesson => 
    lesson.student_id === student.id &&
    lesson.date >= startDate &&
    lesson.date <= endDate
  );
  
  // Get graded lessons
  const gradedLessons = studentLessons.filter(l => l.grade_value);
  
  // Calculate stats by subject
  const subjectStats: Record<string, any> = {};
  
  studentLessons.forEach(lesson => {
    if (!subjectStats[lesson.subject]) {
      subjectStats[lesson.subject] = {
        total: 0,
        completed: 0,
        graded: 0,
        grades: [],
      };
    }
    
    subjectStats[lesson.subject].total++;
    if (lesson.completed) subjectStats[lesson.subject].completed++;
    if (lesson.grade_value) {
      subjectStats[lesson.subject].graded++;
      subjectStats[lesson.subject].grades.push({
        type: lesson.grade_type,
        value: lesson.grade_value,
        maxPoints: lesson.grade_max_points,
      });
    }
  });
  
  // Calculate attendance
  const studentAttendance = attendance.filter(a => 
    a.student_id === student.id &&
    a.date >= startDate &&
    a.date <= endDate
  );
  
  const presentCount = studentAttendance.filter(a => a.present).length;
  const totalDays = studentAttendance.length;
  const attendancePercent = totalDays > 0 
    ? Math.round((presentCount / totalDays) * 100) 
    : 0;
  
  // Generate HTML
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
          padding: 40px;
          background: white;
          color: #1f2937;
        }
        
        .header {
          text-align: center;
          margin-bottom: 40px;
          padding-bottom: 20px;
          border-bottom: 3px solid #8b5cf6;
        }
        
        .title {
          font-size: 32px;
          font-weight: bold;
          color: #8b5cf6;
          margin-bottom: 8px;
        }
        
        .subtitle {
          font-size: 18px;
          color: #6b7280;
        }
        
        .student-info {
          background: #f3f4f6;
          padding: 20px;
          border-radius: 12px;
          margin-bottom: 30px;
        }
        
        .student-name {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 8px;
        }
        
        .period {
          font-size: 14px;
          color: #6b7280;
        }
        
        .section {
          margin-bottom: 30px;
        }
        
        .section-title {
          font-size: 20px;
          font-weight: bold;
          margin-bottom: 16px;
          color: #8b5cf6;
          padding-bottom: 8px;
          border-bottom: 2px solid #e5e7eb;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        
        th {
          background: #f9fafb;
          padding: 12px;
          text-align: left;
          font-weight: 600;
          border-bottom: 2px solid #e5e7eb;
        }
        
        td {
          padding: 12px;
          border-bottom: 1px solid #f3f4f6;
        }
        
        .grade-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 6px;
          font-weight: bold;
          font-size: 14px;
        }
        
        .grade-a { background: #d1fae5; color: #065f46; }
        .grade-b { background: #dbeafe; color: #1e40af; }
        .grade-c { background: #fef3c7; color: #92400e; }
        .grade-d { background: #fed7aa; color: #9a3412; }
        .grade-f { background: #fee2e2; color: #991b1b; }
        .grade-pass { background: #d1fae5; color: #065f46; }
        .grade-fail { background: #fee2e2; color: #991b1b; }
        
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 20px;
        }
        
        .stat-card {
          background: #f9fafb;
          padding: 16px;
          border-radius: 8px;
          text-align: center;
        }
        
        .stat-value {
          font-size: 28px;
          font-weight: bold;
          color: #8b5cf6;
          margin-bottom: 4px;
        }
        
        .stat-label {
          font-size: 12px;
          color: #6b7280;
          text-transform: uppercase;
        }
        
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 2px solid #e5e7eb;
          text-align: center;
          color: #9ca3af;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">Homeschool Report Card</div>
        <div class="subtitle">Academic Progress Report</div>
      </div>
      
      <div class="student-info">
        <div class="student-name">${student.name}</div>
        <div class="period">
          ${student.grade ? `Grade: ${student.grade} • ` : ''}
          Period: ${format(new Date(startDate), 'MMM d')} - ${format(new Date(endDate), 'MMM d, yyyy')}
        </div>
      </div>
      
      <!-- Overall Stats -->
      <div class="section">
        <div class="section-title">Summary</div>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${studentLessons.length}</div>
            <div class="stat-label">Total Lessons</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${gradedLessons.length}</div>
            <div class="stat-label">Graded</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${attendancePercent}%</div>
            <div class="stat-label">Attendance</div>
          </div>
        </div>
      </div>
      
      <!-- Subject Breakdown -->
      <div class="section">
        <div class="section-title">Subject Performance</div>
        <table>
          <thead>
            <tr>
              <th>Subject</th>
              <th>Lessons</th>
              <th>Completed</th>
              <th>Average Grade</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(subjectStats).map(([subject, stats]: [string, any]) => {
              const completionRate = stats.total > 0 
                ? Math.round((stats.completed / stats.total) * 100)
                : 0;
              
              // Calculate average grade
              let avgGrade = 'N/A';
              if (stats.grades.length > 0) {
                const letterGrades = stats.grades.filter((g: any) => g.type === 'letter');
                const percentGrades = stats.grades.filter((g: any) => g.type === 'percentage');
                
                if (letterGrades.length > 0) {
                  // Most common letter grade
                  const gradeCounts: Record<string, number> = {};
                  letterGrades.forEach((g: any) => {
                    gradeCounts[g.value] = (gradeCounts[g.value] || 0) + 1;
                  });
                  avgGrade = Object.entries(gradeCounts)
                    .sort((a, b) => b[1] - a[1])[0][0];
                } else if (percentGrades.length > 0) {
                  const avg = percentGrades.reduce((sum: number, g: any) => 
                    sum + parseInt(g.value), 0) / percentGrades.length;
                  avgGrade = Math.round(avg) + '%';
                }
              }
              
              const gradeClass = avgGrade.length === 1 
                ? `grade-${avgGrade.toLowerCase()}` 
                : '';
              
              return `
                <tr>
                  <td><strong>${subject}</strong></td>
                  <td>${stats.total}</td>
                  <td>${stats.completed} (${completionRate}%)</td>
                  <td>
                    ${avgGrade !== 'N/A' 
                      ? `<span class="grade-badge ${gradeClass}">${avgGrade}</span>`
                      : avgGrade
                    }
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      
      <!-- Attendance Detail -->
      <div class="section">
        <div class="section-title">Attendance</div>
        <table>
          <tr>
            <td><strong>Days Present:</strong></td>
            <td>${presentCount}</td>
          </tr>
          <tr>
            <td><strong>Days Absent:</strong></td>
            <td>${totalDays - presentCount}</td>
          </tr>
          <tr>
            <td><strong>Total Days:</strong></td>
            <td>${totalDays}</td>
          </tr>
          <tr>
            <td><strong>Attendance Rate:</strong></td>
            <td><strong>${attendancePercent}%</strong></td>
          </tr>
        </table>
      </div>
      
      <div class="footer">
        Generated on ${format(new Date(), 'MMMM d, yyyy')} • HomeschoolHub
      </div>
    </body>
    </html>
  `;
  
  // Generate PDF
  const { uri } = await printToFileAsync({ html });
  
  return uri;
};

