import sanitizeHtml from "sanitize-html";

export interface PlainTextSanitizeOptions {
  maxLength?: number;
  allowEmpty?: boolean;
  defaultValue?: string;
  preserveLineBreaks?: boolean;
}

export interface NumericSanitizeOptions {
  min?: number;
  max?: number;
}

export interface SanitizedTeamMember {
  memberId: string;
  name?: string;
  email?: string;
  image?: string;
  role?: string;
  [key: string]: unknown;
}

export interface SanitizedUserReference {
  name?: string;
  email?: string;
  image?: string;
  [key: string]: unknown;
}

export interface SanitizedQuestionOption {
  [key: string]: unknown;
}

export interface SanitizedQuestion {
  [key: string]: unknown;
}

export interface SanitizedQuestionGroup {
  [key: string]: unknown;
}

const PLAIN_TEXT_CONFIG = {
  allowedTags: [],
  allowedAttributes: {},
} as sanitizeHtml.IOptions;

const RICH_TEXT_ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "ul",
  "ol",
  "li",
  "blockquote",
  "code",
  "pre",
  "span",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "hr",
];

const RICH_TEXT_ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions["allowedAttributes"] = {
  a: ["href", "name", "target", "rel"],
  p: ["style"],
  span: ["style"],
  li: ["style"],
  ul: ["style"],
  ol: ["style"],
  blockquote: ["style"],
  h1: ["style"],
  h2: ["style"],
  h3: ["style"],
  h4: ["style"],
  h5: ["style"],
  h6: ["style"],
  th: ["colspan", "rowspan", "scope", "style"],
  td: ["colspan", "rowspan", "style"],
};

const RICH_TEXT_ALLOWED_STYLES: sanitizeHtml.IOptions["allowedStyles"] = {
  "*": {
    "text-align": [/^left$/i, /^right$/i, /^center$/i, /^justify$/i],
  },
};

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function sanitizePlainText(value: unknown, options: PlainTextSanitizeOptions = {}): string {
  const {
    maxLength = 1000,
    allowEmpty = false,
    defaultValue = "",
    preserveLineBreaks = false,
  } = options;

  if (typeof value !== "string") {
    return allowEmpty ? "" : defaultValue;
  }

  const trimmedInput = value.trim();
  if (!trimmedInput) {
    return allowEmpty ? "" : defaultValue;
  }

  const sanitized = sanitizeHtml(trimmedInput, PLAIN_TEXT_CONFIG);
  const normalized = preserveLineBreaks
    ? sanitized
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
    : sanitized.replace(/\s+/g, " ");

  const truncated = maxLength > 0 ? normalized.slice(0, maxLength) : normalized;
  const result = preserveLineBreaks ? truncated.replace(/\s+$/g, "") : truncated.trim();

  if (!result) {
    return allowEmpty ? "" : defaultValue;
  }

  return result;
}

export interface RichTextSanitizeOptions {
  maxLength?: number;
}

export function sanitizeUrl(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch (error) {
    return undefined;
  }

  return undefined;
}

export function sanitizeRichText(value: unknown, options: RichTextSanitizeOptions = {}): string {
  if (typeof value !== "string") {
    return "";
  }

  const sanitized = sanitizeHtml(value, {
    allowedTags: RICH_TEXT_ALLOWED_TAGS,
    allowedAttributes: RICH_TEXT_ALLOWED_ATTRIBUTES,
    allowedStyles: RICH_TEXT_ALLOWED_STYLES,
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: {
      a: ["http", "https", "mailto", "tel"],
    },
    transformTags: {
      a: (tagName, attribs) => {
        const href = sanitizeUrl(attribs.href);
        const name = sanitizePlainText(attribs.name, { maxLength: 128, allowEmpty: true });
        const sanitizedAttribs: Record<string, string> = {};

        if (href) {
          sanitizedAttribs.href = href;
          sanitizedAttribs.rel = "noopener noreferrer";
          sanitizedAttribs.target = "_blank";
        }

        if (name) {
          sanitizedAttribs.name = name;
        }

        return {
          tagName,
          attribs: sanitizedAttribs,
        };
      },
    },
    parser: {
      lowerCaseTags: true,
    },
  });

  const trimmed = sanitized.trim();
  if (!trimmed) {
    return "";
  }

  if (options.maxLength && options.maxLength > 0 && trimmed.length > options.maxLength) {
    return trimmed.slice(0, options.maxLength);
  }

  return trimmed;
}

