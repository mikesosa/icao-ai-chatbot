# Dynamic Exam Configuration System

This directory contains the configuration files for different types of exams in the chatbot system. The system is designed to be flexible and extensible, allowing you to easily add new exam types without modifying existing code.

## Overview

The exam system consists of:

- **ExamSidebar**: A dynamic sidebar component that works with any exam type
- **ExamSectionControls**: Navigation and control components for exam sections
- **ExamTimer**: Timer component for timed sections
- **Exam Configurations**: Static configuration files for different exam types

## File Structure

```
lib/exam-configs/
├── index.ts           # Main exports and utilities
├── tea.tsx           # TEA exam configuration
├── elpac.tsx         # ELPAC exam configuration
├── demo.tsx          # Usage examples
└── README.md         # This file
```

## Configuration Structure

Each exam configuration follows the `CompleteExamConfig` interface:

```typescript
export interface CompleteExamConfig {
  id: string; // Unique identifier
  name: string; // Display name
  examConfig: ExamConfig; // Timer and section config
  controlsConfig: ExamControlsConfig; // UI controls config
  messagesConfig: ExamMessagesConfig; // Chat messages config
}
```

### ExamConfig

Controls timing and basic section information:

```typescript
interface ExamConfig {
  name: string;
  sections: Record<ExamSection, ExamSectionConfig>;
}

interface ExamSectionConfig {
  name: string;
  duration: number; // in seconds
  color: string; // CSS color class
}
```

### ExamControlsConfig

Controls the UI elements and navigation:

```typescript
interface ExamControlsConfig {
  name: string;
  totalSections: number;
  sections: ExamSectionInfo[];
  totalDuration: string;
  startButtonText: string;
  finishButtonText: string;
}
```

### ExamMessagesConfig

Controls the chat messages and instructions:

```typescript
interface ExamMessagesConfig {
  welcomeMessage: string;
  sectionStartMessages: Record<ExamSection, string>;
  completionMessage: string;
  quickInstructions: string[];
}
```

## Usage Examples

### Basic Usage

```typescript
import { ExamSidebar, TEA_EXAM_CONFIG } from '@/components/exam-interface';

function MyExamPage() {
  return <ExamSidebar initialMessages={[]} examConfig={TEA_EXAM_CONFIG} />;
}
```

### Dynamic Exam Loading

```typescript
import { ExamSidebar, getExamConfigById } from '@/components/exam-interface';

function DynamicExamPage({ examType }: { examType: string }) {
  const examConfig = getExamConfigById(examType);

  if (!examConfig) {
    return <div>Exam not found</div>;
  }

  return <ExamSidebar initialMessages={[]} examConfig={examConfig} />;
}
```

## Available Exam Types

### TEA (Test de Inglés Aeronáutico)

- **ID**: `tea`
- **Sections**: 3 (Entrevista, Comprensión, Discusión)
- **Duration**: 25-30 minutes
- **Language**: Spanish
- **Purpose**: Aviation English proficiency testing

### ELPAC (English Language Proficiency Assessment)

- **ID**: `elpac`
- **Sections**: 4 (Listening, Reading, Writing, Speaking)
- **Duration**: 140 minutes
- **Language**: English
- **Purpose**: English language proficiency assessment

## Adding a New Exam Type

1. **Create the configuration file** (e.g., `toefl.tsx`):

```typescript
import { BookOpen, Headphones, PenTool, MessageCircle } from 'lucide-react';
import type { CompleteExamConfig } from './index';

export const TOEFL_EXAM_CONFIG: CompleteExamConfig = {
  id: 'toefl',
  name: 'TOEFL',
  examConfig: {
    name: 'TOEFL',
    sections: {
      1: { name: 'Reading', duration: 54 * 60, color: 'bg-blue-500' },
      2: { name: 'Listening', duration: 41 * 60, color: 'bg-green-500' },
      3: { name: 'Speaking', duration: 17 * 60, color: 'bg-purple-500' },
      4: { name: 'Writing', duration: 50 * 60, color: 'bg-orange-500' },
    },
  },
  controlsConfig: {
    name: 'TOEFL',
    totalSections: 4,
    sections: [
      {
        number: 1,
        title: 'Reading',
        description: 'Read passages and answer questions',
        icon: <BookOpen className="size-5" />,
        duration: '54 min',
      },
      // ... more sections
    ],
    totalDuration: '3 hours',
    startButtonText: 'Start TOEFL Test',
    finishButtonText: 'Complete Test',
  },
  messagesConfig: {
    welcomeMessage: 'Welcome to the TOEFL test!',
    sectionStartMessages: {
      1: 'Section 1: Reading - Read the passages carefully...',
      // ... more messages
    },
    completionMessage: 'TOEFL test completed!',
    quickInstructions: [
      'Read all instructions carefully',
      'Manage your time effectively',
    ],
  },
};
```

2. **Export in index.ts**:

```typescript
export { TOEFL_EXAM_CONFIG } from './toefl';

export const getExamConfigById = (
  id: string,
): CompleteExamConfig | undefined => {
  switch (id) {
    case 'tea':
      return require('./tea').TEA_EXAM_CONFIG;
    case 'elpac':
      return require('./elpac').ELPAC_EXAM_CONFIG;
    case 'toefl':
      return require('./toefl').TOEFL_EXAM_CONFIG;
    default:
      return undefined;
  }
};

export const AVAILABLE_EXAMS = ['tea', 'elpac', 'toefl'] as const;
```

3. **Use the new exam type**:

```typescript
import { TOEFL_EXAM_CONFIG } from '@/lib/exam-configs';

function ToeflExamPage() {
  return <ExamSidebar initialMessages={[]} examConfig={TOEFL_EXAM_CONFIG} />;
}
```

## Key Features

### Flexibility

- Support for any number of sections
- Customizable section durations
- Different icons and colors for each section
- Configurable messages and instructions

### Type Safety

- Full TypeScript support
- Strongly typed interfaces
- Compile-time validation

### Maintainability

- Each exam configuration in its own file
- Clear separation of concerns
- Easy to modify individual exams

### Extensibility

- Easy to add new exam types
- No need to modify existing code
- Plugin-like architecture

## Migration from Old System

The old system had hardcoded TEA configurations. The new system:

- Moves all TEA-specific code to `tea.tsx`
- Makes components completely dynamic
- Maintains backward compatibility
- Allows easy addition of new exam types

## Best Practices

1. **Naming**: Use descriptive names for exam IDs and clear titles
2. **Icons**: Use consistent icon libraries (Lucide React recommended)
3. **Colors**: Use Tailwind CSS color classes for consistency
4. **Messages**: Keep messages clear and actionable
5. **Duration**: Specify durations in seconds for precision
6. **Sections**: Number sections starting from 1

## Testing

See `demo.tsx` for comprehensive usage examples and testing scenarios.
