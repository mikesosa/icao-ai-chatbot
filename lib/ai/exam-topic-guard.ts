import { hasExplicitExamCompletionIntent } from './exam-runtime-directives';

export type ExamTopicGuardInput = {
  isExamModel: boolean;
  selectedChatModel: string;
  currentSection?: string;
  currentSubsection?: string;
  latestUserText: string;
};

export type ExamTopicGuardResult = {
  blocked: boolean;
  redirectMessage?: string;
  reason?: string;
};

const EXAM_START_TRIGGER_MESSAGE =
  'start the evaluation. begin with the first section.';

const EXAM_CONTROL_MESSAGE_REGEX = /^\s*\[(system|admin)\]/i;

const OFF_TOPIC_INTENT_REGEX =
  /\b(tell|give|show|write|create|generate|explain|help|what(?:'s|\s+is)|who(?:'s|\s+is)|how\s+do\s+i)\b[^.?!]{0,120}\b(joke|weather|temperature|news|politic|president|stock|crypto|bitcoin|recipe|movie|series|song|music|poem|story|code|program|javascript|typescript|python|translate|email|resume|linkedin|instagram|tiktok)\b/i;

const SMALL_TALK_ONLY_REGEX =
  /^\s*(hi|hello|hey|good\s+(morning|afternoon|evening)|how\s+are\s+you|what'?s\s+up|thanks|thank\s+you|nice\s+to\s+meet\s+you)\s*[!.?]*\s*$/i;

const EXAM_NAVIGATION_REGEX =
  /\b(next\s+section|next\s+part|continue|repeat|play\s+again|ready|start\s+task|move\s+on|go\s+on|skip)\b/i;

const AVIATION_EXAM_KEYWORD_REGEX =
  /\b(atc|pilot|controller|runway|flight|fuel|cabin|emergency|vector|heading|transponder|code|priority|landing|takeoff|tower|clearance|communication|phraseology|souls\s+on\s+board|risk|non-routine|section|subsection|task|paper|exam|assessment|demo|elpac|tea)\b/i;

const LOW_SIGNAL_RESPONSE_REGEX =
  /^\s*(yes|no|ok|okay|sure|maybe|idk|i\s+don'?t\s+know|not\s+sure|nothing(?:\s+nothing)?|huh|what|whatever|no\s+way.*)\s*[!.?]*\s*$/i;

const NUMBER_WORD_SEQUENCE_REGEX =
  /^(zero|one|two|three|four|five|six|seven|eight|nine|oh)([\s-]+(zero|one|two|three|four|five|six|seven|eight|nine|oh)){2,7}$/i;

const SUBSECTION_RELEVANCE_KEYWORDS: Record<string, RegExp> = {
  '1P3':
    /\b(smoke|problem|request|requested|priority|return|landing|atc|heading|climb|vector|emergency|support)\b/i,
  '2I': /\b(falcon|startup|start-?up|taxi|hold|position|tower|request|fuel|souls|board|stand|gate|technical|issue|approved|cleared|roger|copy)\b/i,
  '2II':
    /\b(image|situation|risk|ambiguity|blocked|communication|priorit(?:y|ize)|safety|instruction|readback|coordination|clarification)\b/i,
};

function normalizeUserText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function isLikelyTransponderCodeAnswer(text: string): boolean {
  const normalized = normalizeUserText(text);
  if (!normalized) {
    return false;
  }

  const normalizedDigits = normalized.replace(/[^\d]/g, '');
  if (normalizedDigits.length >= 3 && normalizedDigits.length <= 8) {
    return true;
  }

  if (NUMBER_WORD_SEQUENCE_REGEX.test(normalized)) {
    return true;
  }

  return false;
}

function isSubsectionRelevantAnswer(
  text: string,
  currentSubsection?: string,
): boolean {
  const normalized = normalizeUserText(text);
  if (!normalized) {
    return false;
  }

  if (currentSubsection === '1P1') {
    return (
      isLikelyTransponderCodeAnswer(normalized) ||
      /\b(transponder|code|squawk)\b/i.test(normalized)
    );
  }

  if (!currentSubsection) {
    return AVIATION_EXAM_KEYWORD_REGEX.test(normalized);
  }

  const subsectionRegex = SUBSECTION_RELEVANCE_KEYWORDS[currentSubsection];
  if (subsectionRegex) {
    return subsectionRegex.test(normalized);
  }

  return AVIATION_EXAM_KEYWORD_REGEX.test(normalized);
}

function looksLikeLikelyOffTaskReply(text: string): boolean {
  const normalized = normalizeUserText(text);
  if (!normalized) {
    return false;
  }

  if (LOW_SIGNAL_RESPONSE_REGEX.test(normalized)) {
    return true;
  }

  const tokenCount = normalized.split(' ').length;
  if (tokenCount <= 5 && !AVIATION_EXAM_KEYWORD_REGEX.test(normalized)) {
    return true;
  }

  return false;
}

function buildExamOffTopicRedirect({
  currentSection,
  currentSubsection,
}: {
  currentSection?: string;
  currentSubsection?: string;
}): string {
  const location = currentSubsection
    ? `Section ${currentSection}, Subsection ${currentSubsection}`
    : `Section ${currentSection ?? 'current'}`;

  const subsectionInstruction =
    currentSubsection === '1P1'
      ? 'Please provide the requested short recognition answer.'
      : currentSubsection === '1P3'
        ? 'Please answer the listening comprehension question for this part.'
        : currentSubsection === '2I'
          ? 'Please respond as the controller in the role-play task.'
          : currentSubsection === '2II'
            ? 'Please answer the current image-discussion question.'
            : 'Please continue with the current exam question.';

  return `We are currently in ${location}. Keep your response focused on the exam task. ${subsectionInstruction}`;
}

export function evaluateExamTopicGuard({
  isExamModel,
  selectedChatModel,
  currentSection,
  currentSubsection,
  latestUserText,
}: ExamTopicGuardInput): ExamTopicGuardResult {
  if (!isExamModel || !currentSection) {
    return { blocked: false };
  }

  const normalized = normalizeUserText(latestUserText).toLowerCase();

  if (!normalized) {
    return { blocked: false };
  }

  if (EXAM_CONTROL_MESSAGE_REGEX.test(normalized)) {
    return { blocked: false };
  }

  if (normalized === EXAM_START_TRIGGER_MESSAGE) {
    return { blocked: false };
  }

  if (hasExplicitExamCompletionIntent(normalized)) {
    return { blocked: false };
  }

  if (EXAM_NAVIGATION_REGEX.test(normalized)) {
    return { blocked: false };
  }

  if (isSubsectionRelevantAnswer(normalized, currentSubsection)) {
    return { blocked: false };
  }

  const isOffTopic =
    OFF_TOPIC_INTENT_REGEX.test(normalized) ||
    SMALL_TALK_ONLY_REGEX.test(normalized) ||
    looksLikeLikelyOffTaskReply(normalized);

  if (!isOffTopic) {
    return { blocked: false };
  }

  const redirectMessage = buildExamOffTopicRedirect({
    currentSection,
    currentSubsection,
  });

  return {
    blocked: true,
    redirectMessage,
    reason: `off-topic input blocked for ${selectedChatModel}`,
  };
}