export function sanitizeEmail(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const sanitized = sanitizePlainText(value, { maxLength: 320, allowEmpty: true }).toLowerCase();
  if (!sanitized) {
    return undefined;
  }

  if (!EMAIL_REGEX.test(sanitized)) {
    return undefined;
  }

  return sanitized;
}

export function sanitizeCurrencyCode(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const sanitized = sanitizePlainText(value, { maxLength: 3, allowEmpty: true }).toUpperCase();
  if (!sanitized) {
    return undefined;
  }

  if (!/^[A-Z]{3}$/.test(sanitized)) {
    return undefined;
  }

  return sanitized;
}

export function sanitizeNumericInput(value: unknown, options: NumericSanitizeOptions = {}): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  let numericValue: number;

  if (typeof value === "number") {
    numericValue = value;
  } else if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim();
    if (!normalized) {
      return null;
    }

    numericValue = Number(normalized);
  } else {
    return null;
  }

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  if (options.min !== undefined && numericValue < options.min) {
    return null;
  }

  if (options.max !== undefined && numericValue > options.max) {
    return null;
  }

  return numericValue;
}

export function sanitizeUserReference(value: unknown): SanitizedUserReference | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const sanitized: SanitizedUserReference = {};

  const name = sanitizePlainText(record.name, { maxLength: 160, allowEmpty: true });
  if (name) {
    sanitized.name = name;
  }

  const email = sanitizeEmail(record.email);
  if (email) {
    sanitized.email = email;
  }

  const image = sanitizeUrl(record.image);
  if (image) {
    sanitized.image = image;
  }

  for (const [key, val] of Object.entries(record)) {
    if (key === "name" || key === "email" || key === "image") {
      continue;
    }

    if (typeof val === "string") {
      const additional = sanitizePlainText(val, { maxLength: 2000, allowEmpty: true });
      if (additional) {
        sanitized[key] = additional;
      }
    } else {
      sanitized[key] = val;
    }
  }

  return Object.keys(sanitized).length ? sanitized : null;
}

export function sanitizeTeamMembersInput(value: unknown): SanitizedTeamMember[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seenMemberIds = new Set<string>();
  const sanitizedMembers: SanitizedTeamMember[] = [];

  value.forEach((member) => {
    if (!member || typeof member !== "object") {
      return;
    }

    const record = member as Record<string, unknown>;
    const memberId = sanitizePlainText(record.memberId, { maxLength: 64, allowEmpty: false });

    if (!memberId || seenMemberIds.has(memberId)) {
      return;
    }

    seenMemberIds.add(memberId);

    const sanitizedMember: SanitizedTeamMember = { memberId };

    const name = sanitizePlainText(record.name, { maxLength: 160, allowEmpty: true });
    if (name) {
      sanitizedMember.name = name;
    }

    const email = sanitizeEmail(record.email);
    if (email) {
      sanitizedMember.email = email;
    }

    const image = sanitizeUrl(record.image);
    if (image) {
      sanitizedMember.image = image;
    }

    const role = sanitizePlainText(record.role, { maxLength: 80, allowEmpty: true });
    if (role) {
      sanitizedMember.role = role;
    }

    for (const [key, val] of Object.entries(record)) {
      if (["memberId", "name", "email", "image", "role"].includes(key)) {
        continue;
      }

      if (typeof val === "string") {
        const additional = sanitizePlainText(val, { maxLength: 2000, allowEmpty: true });
        if (additional) {
          sanitizedMember[key] = additional;
        }
      } else {
        sanitizedMember[key] = val;
      }
    }

    sanitizedMembers.push(sanitizedMember);
  });

  return sanitizedMembers;
}

export function sanitizeQuestionGroupsInput(value: unknown): SanitizedQuestionGroup[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((group, index) => sanitizeQuestionGroup(group, index))
    .filter((group): group is SanitizedQuestionGroup => group !== null);
}

