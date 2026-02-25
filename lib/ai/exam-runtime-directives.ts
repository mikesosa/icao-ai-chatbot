export type ExamRuntimeDirectiveInput = {
  selectedChatModel: string;
  currentSection?: string;
  currentSubsection?: string;
  latestUserText: string;
};

const EXPLICIT_COMPLETION_REQUEST_REGEX =
  /\b(finish|end|conclude|finali(?:s|z)e|complete|wrap\s*up)\b[^.?!]{0,48}\b(exam|assessment|demo|test)\b|\b(i\s*(?:am|'?m)\s*done|that'?s\s*all|no\s*more\s*questions)\b|\bprovide\s+the\s+final\s+evaluation\b/i;

const LISTENING_META_ONLY_REGEX =
  /^(ready|repeat|play(?:\s+it)?(?:\s+again)?|listen|press\s+play|can\s+you\s+repeat|please\s+repeat|start)([.!?])?$/i;

const PAPER_ONE_WRAP_ANSWER_REGEX =
  /\b(atc|heading|climb|vector|support|instruction|emergency\s+services|priority|landing)\b/i;

function normalizeUserText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function hasExplicitExamCompletionIntent(text: string): boolean {
  const normalized = normalizeUserText(text);
  if (!normalized) {
    return false;
  }

  return EXPLICIT_COMPLETION_REQUEST_REGEX.test(normalized);
}

export function isLikelySubstantiveListeningAnswer(text: string): boolean {
  const normalized = normalizeUserText(text);

  if (!normalized || /^\[system\]/i.test(normalized)) {
    return false;
  }

  if (LISTENING_META_ONLY_REGEX.test(normalized)) {
    return false;
  }

  const wordCount = normalized.split(' ').length;

  if (wordCount >= 5) {
    return true;
  }

  if (wordCount >= 3 && /\d/.test(normalized)) {
    return true;
  }

  return false;
}

function isLikelyPaperOneWrapAnswer(text: string): boolean {
  const normalized = normalizeUserText(text);
  if (!normalized || /^\[system\]/i.test(normalized)) {
    return false;
  }

  const wordCount = normalized.split(' ').length;
  return wordCount >= 6 && PAPER_ONE_WRAP_ANSWER_REGEX.test(normalized);
}

export function buildExamRuntimeDirective({
  selectedChatModel,
  currentSection,
  currentSubsection,
  latestUserText,
}: ExamRuntimeDirectiveInput): string | null {
  if (selectedChatModel !== 'elpac-demo') {
    return null;
  }

  const directives: string[] = [];

  if (
    currentSection === '2' &&
    hasExplicitExamCompletionIntent(latestUserText)
  ) {
    directives.push(
      'Candidate explicitly requested completion in this turn. Immediately call examSectionControl(action: "complete_exam", reason: "candidate requested completion") and provide the final evaluation now.',
      'Do not ask additional task questions after this completion request.',
      'Your same assistant turn must include spoken completion text with at least two complete sentences, ending exactly with: "This ELPAC ATC Demo is now complete."',
    );
  }

  if (
    currentSection === '1' &&
    (currentSubsection === '1P1' || currentSubsection === '1P3') &&
    isLikelySubstantiveListeningAnswer(latestUserText)
  ) {
    directives.push(
      'Candidate already provided a substantive listening answer. Do not output "Press Play to listen" in this turn.',
      'Briefly acknowledge the answer and continue to the next required question or section transition.',
    );
  }

  if (
    currentSection === '1' &&
    currentSubsection === '1P3' &&
    isLikelyPaperOneWrapAnswer(latestUserText)
  ) {
    directives.push(
      'After acknowledging this final 1P3 answer, immediately transition to Section 2 Task One.',
      'MANDATORY OUTPUT FORMAT FOR THIS TURN: output the following kickoff block verbatim and do not paraphrase it.',
      'Do not shorten, restyle, or replace any sentence in this kickoff block.',
      "Let's move on to the next section, which involves a role-play scenario. You will act as the controller. I will provide the pilot's lines.",
      'You are the aerodrome controller during a busy departure period. A crew requests start-up and taxi. During the exchange, conditions deteriorate and a second crew reports a potential technical issue. Manage the interaction clearly using ICAO phraseology where possible and plain English where needed.',
      'Pilot: "Tower, this is ABC123 requesting start-up and taxi."',
    );
  }

  if (currentSection === '2' && currentSubsection === '2I') {
    directives.push(
      'In subsection 2I, speak directly as the pilot/interlocutor without line labels.',
      'Do not prefix any utterance with "Pilot:" or "Controller:".',
      'Never include the literal token "Pilot:" anywhere in a 2I examiner turn.',
    );
  }

  if (currentSection === '2' && currentSubsection === '2II') {
    directives.push(
      'In subsection 2II, ask exactly one prompt/question per examiner turn.',
      'Do not combine setup text with the first question in the same sentence.',
      'Never output both "Please describe what you see." and "Describe the operational situation you see." in the same turn.',
    );
  }

  if (directives.length === 0) {
    return null;
  }

  return `RUNTIME HIGH-PRIORITY DIRECTIVES:\n- ${directives.join('\n- ')}`;
}
