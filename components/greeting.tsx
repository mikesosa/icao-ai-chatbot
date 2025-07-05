import { motion } from 'framer-motion';
import { Phone } from 'lucide-react';
import { Button } from './ui/button';

interface GreetingProps {
  selectedModel?: string;
}

export const Greeting = ({ selectedModel = 'chat-model' }: GreetingProps) => {
  const getGreetingContent = () => {
    switch (selectedModel) {
      case 'tea-evaluator':
        return {
          title: 'Welcome to TEA Exam Simulator',
          subtitle:
            'Test of English for Aviation (TEA) exam is about to begin.',
          description: 'Start now',
        };
      case 'elpac-evaluator':
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
          <Button className="flex items-center gap-1 rounded-full">
            {description}
          </Button>
        </motion.div>
      )}
    </div>
  );
};
