import { motion } from 'framer-motion';

import { useExamConfigs } from '@/hooks/use-exam-configs';
import { useExamContext } from '@/hooks/use-exam-context';
import { examConfigService } from '@/lib/services/exam-config-service';

import { Button } from './ui/button';

interface GreetingProps {
  selectedModel?: string;
}

export const Greeting = ({ selectedModel }: GreetingProps) => {
  const { readyToStartExam, examStarted } = useExamContext();
  const { configs } = useExamConfigs();

  // Hide greeting if exam has started
  if (examStarted) {
    return null;
  }

  const getGreetingContent = () => {
    // Check if selectedModel is a valid exam ID
    if (selectedModel) {
      const examConfig =
        configs[selectedModel] ||
        examConfigService.getExamConfigurationSync(selectedModel);

      if (examConfig) {
        return {
          title: `Welcome to ${examConfig.name} Exam Simulator`,
          subtitle:
            examConfig.messagesConfig.welcomeMessage?.split('\n')[0] ||
            `${examConfig.name} examination and evaluation system`,
          buttonText: examConfig.controlsConfig.startButtonText || 'Start now',
        };
      }
    }

    // Default for non-exam models or no model selected
    return {
      title: 'Hello there!',
      subtitle: 'How can I help you today?',
      buttonText: null,
    };
  };

  const { title, subtitle, buttonText } = getGreetingContent();

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
      {buttonText && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ delay: 0.7 }}
          className="text-sm text-zinc-500 mt-4 max-w-2xl flex justify-center"
        >
          <Button
            className="flex items-center gap-1 rounded-full"
            onClick={() => {
              if (selectedModel) {
                readyToStartExam(selectedModel);
              }
            }}
          >
            {buttonText}
          </Button>
        </motion.div>
      )}
    </div>
  );
};
