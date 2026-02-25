const TRAILING_CONNECTOR_REGEX =
  /\b(and|or|but|because|so|to|with|for|if|when|while|that|which|who|where|although|unless|since|than)\s*$/i;

const TRAILING_FRAGMENT_PUNCTUATION_REGEX = /[,:;\-(/]\s*$/;

const SENTENCE_ENDING_REGEX = /[.!?]['")\]]?\s*$/;

export function normalizeConversationText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function isLikelyIncompleteSentence(text: string): boolean {
  const normalized = normalizeConversationText(text);
  if (!normalized) {
    return true;
  }

  if (!SENTENCE_ENDING_REGEX.test(normalized)) {
    return true;
  }

  const withoutTerminalPunctuation = normalized.replace(
    /[.!?]['")\]]?\s*$/,
    '',
  );

  return (
    TRAILING_FRAGMENT_PUNCTUATION_REGEX.test(withoutTerminalPunctuation) ||
    TRAILING_CONNECTOR_REGEX.test(withoutTerminalPunctuation)
  );
}

export function getHumanLikeResponseIssue(text: string): string | null {
  const normalized = normalizeConversationText(text);

  if (!normalized) {
    return 'response is empty';
  }

  if (!/\S+\s+\S+/.test(normalized)) {
    return 'response is too short for a natural examiner turn';
  }

  if (isLikelyIncompleteSentence(normalized)) {
    return 'response looks truncated or unfinished';
  }

  return null;
}

export function isHumanLikeExamResponse(text: string): boolean {
  return getHumanLikeResponseIssue(text) === null;
}