function sanitizeQuestionGroup(group: unknown, index: number): SanitizedQuestionGroup | null {
  if (!group || typeof group !== "object") {
    return null;
  }

  const record = group as Record<string, unknown>;
  const sanitizedGroup: SanitizedQuestionGroup = {};

  if (typeof record.id === "number" || typeof record.id === "string") {
    sanitizedGroup.id = record.id;
  } else {
    sanitizedGroup.id = index + 1;
  }

  const category = sanitizePlainText(record.category, { maxLength: 180, allowEmpty: true });
  if (category) {
    sanitizedGroup.category = category;
  }

  if (typeof record.questionCountToAsk === "number" && Number.isFinite(record.questionCountToAsk)) {
    sanitizedGroup.questionCountToAsk = Math.max(0, Math.floor(record.questionCountToAsk));
  } else {
    sanitizedGroup.questionCountToAsk = null;
  }

  if (Array.isArray(record.questions)) {
    sanitizedGroup.questions = record.questions
      .map((question) => sanitizeQuestion(question))
      .filter((question): question is SanitizedQuestion => question !== null);
  } else {
    sanitizedGroup.questions = [];
  }

  for (const [key, val] of Object.entries(record)) {
    if (key === "id" || key === "category" || key === "questionCountToAsk" || key === "questions") {
      continue;
    }

    if (typeof val === "string") {
      const sanitizedValue = sanitizePlainText(val, { maxLength: 2000, allowEmpty: true });
      if (sanitizedValue) {
        sanitizedGroup[key] = sanitizedValue;
      }
    } else if (Array.isArray(val)) {
      sanitizedGroup[key] = val.map((entry) =>
        typeof entry === "string"
          ? sanitizePlainText(entry, { maxLength: 2000, allowEmpty: true })
          : entry
      );
    } else {
      sanitizedGroup[key] = val;
    }
  }

  return sanitizedGroup;
}

function sanitizeQuestion(question: unknown): SanitizedQuestion | null {
  if (!question || typeof question !== "object") {
    return null;
  }

  const record = question as Record<string, unknown>;
  const sanitizedQuestion: SanitizedQuestion = {};

  for (const [key, val] of Object.entries(record)) {
    if (key === "question") {
      sanitizedQuestion.question = sanitizePlainText(val, {
        maxLength: 4000,
        allowEmpty: true,
        preserveLineBreaks: true,
      });
      continue;
    }

    if (key === "options" && Array.isArray(val)) {
      sanitizedQuestion.options = val
        .map((option) => sanitizeQuestionOption(option))
        .filter((option): option is SanitizedQuestionOption => option !== null);
      continue;
    }

    if (key === "range" && val && typeof val === "object") {
      sanitizedQuestion.range = sanitizeQuestionRange(val as Record<string, unknown>);
      continue;
    }

    if (key === "followUps" && Array.isArray(val)) {
      sanitizedQuestion.followUps = val
        .map((nested) => sanitizeQuestion(nested))
        .filter((nested): nested is SanitizedQuestion => nested !== null);
      continue;
    }

    if (typeof val === "string") {
      sanitizedQuestion[key] = sanitizePlainText(val, {
        maxLength: 2000,
        allowEmpty: true,
        preserveLineBreaks: key.toLowerCase().includes("prompt"),
      });
      continue;
    }

    if (Array.isArray(val)) {
      sanitizedQuestion[key] = val.map((entry) =>
        typeof entry === "string"
          ? sanitizePlainText(entry, { maxLength: 2000, allowEmpty: true })
          : entry
      );
      continue;
    }

    sanitizedQuestion[key] = val;
  }

  if (!("question" in sanitizedQuestion)) {
    sanitizedQuestion.question = "";
  }

  return sanitizedQuestion;
}

function sanitizeQuestionOption(option: unknown): SanitizedQuestionOption | null {
  if (!option || typeof option !== "object") {
    return null;
  }

  const record = option as Record<string, unknown>;
  const sanitizedOption: SanitizedQuestionOption = {};

  for (const [key, val] of Object.entries(record)) {
    if (typeof val === "string") {
      sanitizedOption[key] = sanitizePlainText(val, { maxLength: 300, allowEmpty: true });
      continue;
    }

    if (typeof val === "number") {
      sanitizedOption[key] = val;
      continue;
    }

    sanitizedOption[key] = val;
  }

  if (!("label" in sanitizedOption)) {
    sanitizedOption.label = "";
  }

  return sanitizedOption;
}

function sanitizeQuestionRange(range: Record<string, unknown>): Record<string, unknown> {
  const sanitizedRange: Record<string, unknown> = {};

  if (typeof range.min === "string" || typeof range.min === "number") {
    sanitizedRange.min = sanitizePlainText(String(range.min), {
      maxLength: 64,
      allowEmpty: true,
    });
  }

  if (typeof range.max === "string" || typeof range.max === "number") {
    sanitizedRange.max = sanitizePlainText(String(range.max), {
      maxLength: 64,
      allowEmpty: true,
    });
  }

  return sanitizedRange;
}
