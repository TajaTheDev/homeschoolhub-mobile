import Colors from '@/constants/Colors';

export interface GradeDisplay {
  display: string;
  color: string;
  backgroundColor: string;
}

export const getGradeDisplay = (
  gradeType?: string | null,
  gradeValue?: string | null,
  gradeMaxPoints?: number | null
): GradeDisplay | null => {
  if (!gradeType || !gradeValue) return null;

  switch (gradeType) {
    case 'letter':
      return {
        display: gradeValue,
        color: getLetterGradeColor(gradeValue),
        backgroundColor: getLetterGradeBackground(gradeValue),
      };

    case 'percentage':
      const percentage = parseInt(gradeValue);
      return {
        display: `${gradeValue}%`,
        color: getPercentageColor(percentage),
        backgroundColor: getPercentageBackground(percentage),
      };

    case 'pass_fail':
      return {
        display: gradeValue,
        color: gradeValue === 'Pass' ? '#10B981' : '#EF4444',
        backgroundColor: gradeValue === 'Pass' ? '#D1FAE5' : '#FEE2E2',
      };

    case 'points':
      if (gradeMaxPoints) {
        const percentage = (parseInt(gradeValue) / gradeMaxPoints) * 100;
        return {
          display: `${gradeValue}/${gradeMaxPoints}`,
          color: getPercentageColor(percentage),
          backgroundColor: getPercentageBackground(percentage),
        };
      }
      return {
        display: `${gradeValue} pts`,
        color: Colors.brand[700],
        backgroundColor: Colors.brand[100],
      };

    case 'custom':
      return {
        display: gradeValue,
        color: Colors.brand[700],
        backgroundColor: Colors.brand[100],
      };

    default:
      return null;
  }
};

const getLetterGradeColor = (grade: string): string => {
  switch (grade.toUpperCase()) {
    case 'A': return '#10B981'; // Green
    case 'B': return '#3B82F6'; // Blue
    case 'C': return '#F59E0B'; // Amber
    case 'D': return '#EF4444'; // Red
    case 'F': return '#991B1B'; // Dark red
    default: return Colors.ui.text;
  }
};

const getLetterGradeBackground = (grade: string): string => {
  switch (grade.toUpperCase()) {
    case 'A': return '#D1FAE5';
    case 'B': return '#DBEAFE';
    case 'C': return '#FEF3C7';
    case 'D': return '#FEE2E2';
    case 'F': return '#FEE2E2';
    default: return Colors.ui.backgroundLight;
  }
};

const getPercentageColor = (percentage: number): string => {
  if (percentage >= 90) return '#10B981'; // A - Green
  if (percentage >= 80) return '#3B82F6'; // B - Blue
  if (percentage >= 70) return '#F59E0B'; // C - Amber
  if (percentage >= 60) return '#EF4444'; // D - Red
  return '#991B1B'; // F - Dark red
};

const getPercentageBackground = (percentage: number): string => {
  if (percentage >= 90) return '#D1FAE5';
  if (percentage >= 80) return '#DBEAFE';
  if (percentage >= 70) return '#FEF3C7';
  if (percentage >= 60) return '#FEE2E2';
  return '#FEE2E2';
};

