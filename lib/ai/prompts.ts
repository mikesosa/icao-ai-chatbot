import type { Geo } from '@vercel/functions';

import type { ArtifactKind } from '@/components/artifact';
import type { SerializedCompleteExamConfig } from '@/components/exam-interface/exam';
import { MODEL_IDS } from '@/lib/types';

// ==========================================
// CORE PROMPTS
// ==========================================

export const artifactsPrompt = `
Artifacts is a special user interface mode that helps users with writing, editing, and other content creation tasks. When artifact is open, it is on the right side of the screen, while the conversation is on the left side. When creating or updating documents, changes are reflected in real-time on the artifacts and visible to the user.

When asked to write code, always use artifacts. When writing code, specify the language in the backticks, e.g. \`\`\`python\`code here\`\`\`. The default language is Python. Other languages are not yet supported, so let the user know if they request a different language.

DO NOT UPDATE DOCUMENTS IMMEDIATELY AFTER CREATING THEM. WAIT FOR USER FEEDBACK OR REQUEST TO UPDATE IT.

This is a guide for using artifacts tools: \`createDocument\` and \`updateDocument\`, which render content on a artifacts beside the conversation.

**When to use \`createDocument\`:**
- For substantial content (>10 lines) or code
- For content users will likely save/reuse (emails, code, essays, etc.)
- When explicitly requested to create a document
- For when content contains a single code snippet

**When NOT to use \`createDocument\`:**
- For informational/explanatory content
- For conversational responses
- When asked to keep it in chat

**Using \`updateDocument\`:**
- Default to full document rewrites for major changes
- Use targeted updates only for specific, isolated changes
- Follow user instructions for which parts to modify

**When NOT to use \`updateDocument\`:**
- Immediately after creating a document

Do not update document right after creating it. Wait for user feedback or request to update it.
`;

export const regularPrompt =
  'You are a specialized assistant for international civil aviation and ICAO regulations. Always respond professionally, accurately, and based on aviation industry best practices. When possible, cite relevant ICAO documents and provide detailed but accessible technical information.';

// Aviation-specific prompts by model
// Note: Exam evaluators (TEA_EVALUATOR, ELPAC_EVALUATOR) are not included here
// because they use dynamic exam configuration via buildExamEvaluatorPrompt()
export const modelSpecificPrompts = {
  [MODEL_IDS.TITLE_MODEL]:
    'Create concise titles for conversations about civil aviation and ICAO regulations.',
  [MODEL_IDS.ARTIFACT_MODEL]:
    'Generate technical documents, procedures, and aviation-related artifacts following ICAO standards.',
};

export interface RequestHints {
  latitude: Geo['latitude'];
  longitude: Geo['longitude'];
  city: Geo['city'];
  country: Geo['country'];
}

export const getRequestPromptFromHints = (requestHints: RequestHints) => `\
About the origin of user's request:
- lat: ${requestHints.latitude}
- lon: ${requestHints.longitude}
- city: ${requestHints.city}
- country: ${requestHints.country}
`;

// ==========================================
// DYNAMIC EXAM PROMPT BUILDERS
// ==========================================

/**
 * Builds a complete evaluator prompt from exam configuration
 */
