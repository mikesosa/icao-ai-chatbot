import { useContext } from 'react';

import { ExamContext } from '@/contexts/exam-context';

export const useExamContext = () => {
  const context = useContext(ExamContext);
  if (!context) {
    throw new Error('useExamContext must be used within an ExamProvider');
  }
  return context;
};
