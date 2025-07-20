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
export const modelSpecificPrompts = {
  [MODEL_IDS.CHAT_MODEL]:
    'You are a civil aviation expert who helps with general queries about ICAO, aeronautical regulations, flight procedures, and operational safety. Provide clear answers and cite relevant ICAO annexes when applicable.',
  [MODEL_IDS.CHAT_MODEL_REASONING]:
    'You are a technical analyst specialized in ICAO regulations. Use detailed reasoning to explain complex regulations, analyze specific cases, and provide precise technical interpretations with references to official documents.',
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
// LEGACY FUNCTIONS (DEPRECATED)
// ==========================================

/**
 * @deprecated Use buildExamEvaluatorPrompt with exam config instead
 */
export const createTeaEvaluatorPrompt = (_section?: 1 | 2 | 3) => {
  console.warn(
    'createTeaEvaluatorPrompt is deprecated. Use dynamic exam config instead.',
  );
  return 'Please configure the exam properly using dynamic configuration.';
};

/**
 * @deprecated Use getExamSectionPrompt with exam config instead
 */
export const getTeaSectionPrompt = (_section: 1 | 2 | 3): string => {
  console.warn(
    'getTeaSectionPrompt is deprecated. Use dynamic exam config instead.',
  );
  return '';
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

// Función para contexto dinámico (opcional)
export const createDynamicContext = (userInfo?: {
  role?: 'pilot' | 'controller' | 'technician' | 'student' | 'inspector';
  experience?: 'beginner' | 'intermediate' | 'expert';
  specialty?: string;
}) => {
  if (!userInfo) return '';

  const roleContext = {
    pilot:
      'Como piloto, enfócate en procedimientos operacionales, limitaciones de aeronave y aspectos prácticos del vuelo.',
    controller:
      'Como controlador de tráfico aéreo, prioriza información sobre separación, procedimientos ATC y coordinación.',
    technician:
      'Como técnico aeronáutico, enfócate en aspectos de mantenimiento, certificación y estándares técnicos.',
    student:
      'Explica conceptos de manera didáctica, usa ejemplos prácticos y proporciona contexto educativo.',
    inspector:
      'Como inspector de aviación civil, enfócate en cumplimiento normativo, auditorías y certificaciones.',
  };

  const experienceContext = {
    beginner:
      'Usa lenguaje accesible y proporciona explicaciones básicas de términos técnicos.',
    intermediate:
      'Asume conocimiento básico pero explica conceptos avanzados cuando sea necesario.',
    expert:
      'Puedes usar terminología técnica avanzada y referencias específicas a normativas.',
  };

  let context = '';
  if (userInfo.role) {
    context += `\n\nContexto del usuario: ${roleContext[userInfo.role]}`;
  }
  if (userInfo.experience) {
    context += `\n\nNivel de experiencia: ${experienceContext[userInfo.experience]}`;
  }
  if (userInfo.specialty) {
    context += `\n\nEspecialidad: Ten en cuenta que el usuario se especializa en ${userInfo.specialty}.`;
  }

  return context;
};
