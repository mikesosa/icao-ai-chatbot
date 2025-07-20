import { motion } from 'framer-motion';

import { useExamContext } from '@/hooks/use-exam-context';
import { MODEL_IDS } from '@/lib/types';

import { Button } from './ui/button';

interface GreetingProps {
  selectedModel?: string;
}

export const Greeting = ({
  selectedModel = MODEL_IDS.CHAT_MODEL,
}: GreetingProps) => {
  const { readyToStartExam, examType } = useExamContext();

  // Hide greeting if exam type is set
  if (examType) {
    return null;
  }

  const getGreetingContent = () => {
    switch (selectedModel) {
      case MODEL_IDS.TEA_EVALUATOR:
        return {
          title: 'Welcome to TEA Exam Simulator',
          subtitle:
            'Test of English for Aviation (TEA) exam is about to begin.',
          description: 'Start now',
        };
      case MODEL_IDS.ELPAC_EVALUATOR:
        return {
          title: 'Welcome to ELPAC Exam Simulator',
          subtitle:
            'English Language Proficiency Assessment for Aviation (ELPAC)',
          description: 'Start now',
        };
      default:
        return {
          title: 'Hello there!',
          subtitle: 'How can I help you today?',
          description: null,
        };
    }
  };

  const { title, subtitle, description } = getGreetingContent();

  return (
    <div
      key="overview"
      className="max-w-3xl mx-auto md:mt-20 px-8 size-full flex flex-col justify-center text-center"
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.5 }}
        className="text-2xl font-semibold"
      >
        {title}
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.6 }}
        className="text-2xl text-zinc-500"
      >
        {subtitle}
      </motion.div>
      {description && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ delay: 0.7 }}
          className="text-sm text-zinc-500 mt-4 max-w-2xl flex justify-center"
        >
          <Button
            className="flex items-center gap-1 rounded-full"
            onClick={() => readyToStartExam(selectedModel)}
          >
            {description}
          </Button>
        </motion.div>
      )}
    </div>
  );
};