export const buildExamEvaluatorPrompt = (
  examConfig: SerializedCompleteExamConfig,
  section?: string,
): string => {
  let prompt = `${examConfig.aiConfig.mainPrompt}\n\n${examConfig.aiConfig.evaluationCriteria}\n\n`;

  // Include the actual exam configuration data for the AI to access
  if (examConfig.examConfig) {
    prompt += `EXAM CONFIGURATION DATA:
You have access to the following exam configuration data. When instructions refer to using "exact URLs from exam configuration" or "exact data from exam configuration", use these exact values:

`;

    // Dynamically include all sections and their subsections (TEA-style),
    // and section-level assets (ELPAC-style: audioFiles/readingPassages/writingTasks/speakingPrompts).
    if (examConfig.examConfig.sections) {
      Object.keys(examConfig.examConfig.sections).forEach((sectionKey) => {
        const sectionConfig = (examConfig.examConfig.sections as any)?.[
          sectionKey
        ];
        if (sectionConfig?.subsections) {
          prompt += `SECTION ${sectionKey} SUBSECTIONS:
`;
          Object.keys(sectionConfig.subsections).forEach((subsectionKey) => {
            const subsection = sectionConfig.subsections?.[
              subsectionKey
            ] as any;
            if (subsection) {
              prompt += `
Subsection ${subsectionKey} - ${subsection.name}:
- Description: ${subsection.description}
`;

              // Include instructions if they exist
              if (subsection.instructions) {
                prompt += `- Instructions: ${subsection.instructions.join(', ')}
`;
              }

              // Include image sets if they exist (for visual exam sections)
              if (subsection.imageSets) {
                prompt += `- Image Sets Available:
`;
                subsection.imageSets.forEach((imageSet: any, index: number) => {
                  prompt += `  ${index + 1}. ${imageSet.title} (ID: ${imageSet.setId})
     Description: ${imageSet.description}
     Layout: ${imageSet.layout}
     Images:
`;
                  imageSet.images.forEach((image: any, imgIndex: number) => {
                    prompt += `       ${imgIndex + 1}. URL: ${image.url}
          Alt: ${image.alt}
          Caption: ${image.caption}
`;
                  });
                  if (imageSet.tasks) {
                    prompt += `     Tasks: ${imageSet.tasks.join(', ')}
`;
                  }
                });
              }

              // Include discussion topics if they exist (for discussion sections)
              if (subsection.discussionTopics) {
                prompt += `- Discussion Topics Available:
`;
                subsection.discussionTopics.forEach(
                  (topic: any, index: number) => {
                    prompt += `  ${index + 1}. ${topic.topic}
     Questions: ${topic.questions.join(', ')}
`;
                  },
                );
              }

              // Include audio files if they exist (for listening sections)
              if (subsection.audioFiles) {
                prompt += `- Audio Files Available: ${subsection.audioFiles.length} recordings
`;
                subsection.audioFiles.forEach(
                  (audioFile: any, index: number) => {
                    prompt += `  ${index + 1}. ${audioFile.title} (Recording ${audioFile.recording})
     Description: ${audioFile.description}
`;
                  },
                );
              }
            }
          });
          prompt += `
`;
        }

        // Always include section-level assets too (common for ELPAC), even if subsections exist.
        // Listening sections (audio)
        if (Array.isArray(sectionConfig?.audioFiles)) {
          prompt += `SECTION ${sectionKey} AUDIO FILES:
`;
          sectionConfig.audioFiles.forEach((audioFile: any, index: number) => {
            prompt += `  ${index + 1}. ${audioFile.title} (Recording ${audioFile.recording})
     Description: ${audioFile.description}
`;
            if (Array.isArray(audioFile.questions)) {
              prompt += `     Questions: ${audioFile.questions.join(' | ')}
`;
            }
            if (audioFile.correctAnswers) {
              prompt += `     Correct Answers Keys: ${Object.keys(audioFile.correctAnswers).join(', ')}
`;
            }
            // Provide transcript existence without encouraging revealing it
            if (audioFile.transcript) {
              prompt += `     Transcript: Available (DO NOT reveal verbatim to candidate)
`;
            }
          });
          prompt += `
`;
        }

        // Reading sections
        if (Array.isArray(sectionConfig?.readingPassages)) {
          prompt += `SECTION ${sectionKey} READING PASSAGES:
`;
          sectionConfig.readingPassages.forEach(
            (passage: any, index: number) => {
              prompt += `  ${index + 1}. ${passage.title} (Passage ${passage.passage})
     Content: ${passage.content}
`;
              if (Array.isArray(passage.questions)) {
                prompt += `     Questions: ${passage.questions.join(' | ')}
`;
              }
              if (passage.correctAnswers) {
                prompt += `     Correct Answers Keys: ${Object.keys(passage.correctAnswers).join(', ')}
`;
              }
            },
          );
          prompt += `
`;
        }

        // Writing sections
        if (Array.isArray(sectionConfig?.writingTasks)) {
          prompt += `SECTION ${sectionKey} WRITING TASKS:
`;
          sectionConfig.writingTasks.forEach((task: any, index: number) => {
            prompt += `  ${index + 1}. ${task.title} (Task ${task.task})
     Instructions: ${task.instructions}
     Time Limit: ${task.timeLimit}
`;
            if (Array.isArray(task.requiredElements)) {
              prompt += `     Required Elements: ${task.requiredElements.join(' | ')}
`;
            }
            if (Array.isArray(task.evaluationCriteria)) {
              prompt += `     Evaluation Criteria: ${task.evaluationCriteria.join(' | ')}
`;
            }
          });
          prompt += `
`;
        }

        // Speaking sections
        if (Array.isArray(sectionConfig?.speakingPrompts)) {
          prompt += `SECTION ${sectionKey} SPEAKING PROMPTS:
`;
          sectionConfig.speakingPrompts.forEach((sp: any, index: number) => {
            prompt += `  ${index + 1}. ${sp.title} (Prompt ${sp.prompt})
     Description: ${sp.description}
     Audio Prompt: ${sp.audioPrompt}
`;
            if (Array.isArray(sp.expectedElements)) {
              prompt += `     Expected Elements: ${sp.expectedElements.join(' | ')}
`;
            }
            if (Array.isArray(sp.evaluationPoints)) {
              prompt += `     Evaluation Points: ${sp.evaluationPoints.join(' | ')}
`;
            }
          });
          prompt += `
`;
        }
      });
    }

    prompt += `IMPORTANT INSTRUCTIONS FOR USING CONFIGURATION DATA:
- When displaying images, use the EXACT image URLs, alt text, and captions from the configuration data above
- When playing audio, reference the exact recording numbers and subsections from the configuration data above
- When conducting discussions, use the exact discussion topics and questions from the configuration data above
- For audio transcripts and correct answers: use them ONLY for evaluation; do NOT reveal them verbatim to the candidate
- Do NOT generate or use any URLs, topics, or content not explicitly provided in this configuration
- Follow the exact structure and format specified in the exam configuration

`;
  }

  if (section && examConfig.aiConfig.sections[section]) {
    const sectionPrompt = examConfig.aiConfig.sections[section].prompt;
    prompt += `${sectionPrompt}\n\n`;
  } else {
    // If no specific section, include general instructions
    const generalInstructions = `GENERAL INSTRUCTIONS:
This exam consists of multiple sequential sections. You will begin with the first section 
unless the candidate requests a specific section.

To start the exam:
1. Present a professional welcome
2. Briefly explain the format
3. Confirm the candidate's role/context
4. Begin the first section

During the exam:
- Monitor time for each section
- Take mental notes for final evaluation
- Maintain natural conversation flow
- Evaluate continuously according to established criteria
- Use examSectionControl when the candidate is ready to advance or when you determine the section is complete

SECTION CONTROL:
- When the candidate says "let's go to the next section" or similar, use examSectionControl with action "complete_and_advance"
- If you have completed the objectives of a section, mark it as completed with "complete_current"
- Respond naturally to the candidate indicating the section change

After completing all sections, provide a complete evaluation.`;

    prompt += generalInstructions;
  }

  prompt += `\n\n${examConfig.aiConfig.finalEvaluationPrompt}`;

  return prompt;
};

