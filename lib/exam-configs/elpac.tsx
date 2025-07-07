import { Mic, BookOpen, PenTool, Users } from 'lucide-react';
import type { CompleteExamConfig } from './index';

export const ELPAC_EXAM_CONFIG: CompleteExamConfig = {
  id: 'elpac',
  name: 'ELPAC',
  examConfig: {
    name: 'ELPAC',
    sections: {
      1: { name: 'Listening', duration: 30 * 60, color: 'bg-blue-500' },
      2: { name: 'Reading', duration: 45 * 60, color: 'bg-green-500' },
      3: { name: 'Writing', duration: 45 * 60, color: 'bg-purple-500' },
      4: { name: 'Speaking', duration: 20 * 60, color: 'bg-orange-500' },
    },
  },
  controlsConfig: {
    name: 'ELPAC',
    totalSections: 4,
    sections: [
      {
        number: 1,
        title: 'Listening',
        description: 'Listen to audio recordings and answer questions',
        icon: <Mic className="size-5" />,
        duration: '30 min',
      },
      {
        number: 2,
        title: 'Reading',
        description: 'Read passages and answer comprehension questions',
        icon: <BookOpen className="size-5" />,
        duration: '45 min',
      },
      {
        number: 3,
        title: 'Writing',
        description: 'Complete writing tasks and essays',
        icon: <PenTool className="size-5" />,
        duration: '45 min',
      },
      {
        number: 4,
        title: 'Speaking',
        description: 'Oral interview and speaking tasks',
        icon: <Users className="size-5" />,
        duration: '20 min',
      },
    ],
    totalDuration: '140 minutes',
    startButtonText: 'Start ELPAC Assessment',
    finishButtonText: 'Complete Assessment',
  },
  messagesConfig: {
    welcomeMessage: `Welcome to the English Language Proficiency Assessment for California (ELPAC)!

I am your certified ELPAC administrator. This assessment evaluates your English language proficiency across four domains.

**ASSESSMENT INFORMATION:**
- ⏱️ Duration: 140 minutes total
- 📋 4 sections required
- 🎯 Measures: Listening, Reading, Writing, Speaking

**INSTRUCTIONS:**
1. Use the control panel to start the assessment
2. Complete each section in order
3. Follow time limits for each section
4. Read instructions carefully before beginning

Are you ready to begin? Click "Start ELPAC Assessment" when you're prepared.`,
    sectionStartMessages: {
      1: `**SECTION 1: LISTENING** (30 minutes)

In this section, you will listen to audio recordings and answer questions about what you hear.

**Instructions:**
- Listen carefully to each recording
- You may take notes while listening
- Answer all questions based on what you hear
- Some recordings will play only once

Click "Next" when you're ready to begin the listening section.`,
      2: `**SECTION 2: READING** (45 minutes)

In this section, you will read passages and answer comprehension questions.

**Instructions:**
- Read each passage carefully
- Answer questions based on the text
- You may refer back to the passages
- Manage your time effectively

Click "Next" when you're ready to begin the reading section.`,
      3: `**SECTION 3: WRITING** (45 minutes)

In this section, you will complete writing tasks.

**Instructions:**
- Follow the writing prompts carefully
- Organize your ideas clearly
- Use proper grammar and vocabulary
- Review your work before submitting

Click "Next" when you're ready to begin the writing section.`,
      4: `**SECTION 4: SPEAKING** (20 minutes)

In this section, you will complete speaking tasks.

**Instructions:**
- Speak clearly and naturally
- Answer all parts of each question
- Use examples when appropriate
- Don't worry about minor mistakes

Click "Next" when you're ready to begin the speaking section.`,
    },
    completionMessage: `**🎉 ELPAC ASSESSMENT COMPLETED**

Congratulations! You have completed all 4 sections of the ELPAC assessment.

**ASSESSMENT SUMMARY:**
- ✅ Section 1: Listening
- ✅ Section 2: Reading  
- ✅ Section 3: Writing
- ✅ Section 4: Speaking

Your responses are now being processed. You will receive your official ELPAC score report within 7-10 business days.

**Score Levels:**
- Level 1: Beginning
- Level 2: Somewhat Developed
- Level 3: Moderately Developed
- Level 4: Well Developed

Thank you for completing the ELPAC assessment!`,
    quickInstructions: [
      'Read all instructions carefully',
      'Manage your time effectively',
      'Answer all questions completely',
      'Use examples when appropriate',
      'Stay focused throughout the assessment',
    ],
  },
};
