export type PreScreenQuestionType =
  | "dropdown"
  | "short_text"
  | "long_text"
  | "checkboxes"
  | "range";

export interface SuggestedPreScreenQuestion {
  label: string;
  prompt: string;
  answerType?: PreScreenQuestionType;
  defaultOptions?: string[];
  rangeDefaults?: {
    min?: string;
    max?: string;
  };
}

export const SUGGESTED_PRE_SCREENING_QUESTIONS: SuggestedPreScreenQuestion[] = [
  {
    label: "Notice Period",
    prompt: "How long is your notice period?",
    answerType: "dropdown",
    defaultOptions: ["Immediately", "< 30 days", "> 30 days"],
  },
  {
    label: "Work Setup",
    prompt: "How often are you willing to report to the office each week?",
    answerType: "dropdown",
    defaultOptions: ["Fully remote", "1-2 days", "3+ days"],
  },
  {
    label: "Asking Salary",
    prompt: "How much is your expected monthly salary?",
    answerType: "range",
  },
];

export const PRE_SCREEN_TYPE_OPTIONS: Array<{
  value: PreScreenQuestionType;
  label: string;
  icon: string;
}> = [
  { value: "short_text", label: "Short Answer", icon: "la la-user" },
  { value: "long_text", label: "Long Answer", icon: "la la-align-left" },
  { value: "dropdown", label: "Dropdown", icon: "la la-list" },
  { value: "checkboxes", label: "Checkboxes", icon: "la la-check-square" },
  { value: "range", label: "Range", icon: "la la-sliders-h" },
];

const PRE_SCREEN_TYPE_LABEL_MAP: Record<PreScreenQuestionType, string> =
  PRE_SCREEN_TYPE_OPTIONS.reduce(
    (acc, option) => {
      acc[option.value] = option.label;
      return acc;
    },
    {} as Record<PreScreenQuestionType, string>
  );

export const getPreScreenTypeLabel = (type: PreScreenQuestionType) =>
  PRE_SCREEN_TYPE_LABEL_MAP[type] || PRE_SCREEN_TYPE_LABEL_MAP.short_text;

export const QUESTION_ORIGIN = {
  PRE_SCREEN: "pre-screen",
  INTERVIEW: "interview",
} as const;

export type QuestionOrigin = (typeof QUESTION_ORIGIN)[keyof typeof QUESTION_ORIGIN];

export const SCREENING_SETTING_OPTIONS = [
  { name: "Good Fit and above", icon: "la la-check" },
  { name: "Only Strong Fit", icon: "la la-check-double" },
  { name: "No Automatic Promotion", icon: "la la-times" },
];

export const WORK_SETUP_OPTIONS = [
  { name: "Fully Remote" },
  { name: "Onsite" },
  { name: "Hybrid" },
];

export const EMPLOYMENT_TYPE_OPTIONS = [
  { name: "Full-Time" },
  { name: "Part-Time" },
  { name: "Contract" },
  { name: "Internship" },
];

export const CURRENCY_OPTIONS = [
  "PHP",
  "USD",
  "EUR",
  "GBP",
  "AUD",
  "SGD",
  "JPY",
] as const;

export type CurrencyCode = (typeof CURRENCY_OPTIONS)[number];

export const CURRENCY_SYMBOLS: Record<string, string> = {
  PHP: "₱",
  USD: "$",
  EUR: "€",
  GBP: "£",
  AUD: "A$",
  SGD: "S$",
  JPY: "¥",
};

export const CURRENCY_DROPDOWN_IDS = {
  minimum: "salary-currency-minimum-menu",
  maximum: "salary-currency-maximum-menu",
} as const;

export const MEMBER_ROLE_OPTIONS = [
  { value: "job_owner", label: "Job Owner" },
  { value: "collaborator", label: "Collaborator" },
  { value: "viewer", label: "Viewer" },
];

export const MEMBER_ROLE_LABEL_MAP: Record<string, string> = MEMBER_ROLE_OPTIONS.reduce(
  (acc, option) => {
    acc[option.value] = option.label;
    return acc;
  },
  {} as Record<string, string>
);

export const getMemberRoleLabel = (role?: string) =>
  role && MEMBER_ROLE_LABEL_MAP[role] ? MEMBER_ROLE_LABEL_MAP[role] : role || "Member";

export const INTERVIEW_QUESTION_COUNT = 5;
export const SEGMENTED_DRAFT_STORAGE_KEY = "jia-segmented-career-draft";