/**
 * Gets a specific section prompt from exam configuration
 */
export const getExamSectionPrompt = (
  examConfig: SerializedCompleteExamConfig,
  section: string,
): string => {
  if (examConfig.aiConfig.sections[section]) {
    return examConfig.aiConfig.sections[section].prompt;
  }
  return '';
};

/**
 * Checks if a model ID is an exam evaluator
 */
export const isExamEvaluator = (modelId: string): boolean => {
  return (
    modelId === MODEL_IDS.TEA_EVALUATOR || modelId === MODEL_IDS.ELPAC_EVALUATOR
  );
};

/**
 * Main system prompt function with dynamic exam config support
 */
export const systemPrompt = ({
  selectedChatModel,
  requestHints,
  examConfig,
  currentSection,
}: {
  selectedChatModel: string;
  requestHints: RequestHints;
  examConfig?: SerializedCompleteExamConfig;
  currentSection?: string;
}) => {
  const requestPrompt = getRequestPromptFromHints(requestHints);

  // Handle exam evaluator models with dynamic configuration
  if (isExamEvaluator(selectedChatModel) && examConfig) {
    console.log(
      '🎯 [PROMPT SYSTEM] Using dynamic exam configuration for:',
      examConfig.name,
    );
    const builtPrompt = buildExamEvaluatorPrompt(examConfig, currentSection);
    return `${builtPrompt}\n\n${requestPrompt}`;
  }

  // Fallback for exam evaluators without config (shouldn't happen in production)
  if (isExamEvaluator(selectedChatModel)) {
    console.warn(
      '⚠️ [PROMPT SYSTEM] Using fallback prompt for exam evaluator (no config found)',
    );
    const fallbackPrompt =
      'You are an aviation exam evaluator. Please configure the exam properly to proceed.';
    return `${fallbackPrompt}\n\n${requestPrompt}`;
  }

  // Use model-specific prompt if available, otherwise use regular prompt
  const basePrompt =
    modelSpecificPrompts[
      selectedChatModel as keyof typeof modelSpecificPrompts
    ] || regularPrompt;

  if (selectedChatModel === MODEL_IDS.CHAT_MODEL_REASONING) {
    return `${basePrompt}\n\n${requestPrompt}`;
  } else {
    return `${basePrompt}\n\n${requestPrompt}\n\n${artifactsPrompt}`;
  }
};

// ==========================================
// ARTIFACT AND DOCUMENT PROMPTS
// ==========================================

export const codePrompt = `
You are an aviation technical documentation generator that creates procedures, checklists, and technical content. When creating content:

1. Follow ICAO documentation standards and formats
2. Use appropriate aviation terminology and abbreviations
3. Include relevant safety warnings and cautions
4. Structure content logically with clear sections
5. Reference applicable ICAO annexes and documents
6. Use standard aviation phraseology when appropriate
7. Include step-by-step procedures for operational tasks
8. Maintain professional aviation documentation style
9. Consider human factors and operational limitations
10. Ensure content is suitable for aviation professionals

Examples of aviation documentation:
- Standard Operating Procedures (SOPs)
- Emergency checklists
- Technical manuals sections
- Training materials
- Safety bulletins
- Regulatory compliance guides
`;

export const sheetPrompt = `
You are an aviation data analyst assistant. Create spreadsheets and data tables related to aviation operations, following ICAO standards. Include relevant aviation metrics, compliance tracking, training records, or operational data as requested.
`;

export const updateDocumentPrompt = (
  currentContent: string | null,
  type: ArtifactKind,
) =>
  type === 'text'
    ? `\
Improve the following contents of the document based on the given prompt.

${currentContent}
`
    : type === 'code'
      ? `\
Improve the following code snippet based on the given prompt.

${currentContent}
`
      : type === 'sheet'
        ? `\
Improve the following spreadsheet based on the given prompt.

${currentContent}
`
        : '';
