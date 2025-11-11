"use client";

import {
  CSSProperties,
  DragEvent,
  MutableRefObject,
  ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import classNames from "classnames";
import axios from "axios";
import dynamic from "next/dynamic";
import styles from "@/lib/styles/segmentedCareerForm.module.scss";
import {
  candidateActionToast,
  errorToast,
  guid,
  interviewQuestionCategoryMap,
} from "@/lib/Utils";
import { useAppContext } from "@/lib/context/AppContext";
import CareerActionModal from "@/lib/components/CareerComponents/CareerActionModal";
import FullScreenLoadingAnimation from "@/lib/components/CareerComponents/FullScreenLoadingAnimation";
import InterviewQuestionModal from "@/lib/components/CareerComponents/InterviewQuestionModal";
import useSegmentedFormState, {
  SegmentedCareerStep,
  segmentedSteps,
  createDefaultQuestionGroups,
  QuestionGroup,
} from "@/lib/hooks/useSegmentedCareerFormState";
import { ReviewSectionKey } from "./SegmentedCareerForm/segmentTypes";
import CareerDetailsTeamAccessStep from "./SegmentedCareerForm/steps/CareerDetailsTeamAccessStep";
import PipelineStagesStep from "./SegmentedCareerForm/steps/PipelineStagesStep";
import ReviewCareerStep from "./SegmentedCareerForm/steps/ReviewCareerStep";
import {
  CURRENCY_SYMBOLS,
  INTERVIEW_QUESTION_COUNT,
  PreScreenQuestionType,
  QUESTION_ORIGIN,
  QuestionOrigin,
  SCREENING_SETTING_OPTIONS,
  SEGMENTED_DRAFT_STORAGE_KEY,
  SUGGESTED_PRE_SCREENING_QUESTIONS,
  SuggestedPreScreenQuestion,
  getPreScreenTypeLabel,
  PRE_SCREEN_TYPE_OPTIONS,
} from "./SegmentedCareerForm/constants";
import CvReviewPreScreeningStep from "./SegmentedCareerForm/steps/CvReviewPreScreeningStep";
import AiInterviewSetupStep from "./SegmentedCareerForm/steps/AiInterviewSetupStep";

type QuestionModalAction = "" | "add" | "edit" | "delete";

interface QuestionModalState {
  action: QuestionModalAction;
  groupId: number | null;
  questionToEdit?: { id: string | number; question: string };
}

// Identify whether a persisted question belongs to the pre-screening or interview buckets.
const resolveQuestionOrigin = (question: any): QuestionOrigin => {
  const declaredOrigin = typeof question?.origin === "string" ? question.origin : "";
  if (
    declaredOrigin === QUESTION_ORIGIN.PRE_SCREEN ||
    declaredOrigin === QUESTION_ORIGIN.INTERVIEW
  ) {
    return declaredOrigin;
  }

  if (
    typeof question?.answerType === "string" ||
    Array.isArray(question?.options) ||
    typeof question?.rangeMin === "string" ||
    typeof question?.rangeMax === "string"
  ) {
    return QUESTION_ORIGIN.PRE_SCREEN;
  }

  return QUESTION_ORIGIN.INTERVIEW;
};

const normalizeQuestionEntry = (question: any) => {
  const origin = resolveQuestionOrigin(question);
  const questionId =
    question && question.id !== undefined && question.id !== null && question.id !== ""
      ? question.id
      : guid();

  const normalized: any = {
    ...question,
    id: questionId,
    origin,
  };

  if (origin === QUESTION_ORIGIN.PRE_SCREEN) {
    normalized.answerType =
      typeof question?.answerType === "string" ? question.answerType : "short_text";
    normalized.options = Array.isArray(question?.options)
      ? question.options.map((option: any) => ({ ...option }))
      : [];
    normalized.rangeMin = typeof question?.rangeMin === "string" ? question.rangeMin : "";
    normalized.rangeMax = typeof question?.rangeMax === "string" ? question.rangeMax : "";
  } else {
    if (Array.isArray(question?.options) && question.options.length) {
      normalized.options = question.options.map((option: any) => ({ ...option }));
    } else {
      delete normalized.options;
    }
    delete normalized.answerType;
    delete normalized.rangeMin;
    delete normalized.rangeMax;
  }

  if (typeof normalized.question !== "string" || normalized.question.trim().length === 0) {
    if (typeof question?.text === "string") {
      normalized.question = question.text;
    } else if (typeof question?.prompt === "string") {
      normalized.question = question.prompt;
    }
  }

  return normalized;
};

const normalizeQuestionGroups = (groups?: QuestionGroup[]): QuestionGroup[] => {
  const sourceGroups =
    Array.isArray(groups) && groups.length ? groups : createDefaultQuestionGroups();

  return sourceGroups.map((group) => ({
    ...group,
    questions: Array.isArray(group.questions)
      ? group.questions.map((question: any) => normalizeQuestionEntry(question))
      : [],
  }));
};

const isPreScreenQuestion = (question: any) =>
  resolveQuestionOrigin(question) === QUESTION_ORIGIN.PRE_SCREEN;

const isInterviewQuestion = (question: any) =>
  resolveQuestionOrigin(question) === QUESTION_ORIGIN.INTERVIEW;

const cloneQuestionGroups = (groups: QuestionGroup[]): QuestionGroup[] =>
  groups.map((group) => ({
    ...group,
    questions: Array.isArray(group.questions)
      ? group.questions.map((question: any) => normalizeQuestionEntry(question))
      : [],
  }));

const RichTextEditor = dynamic(
  () => import("@/lib/components/CareerComponents/RichTextEditor"),
  { ssr: false }
);

interface SegmentedCareerFormProps {
  formType: "add" | "edit";
  career?: any;
  setShowEditModal?: (show: boolean) => void;
}

// Basic HTML-to-plain-text check used to decide whether the description should be considered filled.
const isDescriptionPresent = (value?: string) => {
  if (!value) return false;
  const plain = value.replace(/<[^>]+>/g, "").trim();
  return plain.length > 0;
};

// Formats persisted timestamps for the "Last saved" indicator. Falls back gracefully on invalid input.
const formatTimestamp = (value?: string | number | Date) => {
  if (!value) return "Not saved yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not saved yet";
  }
  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

/**
 * SegmentedCareerForm orchestrates the multi-step recruiter workflow for creating and editing
 * careers. It stitches together local draft persistence, AI integrations, validation, and the
 * publish flow while exposing a consistent wizard experience.
 */
export default function SegmentedCareerForm({
  career,
  formType,
  setShowEditModal,
}: SegmentedCareerFormProps) {
  const { user, orgID } = useAppContext();
  const {
    activeStep,
    setActiveStep,
    draft,
    updateDraft,
    hydrateFromCareer,
    resetDraft,
    loadPersistedDraft,
    persistDraft,
  } = useSegmentedFormState();
  const [questions, setQuestions] = useState<QuestionGroup[]>(() =>
    normalizeQuestionGroups(
      career?.questions && career.questions.length
        ? career.questions
        : createDefaultQuestionGroups()
    )
  );
  const preScreeningGroup = useMemo(
    () => (questions.length > 0 ? questions[0] : undefined),
    [questions]
  );
  const preScreeningQuestions = useMemo(
    () =>
      preScreeningGroup && Array.isArray(preScreeningGroup.questions)
        ? preScreeningGroup.questions.filter((question: any) => isPreScreenQuestion(question))
        : [],
    [preScreeningGroup]
  );
  const [questionGenPrompt, setQuestionGenPrompt] = useState("");
  const [pendingQuestionGeneration, setPendingQuestionGeneration] = useState<string | null>(null);
  const [questionModalState, setQuestionModalState] = useState<QuestionModalState>({
    action: "",
    groupId: null,
    questionToEdit: undefined,
  });
  // Drag state for interview questions
  const [draggingInterviewQuestionId, setDraggingInterviewQuestionId] = useState<string | null>(null);
  const [dragOverInterviewQuestionId, setDragOverInterviewQuestionId] = useState<string | null>(null);
  const [activeDragInterviewGroupId, setActiveDragInterviewGroupId] = useState<number | null>(null);
  const [interviewTailHoverGroupId, setInterviewTailHoverGroupId] = useState<number | null>(null);
  const [showCvScreeningValidation, setShowCvScreeningValidation] = useState(false);
  const [showAiQuestionValidation, setShowAiQuestionValidation] = useState(false);
  const [expandedReviewSections, setExpandedReviewSections] = useState<Record<ReviewSectionKey, boolean>>({
    career: true,
    cv: true,
    ai: true,
  });
  const totalInterviewQuestionCount = useMemo(
    () =>
      questions.reduce((total, group) => {
        const groupQuestions = Array.isArray(group.questions) ? group.questions : [];
        return total + groupQuestions.filter((question: any) => isInterviewQuestion(question)).length;
      }, 0),
    [questions]
  );
  const interviewQuestionGroups = useMemo(
    () =>
      questions.map((group) => ({
        id: group.id,
        category: group.category,
        interviewQuestions: Array.isArray(group.questions)
          ? group.questions.filter((question: any) => isInterviewQuestion(question))
          : [],
      })),
    [questions]
  );
  const isGeneratingQuestions = pendingQuestionGeneration !== null;
  const isOnReviewStep = activeStep === "review";

  // Clear the AI validation banner once the minimum question requirement has been satisfied.
  useEffect(() => {
    if (totalInterviewQuestionCount >= 5 && showAiQuestionValidation) {
      setShowAiQuestionValidation(false);
    }
  }, [totalInterviewQuestionCount, showAiQuestionValidation]);

  // Remove the CV review warning as soon as the step becomes valid again.
  useEffect(() => {
    if (isStepComplete("cv-screening") && showCvScreeningValidation) {
      setShowCvScreeningValidation(false);
    }
  }, [draft.description, questions, showCvScreeningValidation]);
  // Expand/collapse accordions within the review step. Persisted per session to respect user choice.
  const toggleReviewSection = (section: ReviewSectionKey) => {
    setExpandedReviewSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };

  // Convert counts into human-friendly labels for badges (e.g., "No questions" vs "3 questions").
  const formatCountLabel = (count: number, singular: string, plural?: string) => {
    const pluralLabel = plural ?? `${singular}s`;
    if (count === 0) {
      return `No ${pluralLabel.toLowerCase()}`;
    }
    if (count === 1) {
      return `1 ${singular.toLowerCase()}`;
    }
    return `${count} ${pluralLabel.toLowerCase()}`;
  };

  // Translate screening automation configuration into descriptive copy for the review summary.
  const renderScreeningDescription = (setting?: string): ReactNode => {
    switch (setting) {
      case "Good Fit and above":
        return (
          <>
            Automatically endorse candidates who are {" "}
            <span className={styles.reviewCvBadge}>Good Fit</span> and above
          </>
        );
      case "Only Strong Fit":
        return (
          <>
            Automatically endorse candidates who are {" "}
            <span className={styles.reviewCvBadge}>Strong Fit</span> only
          </>
        );
      case "No Automatic Promotion":
      default:
        return "Automatic endorsements are turned off.";
    }
  };

  const jobDescriptionMarkup = isDescriptionPresent(draft.description)
    ? { __html: draft.description }
    : null;
  // Normalization helpers keep duplicate detection and grouping deterministic.
  const normalizeQuestionText = (value: string) => value.trim().toLowerCase();
  const normalizeCategoryName = (value: string) =>
    value
      .toLowerCase()
      .replace(/\s*\/\s*/g, " / ")
      .replace(/\s+/g, " ")
      .trim();
  // Pull the display text out of a question object or string, accommodating legacy shapes.
  const extractQuestionText = (entry: unknown): string => {
    if (typeof entry === "string") {
      return entry.trim();
    }

    if (entry && typeof entry === "object") {
      const candidate = entry as Record<string, unknown>;

      if (typeof candidate.question === "string") {
        return candidate.question.trim();
      }

      if (typeof candidate.text === "string") {
        return candidate.text.trim();
      }

      if (typeof candidate.prompt === "string") {
        return candidate.prompt.trim();
      }

      const stringValue = Object.values(candidate).find((value) => typeof value === "string");
      if (typeof stringValue === "string") {
        return stringValue.trim();
      }
    }

    return "";
  };
  // Keeps "questionCountToAsk" aligned with the count of interview questions to avoid impossible
  // configurations when recruiters delete items.
  const ensureQuestionCountWithinBounds = (group: QuestionGroup) => {
    if (typeof group.questionCountToAsk !== "number") {
      return;
    }

    const interviewCount = Array.isArray(group.questions)
      ? group.questions.filter((question: any) => isInterviewQuestion(question)).length
      : 0;

    if (group.questionCountToAsk > interviewCount) {
      group.questionCountToAsk = interviewCount;
    }
  };
  const parseGeneratedQuestionPayload = (
    raw: unknown,
    categoryContext?: string | string[]
  ) => {
    if (!raw) {
      throw new Error("Empty response from question generator");
    }

    if (typeof raw === "string") {
      const sanitized = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
      if (!sanitized) {
        throw new Error("Unable to parse generated questions");
      }

      try {
        return JSON.parse(sanitized);
      } catch (error) {
        // Attempt to extract inline JSON payloads from conversational responses
        const extractAndParseJSON = (value: string) => {
          const openingTokens: Array<{ open: string; close: string }> = [
            { open: "[", close: "]" },
            { open: "{", close: "}" },
          ];

          for (const token of openingTokens) {
            const start = value.indexOf(token.open);
            if (start === -1) {
              continue;
            }

            let depth = 0;

            for (let index = start; index < value.length; index += 1) {
              const char = value[index];
              if (char === token.open) {
                depth += 1;
              } else if (char === token.close) {
                depth -= 1;
                if (depth === 0) {
                  const candidate = value.slice(start, index + 1);
                  try {
                    return JSON.parse(candidate);
                  } catch (innerError) {
                    // continue searching for other candidates
                  }
                }
              }
            }
          }

          return null;
        };

        const parsed = extractAndParseJSON(sanitized);
        if (parsed) {
          return parsed;
        }

        // Fallback: treat newline separated items as question strings for a single category
        const fallbackItems = sanitized
          .split(/\r?\n|\u2022|\*/)
          .map((item) => item.replace(/^[\d\-\.\)\s]+/, "").trim())
          .filter((item) => item.length > 0);

        if (fallbackItems.length) {
          if (typeof categoryContext === "string" && categoryContext.trim().length > 0) {
            return [
              {
                category: categoryContext,
                questions: fallbackItems,
              },
            ];
          }

          throw new Error("Unable to associate generated questions with a category context");
        }

        throw new Error("Generated questions are not valid JSON");
      }
    }

    return raw;
  };

  // Reorder interview questions within a group
  const handleReorderInterviewQuestions = (
    groupId: number,
    draggedId: string,
    targetId: string | null
  ) => {
    setQuestions((prev) => {
      const clone = prev.map((g) => ({ ...g, questions: Array.isArray(g.questions) ? [...g.questions] : [] }));
      const group = clone.find((g) => g.id === groupId);
      if (!group || !Array.isArray(group.questions)) return prev;

      const interviewQuestions = group.questions.filter((q: any) => isInterviewQuestion(q));
      const otherQuestions = group.questions.filter((q: any) => !isInterviewQuestion(q));

      const getQuestionId = (q: any, idx: number) => (q?.id ?? `auto-${idx}`);
      const originalOrderIds = interviewQuestions.map((q: any, idx: number) => getQuestionId(q, idx));
      const draggedOriginalIndex = originalOrderIds.indexOf(draggedId);

      if (draggedOriginalIndex === -1) {
        return prev;
      }

      const draggedIndex = interviewQuestions.findIndex((q: any, idx: number) => {
        const id = getQuestionId(q, idx);
        return id === draggedId;
      });
      if (draggedIndex === -1) return prev;
      const [draggedItem] = interviewQuestions.splice(draggedIndex, 1);

      if (targetId) {
        if (targetId === draggedId) {
          interviewQuestions.splice(draggedIndex, 0, draggedItem);
          group.questions = [...interviewQuestions, ...otherQuestions];
          return clone;
        }

        const targetOriginalIndex = originalOrderIds.indexOf(targetId);
        const targetIndex = interviewQuestions.findIndex((q: any, idx: number) => {
          const id = getQuestionId(q, idx);
          return id === targetId;
        });
        if (targetOriginalIndex === -1) {
          interviewQuestions.push(draggedItem);
        } else {
          const adjustedTargetIndex = targetIndex === -1 ? interviewQuestions.length - 1 : targetIndex;
          const isMovingDownward = draggedOriginalIndex < targetOriginalIndex;
          const insertIndex = Math.min(
            interviewQuestions.length,
            isMovingDownward ? adjustedTargetIndex + 1 : Math.max(adjustedTargetIndex, 0)
          );
          interviewQuestions.splice(insertIndex, 0, draggedItem);
        }
      } else {
        interviewQuestions.push(draggedItem); // drop at tail
      }

      group.questions = [...interviewQuestions, ...otherQuestions];
      return clone;
    });
  };

  const handleInterviewDragStart = (event: DragEvent<HTMLButtonElement>, questionId: string, groupId: number) => {
    event.dataTransfer.effectAllowed = "move";
    setDraggingInterviewQuestionId(questionId);
    setActiveDragInterviewGroupId(groupId);
    setInterviewTailHoverGroupId(null);
  };

  const handleInterviewDragEnter = (event: DragEvent<HTMLDivElement>, questionId: string) => {
    if (!draggingInterviewQuestionId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (questionId !== draggingInterviewQuestionId) {
      setDragOverInterviewQuestionId(questionId);
      setInterviewTailHoverGroupId(null);
    }
  };

  const handleInterviewDragOver = (event: DragEvent<HTMLDivElement>, questionId: string) => {
    if (!draggingInterviewQuestionId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (questionId !== draggingInterviewQuestionId && dragOverInterviewQuestionId !== questionId) {
      setDragOverInterviewQuestionId(questionId);
      setInterviewTailHoverGroupId(null);
    }
  };

  const handleInterviewDragLeave = (questionId: string) => {
    if (dragOverInterviewQuestionId === questionId) {
      setDragOverInterviewQuestionId(null);
    }
  };

  const handleInterviewDrop = (event: DragEvent<HTMLDivElement>, questionId: string) => {
    if (!draggingInterviewQuestionId || activeDragInterviewGroupId === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    handleReorderInterviewQuestions(activeDragInterviewGroupId, draggingInterviewQuestionId, questionId);
    setDraggingInterviewQuestionId(null);
    setDragOverInterviewQuestionId(null);
    setActiveDragInterviewGroupId(null);
    setInterviewTailHoverGroupId(null);
  };

  const handleInterviewDragEnd = () => {
    setDraggingInterviewQuestionId(null);
    setDragOverInterviewQuestionId(null);
    setActiveDragInterviewGroupId(null);
    setInterviewTailHoverGroupId(null);
  };

  const handleInterviewTailDragOver = (event: DragEvent<HTMLDivElement>, groupId: number) => {
    if (!draggingInterviewQuestionId || activeDragInterviewGroupId !== groupId) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    if (interviewTailHoverGroupId !== groupId) {
      setInterviewTailHoverGroupId(groupId);
    }

    if (dragOverInterviewQuestionId !== null) {
      setDragOverInterviewQuestionId(null);
    }
  };

  const handleInterviewTailDragLeave = (groupId: number) => {
    if (interviewTailHoverGroupId === groupId) {
      setInterviewTailHoverGroupId(null);
    }
  };

  const handleInterviewTailDrop = (event: DragEvent<HTMLDivElement>, groupId: number) => {
    if (!draggingInterviewQuestionId || activeDragInterviewGroupId === null) {
      return;
    }

    if (groupId !== activeDragInterviewGroupId) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    handleReorderInterviewQuestions(groupId, draggingInterviewQuestionId, null);
    setDraggingInterviewQuestionId(null);
    setDragOverInterviewQuestionId(null);
    setActiveDragInterviewGroupId(null);
    setInterviewTailHoverGroupId(null);
  };
  const integrateGeneratedQuestions = (payload: any): boolean => {
    const baseGroups = questions.length
      ? cloneQuestionGroups(questions)
      : normalizeQuestionGroups(createDefaultQuestionGroups());

    const items = Array.isArray(payload) ? payload : payload ? [payload] : [];

    let hasChanges = false;

    items.forEach((entry) => {
      const categoryName = typeof entry?.category === "string" ? entry.category : "";
      const generatedQuestions = Array.isArray(entry?.questions)
        ? entry.questions
        : entry?.questions && typeof entry.questions === "object"
          ? Object.values(entry.questions)
          : [];

      if (!categoryName || !generatedQuestions.length) {
        return;
      }

      const normalizedCategoryName = normalizeCategoryName(categoryName);
      const targetIndex = baseGroups.findIndex(
        (group) => normalizeCategoryName(group.category) === normalizedCategoryName
      );

      if (targetIndex === -1) {
        console.warn("[SegmentedCareerForm] Generated questions skipped (unknown category)", entry);
        hasChanges = true;
        return;
      }

      const targetGroup = baseGroups[targetIndex];
      const existingQuestions = Array.isArray(targetGroup.questions)
        ? targetGroup.questions
        : [];
      const existingLookup = new Set(
        existingQuestions
          .map((item: any) =>
            typeof item?.question === "string" ? normalizeQuestionText(item.question) : ""
          )
          .filter(Boolean)
      );

      const additions = generatedQuestions
        .map((item: unknown) => extractQuestionText(item))
        .filter((item) => item.length > 0)
        .filter((item) => {
          const normalized = normalizeQuestionText(item);
          if (existingLookup.has(normalized)) {
            return false;
          }
          existingLookup.add(normalized);
          return true;
        })
        .map((item) => ({ id: guid(), origin: QUESTION_ORIGIN.INTERVIEW, question: item }));

      if (!additions.length) {
        if (!existingQuestions.length && generatedQuestions.length) {
          console.warn("[SegmentedCareerForm] Generated questions discarded after normalization", {
            categoryName,
            generatedQuestions,
          });
        }
        return;
      }

      targetGroup.questions = [...existingQuestions, ...additions];
      ensureQuestionCountWithinBounds(targetGroup);
      hasChanges = true;
    });

    if (hasChanges) {
      setQuestions(baseGroups);
    }

    return hasChanges;
  };
  const [openPreScreenTypeFor, setOpenPreScreenTypeFor] = useState<string | null>(null);
  const persistedDraftQuestionsRef = useRef<string | null>(null);
  const hasHydratedDraftRef = useRef(false);
  const [activeDragQuestionId, setActiveDragQuestionId] = useState<string | null>(null);
  const [draggingQuestionId, setDraggingQuestionId] = useState<string | null>(null);
  const [dragOverQuestionId, setDragOverQuestionId] = useState<string | null>(null);
  const [isDragOverTail, setIsDragOverTail] = useState(false);

    // Close pre-screen response type menus on outside click or escape
    useEffect(() => {
      if (!openPreScreenTypeFor) {
        return;
      }

      const handleClickOutside = (event: MouseEvent) => {
        const menu = document.getElementById(`pre-screen-type-menu-${openPreScreenTypeFor}`);
        const trigger = document.getElementById(`pre-screen-type-trigger-${openPreScreenTypeFor}`);
        if (menu && trigger) {
          const target = event.target as Node;
          if (!menu.contains(target) && !trigger.contains(target)) {
            setOpenPreScreenTypeFor(null);
          }
        } else {
          setOpenPreScreenTypeFor(null);
        }
      };

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          setOpenPreScreenTypeFor(null);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);

      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }, [openPreScreenTypeFor]);

  useEffect(() => {
    const fetchQuestionInstruction = async () => {
      try {
        const response = await axios.post("/api/fetch-global-settings", {
          fields: { question_gen_prompt: 1 },
        });
        const promptFromSettings =
          response?.data?.question_gen_prompt?.prompt ?? "";
        setQuestionGenPrompt(promptFromSettings);
      } catch (error) {
        console.error("[SegmentedCareerForm] Failed to load question prompt", error);
      }
    };

    fetchQuestionInstruction();
  }, []);

  const [showSaveModal, setShowSaveModal] = useState<string>("");
  const [isSavingCareer, setIsSavingCareer] = useState(false);
  const savingCareerRef = useRef(false);
  const baseTipsId = useId();
  const tipsBulbGradientId = `${baseTipsId}-bulb-gradient`;
  const tipsStarGradientId = `${baseTipsId}-star-gradient`;
  const secretPromptFieldIds = useMemo(
    () => ({
      cv: {
        input: `${baseTipsId}-secret-prompt-cv`,
        description: `${baseTipsId}-secret-prompt-cv-desc`,
      },
      ai: {
        input: `${baseTipsId}-secret-prompt-ai`,
        description: `${baseTipsId}-secret-prompt-ai-desc`,
      },
    }),
    [baseTipsId]
  );
  const tipsContent = useMemo(() => {
    if (activeStep === "cv-screening") {
      return [
        {
          heading: "Add a CV Secret Prompt",
          body: "Guide Jia's resume screening focus; you can set a separate interview prompt later.",
        },
        {
          heading: "Add Pre-Screening questions",
          body: "to collect key details such as notice period, work setup, or salary expectations to guide your review and candidate discussions.",
        },
      ];
    }

    if (activeStep === "ai-setup") {
      return [
        {
          heading: "Add a Secret Prompt",
          body: "to fine-tune how Jia scores and evaluates the interview responses.",
        },
        {
          heading: 'Use "Generate Questions"',
          body:
            "to quickly create tailored interview questions, then refine or mix them with your own for balanced results.",
        },
      ];
    }

    return [
      {
        heading: "Use clear, standard job titles",
        body:
          'for better searchability (e.g., "Software Engineer" instead of "Code Ninja" or "Tech Rockstar").',
      },
      {
        heading: "Avoid abbreviations",
        body:
          'or internal role codes that applicants may not understand (e.g., use "QA Engineer" instead of "QE II" or "QA-TL").',
      },
      {
        heading: "Keep it concise",
        body:
          "— job titles should be no more than a few words (2—4 max), avoiding fluff or marketing terms.",
      },
    ];
  }, [activeStep]);
  // Validation display toggles
  const [showCareerDetailsErrors, setShowCareerDetailsErrors] = useState(false);
  const teamMembers = useMemo(
    () => draft.team?.members || [],
    [draft.team?.members]
  );
  const selectedCurrency = useMemo(() => {
    const currency = draft.salary?.currency;
    if (currency && currency.trim().length > 0) {
      return currency;
    }
    return "PHP";
  }, [draft.salary?.currency]);

  const currencySymbol = useMemo(() => {
    return CURRENCY_SYMBOLS[selectedCurrency] || "";
  }, [selectedCurrency]);

  const currencyPrefixLabel = currencySymbol || selectedCurrency;

  const formatSalaryValue = (value: string) => {
    if (!value) {
      return "—";
    }

    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) {
      return value;
    }

    if (currencySymbol) {
      return `${currencySymbol}${numericValue.toLocaleString()}`;
    }

    return `${numericValue.toLocaleString()} ${selectedCurrency}`;
  };

  const minimumSalaryDisplay = draft.salary.isNegotiable
    ? "Negotiable"
    : formatSalaryValue(draft.salary.minimum);
  const maximumSalaryDisplay = draft.salary.isNegotiable
    ? "Negotiable"
    : formatSalaryValue(draft.salary.maximum);

  const hydrationRef = useRef(false);

  useEffect(() => {
    hydrationRef.current = true;
    return () => {
      hydrationRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      hasHydratedDraftRef.current = true;
      return;
    }

    try {
      const storedDraft = window.localStorage.getItem(SEGMENTED_DRAFT_STORAGE_KEY);
      if (!storedDraft) {
        hasHydratedDraftRef.current = true;
        return;
      }

      const parsedDraft = JSON.parse(storedDraft);
      if (parsedDraft && Array.isArray(parsedDraft.questions)) {
        const normalizedPersistedQuestions = normalizeQuestionGroups(parsedDraft.questions);
        persistedDraftQuestionsRef.current = JSON.stringify(normalizedPersistedQuestions);
        return;
      }

      hasHydratedDraftRef.current = true;
    } catch (error) {
      console.warn("[SegmentedCareerForm] Unable to read persisted draft questions", error);
      hasHydratedDraftRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (career) {
      const normalizedCareerQuestions = normalizeQuestionGroups(
        career.questions && career.questions.length
          ? career.questions
          : createDefaultQuestionGroups()
      );

      hydrateFromCareer({
        career,
        questions: normalizedCareerQuestions,
      });
      setQuestions(normalizedCareerQuestions);
    } else if (orgID) {
      loadPersistedDraft({ orgID });
    }
  }, [career, hydrateFromCareer, loadPersistedDraft, orgID]);

  // Track the last serialized questions to prevent circular persistence updates
  const questionsSyncRef = useRef<string>("");

  // Hydrate local question state whenever the draft changes (e.g., after refresh)
  useEffect(() => {
    if (!draft.questions || !Array.isArray(draft.questions)) {
      return;
    }

    const normalizedDraftQuestions = normalizeQuestionGroups(draft.questions);
    const serializedDraftQuestions = JSON.stringify(normalizedDraftQuestions);
    const persistedSnapshot = persistedDraftQuestionsRef.current;

    if (serializedDraftQuestions === questionsSyncRef.current) {
      if (
        persistedSnapshot === null ||
        serializedDraftQuestions === persistedSnapshot
      ) {
        hasHydratedDraftRef.current = true;
      }

      if (hasHydratedDraftRef.current) {
        persistedDraftQuestionsRef.current = serializedDraftQuestions;
      }
      return;
    }

    questionsSyncRef.current = serializedDraftQuestions;
    setQuestions(normalizedDraftQuestions);

    if (persistedSnapshot === null || serializedDraftQuestions === persistedSnapshot) {
      hasHydratedDraftRef.current = true;
    }

    if (hasHydratedDraftRef.current) {
      persistedDraftQuestionsRef.current = serializedDraftQuestions;
    }
  }, [draft.questions]);

  // Sync local questions state to draft when questions change
  useEffect(() => {
    const questionsStr = JSON.stringify(questions);
    if (questionsStr !== questionsSyncRef.current) {
      questionsSyncRef.current = questionsStr;
      if (!hasHydratedDraftRef.current) {
        return;
      }

      updateDraft({ questions });
      persistedDraftQuestionsRef.current = questionsStr;
    }
  }, [questions, updateDraft]);




  const handleAddPreScreenQuestion = (
    questionText: string,
    template?: {
      answerType?: PreScreenQuestionType;
      options?: string[];
      rangeDefaults?: { min?: string; max?: string };
    }
  ) => {
    const trimmed = questionText.trim();
    if (!trimmed) {
      errorToast("Question cannot be empty", 1400);
      return;
    }

    const alreadyExists = preScreeningQuestions.some(
      (item: any) =>
        typeof item?.question === "string" &&
        item.question.trim().toLowerCase() === trimmed.toLowerCase()
    );

    if (alreadyExists) {
      errorToast("Pre-screening question already added", 1400);
      return;
    }

    const answerType: PreScreenQuestionType = template?.answerType ?? "dropdown";

    const baseOptions =
      (answerType === "dropdown" || answerType === "checkboxes") &&
      Array.isArray(template?.options)
        ? template!.options.map((label) => ({ id: guid(), label }))
        : [];

    const requiresOptions = answerType === "dropdown" || answerType === "checkboxes";
    const normalizedOptions = baseOptions.length
      ? baseOptions
      : requiresOptions
        ? [{ id: guid(), label: "" }]
        : [];

    const rangeDefaults = template?.rangeDefaults || {};
    const rangeMinDefault =
      answerType === "range" ? (typeof rangeDefaults.min === "string" ? rangeDefaults.min : "") : "";
    const rangeMaxDefault =
      answerType === "range" ? (typeof rangeDefaults.max === "string" ? rangeDefaults.max : "") : "";

    setQuestions((previous) => {
      if (!previous.length) {
        const defaultGroups = createDefaultQuestionGroups();
        defaultGroups[0].questions = [
          {
            id: guid(),
            origin: QUESTION_ORIGIN.PRE_SCREEN,
            question: trimmed,
            answerType,
            options: normalizedOptions,
            rangeMin: rangeMinDefault,
            rangeMax: rangeMaxDefault,
          },
        ];
        return defaultGroups;
      }

      const nextGroups = cloneQuestionGroups(previous);

      const targetGroup = nextGroups[0];
      if (!targetGroup) {
        return previous;
      }

      targetGroup.questions = [
        ...targetGroup.questions,
        {
          id: guid(),
          origin: QUESTION_ORIGIN.PRE_SCREEN,
          question: trimmed,
          answerType,
          options: normalizedOptions,
          rangeMin: rangeMinDefault,
          rangeMax: rangeMaxDefault,
        },
      ];

      return nextGroups;
    });

    candidateActionToast(
      <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>
        Question added
      </span>,
      1400,
      <i className="la la-check-circle" style={{ color: "#039855", fontSize: 24 }}></i>
    );
  };

  const handleRemovePreScreenQuestion = (questionId: string) => {
    setOpenPreScreenTypeFor((current) => (current === questionId ? null : current));
    setQuestions((previous) => {
      if (!previous.length) {
        return previous;
      }

      const nextGroups = cloneQuestionGroups(previous);

      const targetGroup = nextGroups[0];
      if (!targetGroup) {
        return previous;
      }

      const initialLength = targetGroup.questions.length;
      const filtered = targetGroup.questions.filter((item: any) => {
        if (String(item?.id) !== questionId) {
          return true;
        }
        return !isPreScreenQuestion(item);
      });

      if (filtered.length === initialLength) {
        return previous;
      }

      targetGroup.questions = filtered;
      return nextGroups;
    });
  };

  const handleUpdatePreScreenQuestion = (
    questionId: string,
    updates: Partial<{ question: string; answerType: PreScreenQuestionType }>
  ) => {
    setQuestions((previous) => {
      if (!previous.length) {
        return previous;
      }

      const nextGroups = cloneQuestionGroups(previous);
      const targetGroup = nextGroups[0];
      if (!targetGroup) {
        return previous;
      }

      const questionIndex = targetGroup.questions.findIndex(
        (item: any) => item?.id === questionId
      );

      if (questionIndex === -1) {
        return previous;
      }

      const currentQuestion = targetGroup.questions[questionIndex];
      if (!isPreScreenQuestion(currentQuestion)) {
        return previous;
      }
      const nextQuestion = {
        ...currentQuestion,
        ...updates,
        origin: QUESTION_ORIGIN.PRE_SCREEN,
      };

      if (updates.answerType) {
        if (updates.answerType === "dropdown" || updates.answerType === "checkboxes") {
          const existingOptions = Array.isArray(currentQuestion?.options)
            ? currentQuestion.options.map((option: any) => ({ ...option }))
            : [];
          nextQuestion.options = existingOptions.length
            ? existingOptions
            : [{ id: guid(), label: "" }];
          nextQuestion.rangeMin = "";
          nextQuestion.rangeMax = "";
        } else if (updates.answerType === "range") {
          nextQuestion.options = [];
          nextQuestion.rangeMin =
            typeof currentQuestion?.rangeMin === "string" ? currentQuestion.rangeMin : "";
          nextQuestion.rangeMax =
            typeof currentQuestion?.rangeMax === "string" ? currentQuestion.rangeMax : "";
        } else {
          nextQuestion.options = [];
          nextQuestion.rangeMin = "";
          nextQuestion.rangeMax = "";
        }
      } else {
        if (!Array.isArray(nextQuestion.options)) {
          nextQuestion.options = [];
        }
      }

      targetGroup.questions[questionIndex] = nextQuestion;
      return nextGroups;
    });
  };

  const handleReorderPreScreenQuestions = (sourceQuestionId: string, targetQuestionId: string | null) => {
    if (!sourceQuestionId) {
      return;
    }

    setQuestions((previous) => {
      if (!previous.length) {
        return previous;
      }

      const nextGroups = cloneQuestionGroups(previous);
      const targetGroup = nextGroups[0];
      if (!targetGroup || !Array.isArray(targetGroup.questions)) {
        return previous;
      }

      const questionList = targetGroup.questions;
      const sourceIndex = questionList.findIndex((item: any) => item?.id === sourceQuestionId);
      if (sourceIndex === -1) {
        return previous;
      }

      const [movedQuestion] = questionList.splice(sourceIndex, 1);
      if (!movedQuestion) {
        return previous;
      }

      if (!isPreScreenQuestion(movedQuestion)) {
        questionList.splice(sourceIndex, 0, movedQuestion);
        return previous;
      }

      if (targetQuestionId === null) {
        questionList.push(movedQuestion);
        return nextGroups;
      }

      if (targetQuestionId === sourceQuestionId) {
        questionList.splice(sourceIndex, 0, movedQuestion);
        return previous;
      }

      const targetIndexAfterRemoval = questionList.findIndex(
        (item: any) => item?.id === targetQuestionId
      );

      if (targetIndexAfterRemoval === -1) {
        questionList.push(movedQuestion);
        return nextGroups;
      }

      if (sourceIndex > targetIndexAfterRemoval) {
        questionList.splice(targetIndexAfterRemoval, 0, movedQuestion);
      } else {
        questionList.splice(targetIndexAfterRemoval + 1, 0, movedQuestion);
      }

      return nextGroups;
    });
  };

  const handlePreScreenDragStart = (event: DragEvent<HTMLDivElement>, questionId: string) => {
    if (activeDragQuestionId !== questionId) {
      event.preventDefault();
      return;
    }

    setDraggingQuestionId(questionId);
    setDragOverQuestionId(null);
    setIsDragOverTail(false);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", questionId);
    setActiveDragQuestionId(questionId);
  };

  const handlePreScreenDragOver = (event: DragEvent<HTMLDivElement>, targetQuestionId: string) => {
    if (!draggingQuestionId || draggingQuestionId === targetQuestionId) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dragOverQuestionId !== targetQuestionId) {
      setDragOverQuestionId(targetQuestionId);
    }
    if (isDragOverTail) {
      setIsDragOverTail(false);
    }
  };

  const handlePreScreenDrop = (event: DragEvent<HTMLDivElement>, targetQuestionId: string) => {
    event.preventDefault();
    event.stopPropagation();
    const sourceId = draggingQuestionId || event.dataTransfer.getData("text/plain");
    if (sourceId && sourceId !== targetQuestionId) {
      handleReorderPreScreenQuestions(sourceId, targetQuestionId);
    }
    handlePreScreenDragEnd();
  };

  const handlePreScreenDragLeave = (targetQuestionId: string) => {
    if (dragOverQuestionId === targetQuestionId) {
      setDragOverQuestionId(null);
    }
  };

  const handlePreScreenDragEnd = () => {
    setDraggingQuestionId(null);
    setDragOverQuestionId(null);
    setActiveDragQuestionId(null);
    setIsDragOverTail(false);
  };

  const handleUpdatePreScreenRange = (
    questionId: string,
    key: "rangeMin" | "rangeMax",
    value: string
  ) => {
    setQuestions((previous) => {
      if (!previous.length) {
        return previous;
      }

      const nextGroups = cloneQuestionGroups(previous);
      const targetGroup = nextGroups[0];
      if (!targetGroup) {
        return previous;
      }

      const nextQuestion = targetGroup.questions.find((item: any) => item?.id === questionId);
      if (!nextQuestion || !isPreScreenQuestion(nextQuestion) || nextQuestion.answerType !== "range") {
        return previous;
      }

      nextQuestion[key] = value;
      return nextGroups;
    });
  };

  const handleAddPreScreenOption = (questionId: string) => {
    setQuestions((previous) => {
      if (!previous.length) {
        return previous;
      }

      const nextGroups = cloneQuestionGroups(previous);
      const targetGroup = nextGroups[0];
      if (!targetGroup) {
        return previous;
      }

      const nextQuestion = targetGroup.questions.find(
        (item: any) => item?.id === questionId
      );

      if (
        !nextQuestion ||
        !isPreScreenQuestion(nextQuestion) ||
        (nextQuestion.answerType !== "dropdown" && nextQuestion.answerType !== "checkboxes")
      ) {
        return previous;
      }

      const existingOptions = Array.isArray(nextQuestion.options)
        ? nextQuestion.options
        : [];

      nextQuestion.options = [
        ...existingOptions,
        {
          id: guid(),
          label: `Option ${existingOptions.length + 1}`,
        },
      ];

      return nextGroups;
    });
  };

  const handleUpdatePreScreenOption = (
    questionId: string,
    optionId: string,
    label: string
  ) => {
    setQuestions((previous) => {
      if (!previous.length) {
        return previous;
      }

      const nextGroups = cloneQuestionGroups(previous);
      const targetGroup = nextGroups[0];
      if (!targetGroup) {
        return previous;
      }

      const nextQuestion = targetGroup.questions.find(
        (item: any) => item?.id === questionId
      );

      if (
        !nextQuestion ||
        !isPreScreenQuestion(nextQuestion) ||
        (nextQuestion.answerType !== "dropdown" && nextQuestion.answerType !== "checkboxes")
      ) {
        return previous;
      }

      nextQuestion.options = Array.isArray(nextQuestion.options)
        ? nextQuestion.options.map((option: any) =>
            option.id === optionId ? { ...option, label } : option
          )
        : [];

      return nextGroups;
    });
  };

  const handleRemovePreScreenOption = (questionId: string, optionId: string) => {
    setQuestions((previous) => {
      if (!previous.length) {
        return previous;
      }

      const nextGroups = cloneQuestionGroups(previous);
      const targetGroup = nextGroups[0];
      if (!targetGroup) {
        return previous;
      }

      const nextQuestion = targetGroup.questions.find(
        (item: any) => item?.id === questionId
      );

      if (
        !nextQuestion ||
        !isPreScreenQuestion(nextQuestion) ||
        (nextQuestion.answerType !== "dropdown" && nextQuestion.answerType !== "checkboxes")
      ) {
        return previous;
      }

      const existingOptions = Array.isArray(nextQuestion.options)
        ? nextQuestion.options
        : [];

      const filtered = existingOptions.filter((option: any) => option.id !== optionId);
      if (filtered.length === existingOptions.length || filtered.length === 0) {
        return previous;
      }

      nextQuestion.options = filtered;
      return nextGroups;
    });
  };

  const handleAddCustomPreScreenQuestion = () => {
    const newQuestionId = guid();

    setQuestions((previous) => {
      if (!previous.length) {
        const defaultGroups = createDefaultQuestionGroups();
        defaultGroups[0].questions = [
          {
            id: newQuestionId,
            origin: QUESTION_ORIGIN.PRE_SCREEN,
            question: "",
            answerType: "short_text",
            options: [],
            rangeMin: "",
            rangeMax: "",
          },
        ];
        return defaultGroups;
      }

      const nextGroups = cloneQuestionGroups(previous);
      const targetGroup = nextGroups[0];
      if (!targetGroup) {
        return previous;
      }

      const currentQuestions = Array.isArray(targetGroup.questions)
        ? targetGroup.questions
        : [];

      targetGroup.questions = [
        ...currentQuestions,
        {
          id: newQuestionId,
          origin: QUESTION_ORIGIN.PRE_SCREEN,
          question: "",
          answerType: "short_text",
          options: [],
          rangeMin: "",
          rangeMax: "",
        },
      ];

      return nextGroups;
    });

    if (typeof document !== "undefined") {
      setTimeout(() => {
        const inputField = document.getElementById(`pre-screen-question-${newQuestionId}`) as HTMLInputElement | null;
        if (inputField) {
          inputField.focus();
        }
      }, 80);
    }

    candidateActionToast(
      <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>
        Custom question added
      </span>,
      1400,
      <i className="la la-check-circle" style={{ color: "#039855", fontSize: 24 }}></i>
    );
  };

  const addInterviewQuestionToGroup = (groupId: number, rawQuestion: string) => {
    const trimmedQuestion = rawQuestion.trim();
    if (!trimmedQuestion) {
      errorToast("Question cannot be empty", 1400);
      return;
    }

    let wasAdded = false;

    setQuestions((previous) => {
      const baseGroups = previous.length
        ? cloneQuestionGroups(previous)
        : normalizeQuestionGroups(createDefaultQuestionGroups());
      const targetIndex = baseGroups.findIndex((group) => group.id === groupId);

      if (targetIndex === -1) {
        return previous.length ? previous : baseGroups;
      }

      const targetGroup = baseGroups[targetIndex];
      const existingQuestions = Array.isArray(targetGroup.questions)
        ? targetGroup.questions
        : [];
      const normalizedNewQuestion = normalizeQuestionText(trimmedQuestion);
      const duplicateExists = existingQuestions.some(
        (item: any) =>
          typeof item?.question === "string" &&
          normalizeQuestionText(item.question) === normalizedNewQuestion
      );

      if (duplicateExists) {
        return previous.length ? previous : baseGroups;
      }

      targetGroup.questions = [
        ...existingQuestions,
        { id: guid(), origin: QUESTION_ORIGIN.INTERVIEW, question: trimmedQuestion },
      ];

      ensureQuestionCountWithinBounds(targetGroup);
      wasAdded = true;
      return baseGroups;
    });

    if (wasAdded) {
      candidateActionToast(
        <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>
          Question added
        </span>,
        1400,
        <i className="la la-check-circle" style={{ color: "#039855", fontSize: 24 }}></i>
      );
    } else {
      errorToast("Question already exists in this category", 1400);
    }
  };

  const updateInterviewQuestionInGroup = (
    groupId: number,
    questionId: string | number,
    rawQuestion: string
  ) => {
    const trimmedQuestion = rawQuestion.trim();
    if (!trimmedQuestion) {
      errorToast("Question cannot be empty", 1400);
      return;
    }

    const normalizedQuestionId = String(questionId);
    let wasUpdated = false;
    let duplicateDetected = false;

    setQuestions((previous) => {
      if (!previous.length) {
        return previous;
      }

      const nextGroups = cloneQuestionGroups(previous);
      const targetIndex = nextGroups.findIndex((group) => group.id === groupId);
      if (targetIndex === -1) {
        return previous;
      }

      const targetGroup = nextGroups[targetIndex];
      const existingQuestions = Array.isArray(targetGroup.questions)
        ? targetGroup.questions
        : [];
      const normalizedNewQuestion = normalizeQuestionText(trimmedQuestion);

      duplicateDetected = existingQuestions.some(
        (item: any) =>
          typeof item?.question === "string" &&
          normalizeQuestionText(item.question) === normalizedNewQuestion &&
          String(item?.id) !== normalizedQuestionId
      );

      if (duplicateDetected) {
        return previous;
      }

      const questionIndex = existingQuestions.findIndex(
        (item: any) => String(item?.id) === normalizedQuestionId
      );

      if (questionIndex === -1) {
        return previous;
      }

      const targetQuestion = existingQuestions[questionIndex];
      if (!isInterviewQuestion(targetQuestion)) {
        return previous;
      }

      targetGroup.questions[questionIndex] = {
        ...targetQuestion,
        origin: QUESTION_ORIGIN.INTERVIEW,
        question: trimmedQuestion,
      };

      wasUpdated = true;
      return nextGroups;
    });

    if (duplicateDetected) {
      errorToast("Question already exists in this category", 1400);
      return;
    }

    if (wasUpdated) {
      candidateActionToast(
        <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>
          Question updated
        </span>,
        1400,
        <i className="la la-check-circle" style={{ color: "#039855", fontSize: 24 }}></i>
      );
    }
  };

  const removeInterviewQuestionFromGroup = (groupId: number, questionId: string | number) => {
    let wasRemoved = false;

    setQuestions((previous) => {
      if (!previous.length) {
        return previous;
      }

      const nextGroups = cloneQuestionGroups(previous);
      const targetIndex = nextGroups.findIndex((group) => group.id === groupId);
      if (targetIndex === -1) {
        return previous;
      }

      const targetGroup = nextGroups[targetIndex];
      const existingQuestions = Array.isArray(targetGroup.questions)
        ? targetGroup.questions
        : [];
      const initialLength = existingQuestions.length;

      const filtered = existingQuestions.filter((item: any) => {
        if (!isInterviewQuestion(item)) {
          return true;
        }
        return String(item?.id) !== String(questionId);
      });

      if (filtered.length === initialLength) {
        return previous;
      }

      targetGroup.questions = filtered;
      ensureQuestionCountWithinBounds(targetGroup);
      wasRemoved = true;
      return nextGroups;
    });

    if (wasRemoved) {
      candidateActionToast(
        <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>
          Question deleted
        </span>,
        1400,
        <i className="la la-check-circle" style={{ color: "#039855", fontSize: 24 }}></i>
      );
    }
  };

  const openQuestionModal = (
    action: QuestionModalAction,
    groupId: number,
    questionToEdit?: { id: string | number; question: string }
  ) => {
    setQuestionModalState({ action, groupId, questionToEdit });
  };

  const closeQuestionModal = () => {
    setQuestionModalState({ action: "", groupId: null, questionToEdit: undefined });
  };

  const handleQuestionModalAction = (
    action: string,
    groupId?: number,
    questionText?: string,
    questionId?: string | number
  ) => {
    if (!action) {
      closeQuestionModal();
      return;
    }

    const resolvedGroupId = groupId ?? questionModalState.groupId;
    if (!resolvedGroupId) {
      closeQuestionModal();
      return;
    }

    if (action === "add" && typeof questionText === "string") {
      addInterviewQuestionToGroup(resolvedGroupId, questionText);
    } else if (
      action === "edit" &&
      typeof questionText === "string" &&
      typeof questionId !== "undefined"
    ) {
      updateInterviewQuestionInGroup(resolvedGroupId, questionId, questionText);
    } else if (action === "delete" && typeof questionId !== "undefined") {
      removeInterviewQuestionFromGroup(resolvedGroupId, questionId);
    }

    closeQuestionModal();
  };

  // Validate prerequisite job details before constructing an AI prompt. Returns trimmed values
  // so the downstream generators do not need to duplicate null/empty checks.
  const ensureJobDetailsForGeneration = () => {
    const jobTitle = draft.jobTitle.trim();
    const plainDescription = (draft.description || "").replace(/<[^>]+>/g, " ").trim();

    if (!jobTitle || !plainDescription) {
      errorToast("Please complete the job title and description first", 1500);
      return null;
    }

    return { jobTitle, plainDescription };
  };

  // Build a numbered list of existing interview questions so the LLM can avoid duplicates when
  // generating new content. Only includes items recognized as interview questions.
  const buildExistingQuestionList = () =>
    questions
      .map((group) => {
        const groupQuestions = Array.isArray(group.questions)
          ? group.questions.filter((question: any) => isInterviewQuestion(question))
          : [];
        if (!groupQuestions.length) {
          return "";
        }

        return groupQuestions
          .map(
            (question: any, index: number) =>
              `          ${index + 1}. ${question.question}`
          )
          .join("\n");
      })
      .filter(Boolean)
      .join("\n");

  // Generate a full set of interview questions across every category. Invokes the shared LLM
  // endpoint, parses the JSON payload, and merges any new questions into the existing state.
  const handleGenerateAllInterviewQuestions = async () => {
    if (pendingQuestionGeneration) {
      return;
    }

    const jobDetails = ensureJobDetailsForGeneration();
    if (!jobDetails) {
      return;
    }

    const categories = Object.keys(interviewQuestionCategoryMap);
    const totalExisting = questions.reduce(
      (acc, group) =>
        acc +
        (Array.isArray(group.questions)
          ? group.questions.filter((question: any) => isInterviewQuestion(question)).length
          : 0),
      0
    );

    const promptSegments = [
      `Generate ${INTERVIEW_QUESTION_COUNT * categories.length} interview questions for the following Job opening:`,
      "Job Title:",
      jobDetails.jobTitle,
      "Job Description:",
      jobDetails.plainDescription,
      categories
        .map((category) => {
          const categoryDetails = interviewQuestionCategoryMap[
            category as keyof typeof interviewQuestionCategoryMap
          ];
          return `Category:\n${category}\nCategory Description:\n${categoryDetails?.description ?? ""}`;
        })
        .join("\n\n"),
      categories
        .map((category) => `${INTERVIEW_QUESTION_COUNT} questions for ${category}`)
        .join(", "),
    ];

    if (totalExisting > 0) {
      promptSegments.push(
        `Do not generate questions that are already covered in this list:\n${buildExistingQuestionList()}`
      );
    }

    if (questionGenPrompt) {
      promptSegments.push(questionGenPrompt);
    }

    promptSegments.push(
      "Respond ONLY with valid JSON.",
      "Use this exact JSON schema:",
  '[{"category":"<category name>","questions":["Question 1","Question 2","Question 3","Question 4","Question 5"]}]',
      "The JSON array must contain one object per interview category listed above, using the same category names.",
  "Each object must list exactly the generated questions in the questions array.",
  `Each questions array must contain exactly ${INTERVIEW_QUESTION_COUNT} items.`,
      "Do not include any explanations, markdown fences, or surrounding text."
    );

    setPendingQuestionGeneration("all");

    try {
      const response = await axios.post("/api/llm-engine", {
        systemPrompt:
          "You are a helpful assistant that can answer questions and help with tasks.",
        prompt: promptSegments.join("\n\n"),
      });

      const parsed = parseGeneratedQuestionPayload(
        response?.data?.result ?? response?.data,
        categories
      );

      console.log("[SegmentedCareerForm] Generate all - Raw response:", response?.data);
      console.log("[SegmentedCareerForm] Generate all - Parsed payload:", parsed);

      const hasChanges = integrateGeneratedQuestions(parsed);

      console.log("[SegmentedCareerForm] Generate all - hasChanges:", hasChanges);

      if (hasChanges) {
        candidateActionToast(
          <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27", marginLeft: 8 }}>
            Questions generated successfully
          </span>,
          1500,
          <i className="la la-check-circle" style={{ color: "#039855", fontSize: 32 }}></i>
        );
      } else {
        errorToast("No new questions generated", 1500);
      }
    } catch (error) {
      console.error("[SegmentedCareerForm] Failed to generate interview questions", error);
      errorToast("Error generating questions, please try again", 1500);
    } finally {
      setPendingQuestionGeneration(null);
    }
  };

  // Generate interview questions for a specific category using the LLM helper, then merge the
  // sanitized results into the local question state. Guards against concurrent generation.
  const handleGenerateQuestionsForCategory = async (categoryName: string) => {
    if (pendingQuestionGeneration) {
      return;
    }

    const jobDetails = ensureJobDetailsForGeneration();
    if (!jobDetails) {
      return;
    }

    const categoryDefinition = interviewQuestionCategoryMap[
      categoryName as keyof typeof interviewQuestionCategoryMap
    ];
    if (!categoryDefinition) {
      errorToast("Unknown interview category", 1500);
      return;
    }

    const promptSegments = [
      `Generate ${INTERVIEW_QUESTION_COUNT} interview questions for the following Job opening:`,
      "Job Title:",
      jobDetails.jobTitle,
      "Job Description:",
      jobDetails.plainDescription,
      "Interview Category:",
      categoryName,
      "Interview Category Description:",
      categoryDefinition.description,
      `The ${INTERVIEW_QUESTION_COUNT} interview questions should be related to the job description and follow the scope of the interview category.`,
    ];

    const totalExisting = questions.reduce(
      (acc, group) =>
        acc +
        (Array.isArray(group.questions)
          ? group.questions.filter((question: any) => isInterviewQuestion(question)).length
          : 0),
      0
    );

    if (totalExisting > 0) {
      promptSegments.push(
        `Do not generate questions that are already covered in this list:\n${buildExistingQuestionList()}`
      );
    }

    if (questionGenPrompt) {
      promptSegments.push(questionGenPrompt);
    }

    promptSegments.push(
      "Respond ONLY with valid JSON.",
      "Return an array containing a single object with this exact structure:",
  `[{"category":"${categoryName}","questions":["Question 1","Question 2","Question 3","Question 4","Question 5"]}]`,
      "Use the category value provided above verbatim.",
      `Provide exactly ${INTERVIEW_QUESTION_COUNT} questions in the questions array.`,
      "Do not include any explanations, markdown fences, or extra text."
    );

    setPendingQuestionGeneration(categoryName);

    try {
      const response = await axios.post("/api/llm-engine", {
        systemPrompt:
          "You are a helpful assistant that can answer questions and help with tasks.",
        prompt: promptSegments.join("\n\n"),
      });

      const parsed = parseGeneratedQuestionPayload(
        response?.data?.result ?? response?.data,
        categoryName
      );

      console.log("[SegmentedCareerForm] Generate category - Raw response:", response?.data);
      console.log("[SegmentedCareerForm] Generate category - Parsed payload:", parsed);

      const hasChanges = integrateGeneratedQuestions(parsed);

      console.log("[SegmentedCareerForm] Generate category - hasChanges:", hasChanges);

      if (hasChanges) {
        candidateActionToast(
          <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27", marginLeft: 8 }}>
            {`Generated ${categoryName} questions`}
          </span>,
          1500,
          <i className="la la-check-circle" style={{ color: "#039855", fontSize: 32 }}></i>
        );
      } else {
        errorToast("No new questions generated", 1500);
      }
    } catch (error) {
      console.error(
        `[SegmentedCareerForm] Failed to generate interview questions for ${categoryName}`,
        error
      );
      errorToast("Error generating questions, please try again", 1500);
    } finally {
      setPendingQuestionGeneration(null);
    }
  };

  // Determine whether a step has met its minimum completion criteria so we can allow forward
  // navigation or publishing. Only career details and AI setup enforce hard requirements.
  const isStepComplete = (step: SegmentedCareerStep) => {
    switch (step) {
      case "career-details":
        return (
          draft.jobTitle.trim().length > 0 &&
          draft.employmentType.trim().length > 0 &&
          draft.workSetup.trim().length > 0 &&
          draft.location.province.trim().length > 0 &&
          draft.location.city.trim().length > 0 &&
          draft.salary.minimum.trim().length > 0 &&
          draft.salary.maximum.trim().length > 0 &&
          isDescriptionPresent(draft.description) &&
          (!teamMembers || teamMembers.length > 0)
        );
      case "cv-screening":
        return true;
      case "ai-setup":
        return totalInterviewQuestionCount >= 5;
      case "pipeline":
        return true;
      case "review":
        return false;
      default:
        return false;
    }
  };

  // Memoized aggregate validity flag used to enable the final review CTA. Keeps render cost low.
  const isFormValid = useMemo(
    () =>
      isStepComplete("career-details") &&
      isStepComplete("cv-screening") &&
      totalInterviewQuestionCount >= 5,
    [questions, draft, teamMembers, totalInterviewQuestionCount]
  );

  // Index of the active step within the segmented wizard configuration.
  const currentStepIndex = useMemo(
    () => segmentedSteps.findIndex((step) => step.id === activeStep),
    [activeStep]
  );

  // Calculate progress (0-1) for the stepper indicator. Adds a half-step buffer while in-progress.
  const progressRatio = useMemo(() => {
    const totalSteps = segmentedSteps.length;
    if (totalSteps === 0 || currentStepIndex < 0) {
      return 0;
    }
    if (totalSteps === 1) {
      return 1;
    }
    const segments = totalSteps - 1;
    const completedSegments = Math.max(0, currentStepIndex);
    let ratio = completedSegments / segments;

    if (currentStepIndex < totalSteps - 1) {
      ratio += 0.5 / segments;
    }

    return Math.min(1, ratio);
  }, [currentStepIndex]);

  const requireVideoSetting = draft.requireVideo ?? true;

  useEffect(() => {
    if (draft.requireVideo === undefined) {
      updateDraft({ requireVideo: true });
    }
    if (draft.cvSecretPrompt === undefined) {
      updateDraft({ cvSecretPrompt: "" });
    }
    if (draft.aiInterviewSecretPrompt === undefined) {
      updateDraft({ aiInterviewSecretPrompt: "" });
    }
  }, [draft.requireVideo, draft.cvSecretPrompt, draft.aiInterviewSecretPrompt, updateDraft]);

  // Persist the current draft and move forward when the active step is complete. Surfaces
  // validation errors inline instead of silently skipping required data.
  const goToNextStep = () => {
    if (currentStepIndex === -1 || currentStepIndex === segmentedSteps.length - 1) {
      return;
    }

    if (!isStepComplete(activeStep)) {
      if (activeStep === "career-details") {
        setShowCareerDetailsErrors(true);
        return;
      }

      if (activeStep === "cv-screening") {
        setShowCvScreeningValidation(true);
        return;
      }

      if (activeStep === "ai-setup") {
        setShowAiQuestionValidation(true);
        return;
      }
      return;
    }

    const nextStep = segmentedSteps[currentStepIndex + 1];
    setActiveStep(nextStep.id);
    persistDraft({}, { orgID, userEmail: user?.email });
  };

  // Navigate backwards within the wizard without mutating persisted draft state.
  const goToPreviousStep = () => {
    if (currentStepIndex <= 0) {
      return;
    }
    const prevStep = segmentedSteps[currentStepIndex - 1];
    setActiveStep(prevStep.id);
  };

  // Prevent users from jumping ahead unless every prior step satisfies its completion rules.
  const canNavigateToStep = (targetStep: SegmentedCareerStep, index: number) => {
    if (index <= currentStepIndex) {
      return true;
    }

    const requiredSteps = segmentedSteps.slice(0, index);
    return requiredSteps.every((step) => isStepComplete(step.id));
  };

  // Build the payload expected by the add/update career APIs. Converts user-friendly primitives
  // into normalized backend fields (salary numbers, team structure, etc.) and preserves audit info.
  const formatCareerPayload = (status: string) => {
    const minimumSalary = draft.salary.minimum
      ? Number(draft.salary.minimum)
      : null;
    const maximumSalary = draft.salary.maximum
      ? Number(draft.salary.maximum)
      : null;

    return {
      ...(career?._id ? { _id: career._id } : {}),
      jobTitle: draft.jobTitle,
      description: draft.description,
      workSetup: draft.workSetup,
      workSetupRemarks: draft.workSetupRemarks,
      cvSecretPrompt: draft.cvSecretPrompt,
      aiInterviewSecretPrompt: draft.aiInterviewSecretPrompt,
      questions,
      lastEditedBy: career?.lastEditedBy || {
        image: user?.image,
        name: user?.name,
        email: user?.email,
      },
      createdBy: career?.createdBy || {
        image: user?.image,
        name: user?.name,
        email: user?.email,
      },
      screeningSetting: draft.screeningSetting,
      requireVideo: requireVideoSetting,
      orgID,
      salaryNegotiable: draft.salary.isNegotiable,
      minimumSalary,
      maximumSalary,
      salaryCurrency: selectedCurrency,
      country: draft.location.country,
      province: draft.location.province,
      location: draft.location.city,
      status,
      employmentType: draft.employmentType,
      teamMembers,
      team: {
        members: teamMembers,
      },
    };
  };

  // Entry point for "Save & Continue" and "Publish". Performs lightweight validation, enforces
  // sequential navigation, and only opens the confirmation modal when the form is actually ready.
  const confirmSaveCareer = (status: string) => {
    if (!status) {
      return;
    }

    const payload = formatCareerPayload(status);
    if (
      payload.minimumSalary !== null &&
      payload.maximumSalary !== null &&
      payload.minimumSalary > payload.maximumSalary
    ) {
      errorToast("Minimum salary cannot exceed maximum salary", 1800);
      return;
    }

    if (status === "active") {
      // On review step, validate all required steps before publishing
      if (isOnReviewStep || currentStepIndex === segmentedSteps.length - 1) {
        if (!isStepComplete("career-details")) {
          setActiveStep("career-details");
          setShowCareerDetailsErrors(true);
          return;
        }

        if (!isStepComplete("ai-setup")) {
          setActiveStep("ai-setup");
          setShowAiQuestionValidation(true);
          return;
        }

        setShowSaveModal(status);
        return;
      }

      // Otherwise just go to next step sequentially
      goToNextStep();
      return;
    }

    setShowSaveModal(status);
  };

  // Persist the career to the server, handling both create and update flows. Applies final
  // validation, writes draft metadata, and provides user feedback/toasts for success or failure.
  const saveCareer = async (status: string) => {
    if (!status || savingCareerRef.current) {
      return;
    }

    const payload = formatCareerPayload(status);

    if (
      payload.minimumSalary !== null &&
      payload.maximumSalary !== null &&
      payload.minimumSalary > payload.maximumSalary
    ) {
      errorToast("Minimum salary cannot exceed maximum salary", 1800);
      return;
    }

    try {
      if (!orgID) {
        errorToast("Missing organization context", 1600);
        return;
      }

      setIsSavingCareer(true);
      savingCareerRef.current = true;
      if (formType === "add") {
        await axios.post("/api/add-career", payload);
        persistDraft(
          { status: "draft", context: { lastPersistedAt: new Date().toISOString() } },
          { orgID, userEmail: user?.email }
        );
        candidateActionToast(
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginLeft: 8,
              fontWeight: 700,
            }}
          >
            Career added {status === "active" ? "and published" : ""}
          </div>,
          1300,
          <i className="la la-check-circle" style={{ color: "#039855", fontSize: 32 }}></i>
        );
        resetDraft();
      } else {
        await axios.post("/api/update-career", payload);
        persistDraft(
          { status, context: { lastPersistedAt: new Date().toISOString() } },
          { orgID, userEmail: user?.email }
        );
        candidateActionToast(
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginLeft: 8,
              fontWeight: 700,
            }}
          >
            Career updated
          </div>,
          1300,
          <i className="la la-check-circle" style={{ color: "#039855", fontSize: 32 }}></i>
        );
      }

      setTimeout(() => {
        window.location.href = `/recruiter-dashboard/careers`;
      }, 1300);
    } catch (error) {
      console.error("Failed to save career", error);
      errorToast("Failed to save career", 1600);
    } finally {
      savingCareerRef.current = false;
      setIsSavingCareer(false);
    }
  };

  // Human-friendly timestamp displayed in the header. Prefers draft context metadata and falls
  // back to the persisted career record if no draft state exists.
  const lastSavedTimestamp = useMemo(() => {
    if (draft.context?.lastPersistedAt) {
      return formatTimestamp(draft.context.lastPersistedAt);
    }

    if (career?.updatedAt) {
      return formatTimestamp(career.updatedAt);
    }

    return "Not saved yet";
  }, [draft.context?.lastPersistedAt, career?.updatedAt]);

  // Render the read-only summary for the "Career Details & Team" accordion within the review step.
  // Ensures missing data is communicated clearly to recruiters ahead of publish.
  const renderCareerReviewSection = () => {
    return (
      <div className={classNames(styles.reviewAccordionBody, styles.reviewCareerBody)}>
        <div className={styles.reviewCareerCard}>
          <div className={styles.reviewCareerSection}>
            <h5 className={styles.reviewCareerFieldLabel}>Job Title</h5>
            <p className={styles.reviewCareerFieldValue}>{draft.jobTitle || "Not specified"}</p>
          </div>

          <div className={styles.reviewCareerFieldsGrid}>
            <div className={styles.reviewCareerSection}>
              <h5 className={styles.reviewCareerFieldLabel}>Employment Type</h5>
              <p className={styles.reviewCareerFieldValue}>{draft.employmentType || "Not specified"}</p>
            </div>
            <div className={styles.reviewCareerSection}>
              <h5 className={styles.reviewCareerFieldLabel}>Work Arrangement</h5>
              <p className={styles.reviewCareerFieldValue}>{draft.workSetup || "Not specified"}</p>
            </div>
          </div>

          <div className={styles.reviewCareerFieldsGrid3}>
            <div className={styles.reviewCareerSection}>
              <h5 className={styles.reviewCareerFieldLabel}>Country</h5>
              <p className={styles.reviewCareerFieldValue}>{draft.location.country || "Not specified"}</p>
            </div>
            <div className={styles.reviewCareerSection}>
              <h5 className={styles.reviewCareerFieldLabel}>State / Province</h5>
              <p className={styles.reviewCareerFieldValue}>{draft.location.province || "Not specified"}</p>
            </div>
            <div className={styles.reviewCareerSection}>
              <h5 className={styles.reviewCareerFieldLabel}>City</h5>
              <p className={styles.reviewCareerFieldValue}>{draft.location.city || "Not specified"}</p>
            </div>
          </div>

          <div className={styles.reviewCareerFieldsGrid}>
            <div className={styles.reviewCareerSection}>
              <h5 className={styles.reviewCareerFieldLabel}>Minimum Salary</h5>
              <p className={styles.reviewCareerFieldValue}>{minimumSalaryDisplay}</p>
            </div>
            <div className={styles.reviewCareerSection}>
              <h5 className={styles.reviewCareerFieldLabel}>Maximum Salary</h5>
              <p className={styles.reviewCareerFieldValue}>{maximumSalaryDisplay}</p>
            </div>
          </div>

          <div className={styles.reviewCareerDivider} aria-hidden="true"></div>
          <div className={styles.reviewCareerSection}>
            <h5 className={styles.reviewCareerFieldLabel}>Job Description</h5>
            {jobDescriptionMarkup ? (
              <div
                className={classNames(styles.reviewRichText, styles.reviewRichTextFramed)}
                dangerouslySetInnerHTML={jobDescriptionMarkup}
              ></div>
            ) : (
              <p className={styles.reviewEmptyState}>No description provided.</p>
            )}
          </div>
          <div className={styles.reviewCareerDivider} aria-hidden="true"></div>
          <div className={styles.reviewCareerSection}>
            <h5 className={styles.reviewCareerFieldLabel}>Team Access</h5>
            {teamMembers.length ? (
              <div className={styles.reviewTeamTable}>
                {teamMembers.map((member: any) => {
                  const displayName = member.name || member.email || "Member";
                  const displayEmail = member.email || "—";
                  return (
                    <div key={member.memberId} className={styles.reviewTeamRow}>
                      <div className={styles.reviewTeamIdentity}>
                        {member.image ? (
                          <img
                            src={member.image}
                            alt={displayName}
                            className={styles.reviewTeamAvatarImage}
                          />
                        ) : (
                          <span className={styles.reviewTeamAvatarFallback} aria-hidden="true">
                            {(displayName || "?").charAt(0)}
                          </span>
                        )}
                        <div className={styles.reviewTeamPrimary}>
                          <span className={styles.reviewTeamName}>{displayName}</span>
                          <span className={styles.reviewTeamEmail}>{displayEmail}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className={styles.reviewEmptyState}>No team members assigned.</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render the CV Review accordion summary, including secret prompts and pre-screening questions.
  // Uses sanitized text and defensive checks so the review UI never breaks due to malformed data.
  const renderCvReviewSection = () => {
    const totalPreScreenQuestions = preScreeningQuestions.length;
    const secretPromptLines =
      typeof draft.cvSecretPrompt === "string"
        ? draft.cvSecretPrompt
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
        : [];
    const screeningDescription = renderScreeningDescription(draft.screeningSetting);

    return (
      <div className={classNames(styles.reviewAccordionBody, styles.reviewCvBody)}>
        <div className={styles.reviewCvCard}>
          <div className={styles.reviewCvHeader}>
            <div className={styles.reviewCvHeaderText}>
              <p className={styles.reviewCvTitle}>CV Screening</p>
              <p className={styles.reviewCvDescription}>{screeningDescription}</p>
            </div>
          </div>

          <div className={styles.reviewCvDivider} aria-hidden="true"></div>

          <section className={styles.reviewCvSection}>
            <header className={styles.reviewCvSectionHeader}>
              <div className={styles.reviewCvSectionTitleGroup}>
                <img
                  alt="CV Secret Prompt"
                  className={styles.secretPromptGlyphImg}
                  src="/assets/icons/ai-sparkles.svg"
                />
                <span className={styles.reviewCvSectionTitle}>CV Secret Prompt</span>
              </div>
            </header>
            {secretPromptLines.length ? (
              <ul className={styles.reviewCvPromptList}>
                {secretPromptLines.map((line, index) => (
                  <li key={`secret-prompt-${index}`}>{line}</li>
                ))}
              </ul>
            ) : (
              <p className={styles.reviewCvEmpty}>No secret prompt provided.</p>
            )}
          </section>

          <div className={styles.reviewCvDivider} aria-hidden="true"></div>

          <section className={styles.reviewCvSection}>
            <header className={styles.reviewCvSectionHeader}>
              <div className={styles.reviewCvSectionTitleGroup}>
                <span className={styles.reviewCvSectionTitle}>Pre-Screening Questions</span>
              </div>
              <span className={styles.reviewCvCountBadge}>{totalPreScreenQuestions}</span>
            </header>
            {totalPreScreenQuestions ? (
              <ol className={styles.reviewCvQuestionList}>
                {preScreeningQuestions.map((question: any, index: number) => {
                  const questionText =
                    typeof question?.question === "string" && question.question.trim().length
                      ? question.question.trim()
                      : `Question ${index + 1}`;
                  const answerType =
                    typeof question?.answerType === "string"
                      ? (question.answerType as PreScreenQuestionType)
                      : "short_text";
                  const optionLabels = Array.isArray(question?.options)
                    ? question.options
                        .map((option: any) => option?.label)
                        .filter((label: any) => typeof label === "string" && label.trim().length)
                    : [];
                  const hasRangeValues = answerType === "range";

                  return (
                    <li key={question?.id ?? `pre-screen-${index}`} className={styles.reviewCvQuestion}>
                      <div className={styles.reviewCvQuestionText}>{questionText}</div>
                      {optionLabels.length > 0 && (
                        <ul className={styles.reviewCvOptionList}>
                          {optionLabels.map((label: string, optionIndex: number) => (
                            <li key={`${question?.id ?? index}-option-${optionIndex}`}>{label}</li>
                          ))}
                        </ul>
                      )}
                      {hasRangeValues && (
                        <div className={styles.reviewCvQuestionMeta}>
                          Preferred range: {question?.rangeMin || "—"} – {question?.rangeMax || "—"}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className={styles.reviewCvEmpty}>No pre-screening questions configured.</p>
            )}
          </section>
        </div>
      </div>
    );
  };

  // Render the AI setup summary including secret prompts, toggles, and the generated/manual
  // interview questions grouped by category. Uses a running index to maintain ordered lists.
  const renderAiReviewSection = () => {
    const populatedInterviewGroups = interviewQuestionGroups.filter(
      (group) => group.interviewQuestions.length > 0
    );
    const secretPromptLines =
      typeof draft.aiInterviewSecretPrompt === "string"
        ? draft.aiInterviewSecretPrompt
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
        : [];
    const screeningDescription = renderScreeningDescription(draft.screeningSetting);
    const requireVideoLabel = requireVideoSetting ? "Yes" : "No";
    let runningQuestionIndex = 0;

    return (
      <div className={classNames(styles.reviewAccordionBody, styles.reviewAiBody)}>
        <div className={styles.reviewAiCard}>
          <div className={styles.reviewAiHeader}>
            <div className={styles.reviewAiHeaderText}>
              <p className={styles.reviewAiTitle}>AI Interview Screening</p>
              <p className={styles.reviewAiDescription}>{screeningDescription}</p>
            </div>
          </div>

          <div className={styles.reviewAiMetaRow}>
            <div className={styles.reviewAiMetaItem}>
              <span className={styles.reviewAiMetaLabel}>Require Video on Interview</span>
              <span className={styles.reviewAiMetaValue}>
                {requireVideoLabel}
                {requireVideoSetting && (
                  <span className={styles.reviewAiMetaIcon} aria-hidden="true">
                    <i className="la la-check"></i>
                  </span>
                )}
              </span>
            </div>
          </div>

          <div className={styles.reviewAiDivider} aria-hidden="true"></div>

          <section className={styles.reviewAiSection}>
            <header className={styles.reviewAiSectionHeader}>
              <div className={styles.reviewAiSectionTitleGroup}>
                <img
                  alt="AI Interview Secret Prompt"
                  className={styles.secretPromptGlyphImg}
                  src="/assets/icons/ai-sparkles.svg"
                />
                <span className={styles.reviewAiSectionTitle}>AI Interview Secret Prompt</span>
              </div>
            </header>
            {secretPromptLines.length ? (
              <ul className={styles.reviewAiPromptList}>
                {secretPromptLines.map((line, index) => (
                  <li key={`ai-secret-prompt-${index}`}>{line}</li>
                ))}
              </ul>
            ) : (
              <p className={styles.reviewAiEmpty}>No secret prompt provided.</p>
            )}
          </section>

          <div className={styles.reviewAiDivider} aria-hidden="true"></div>

          <section className={styles.reviewAiSection}>
            <header className={styles.reviewAiSectionHeader}>
              <span className={styles.reviewAiSectionTitle}>Interview Questions</span>
              <span className={styles.reviewAiCountBadge}>{totalInterviewQuestionCount}</span>
            </header>
            {populatedInterviewGroups.length ? (
              <div className={styles.reviewAiQuestionGroups}>
                {populatedInterviewGroups.map((group) => {
                  if (!group.interviewQuestions.length) {
                    return null;
                  }
                  const startIndex = runningQuestionIndex + 1;
                  runningQuestionIndex += group.interviewQuestions.length;

                  return (
                    <div key={group.id} className={styles.reviewAiQuestionGroup}>
                      <div className={styles.reviewAiQuestionGroupHeader}>
                        <span className={styles.reviewAiQuestionCategory}>
                          {group.category || "Interview Questions"}
                        </span>
                      </div>
                      <ol className={styles.reviewAiQuestionList} start={startIndex}>
                        {group.interviewQuestions.map((question: any, index: number) => {
                          const questionText =
                            typeof question?.question === "string" && question.question.trim().length
                              ? question.question.trim()
                              : `Question ${startIndex + index}`;
                          return (
                            <li
                              key={question?.id ?? `interview-${group.id}-${index}`}
                              className={styles.reviewAiQuestion}
                            >
                              <span className={styles.reviewAiQuestionText}>{questionText}</span>
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className={styles.reviewAiEmpty}>No interview questions configured.</p>
            )}
          </section>
        </div>
      </div>
    );
  };

  const reviewSectionTargetStep: Record<ReviewSectionKey, SegmentedCareerStep> = {
    career: "career-details",
    cv: "cv-screening",
    ai: "ai-setup",
  };

  // When a recruiter clicks "Edit" inside the review accordion, jump back to the corresponding
  // wizard step and reset any stale validation banners for that section.
  const handleReviewSectionEdit = (
    sectionKey: ReviewSectionKey,
    event: ReactMouseEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const targetStep = reviewSectionTargetStep[sectionKey];
    if (!targetStep) {
      return;
    }

    setActiveStep(targetStep);

    if (sectionKey === "career") {
      setShowCareerDetailsErrors(false);
    }

    if (sectionKey === "cv") {
      setShowCvScreeningValidation(false);
    }

    if (sectionKey === "ai") {
      setShowAiQuestionValidation(false);
    }
  };

  const reviewSections: Array<{
    key: ReviewSectionKey;
    title: string;
    subtitle: string;
    meta: string;
    render: () => ReactNode;
  }> = [
    {
      key: "career",
      title: "Career Details & Team Access",
      subtitle: "Step 1",
      meta: "",
      render: renderCareerReviewSection,
    },
    {
      key: "cv",
      title: "CV Review & Pre-Screening",
      subtitle: "Step 2",
      meta: "",
      render: renderCvReviewSection,
    },
    {
      key: "ai",
      title: "AI Interview Setup",
      subtitle: "Step 3",
      meta: "",
      render: renderAiReviewSection,
    },
  ];

  return (
    <div className={styles.wrapper}>
      <div className={styles.pageHeader}>
        <div className={styles.headerRow}>
          <div className={styles.titleGroup}>
            <h1>{formType === "add" ? "Add new career" : "Edit career"}</h1>
          </div>
          <div className={styles.actions}>
            <button
              className={styles.ghostButton}
              type="button"
              disabled={isSavingCareer}
              onClick={() => confirmSaveCareer("inactive")}
            >
              Save as Unpublished
            </button>
            <button
              className={styles.primaryButton}
              type="button"
              disabled={isSavingCareer}
              onClick={() => confirmSaveCareer("active")}
            >
              {isOnReviewStep ? "Publish" : "Save and Continue"}
              {!isOnReviewStep && <i className="la la-arrow-right"></i>}
            </button>
          </div>
        </div>
        <div
          className={styles.stepper}
          style={{
            "--progress-percentage": `${progressRatio}`,
          } as CSSProperties}
        >
          {segmentedSteps.map((step, index) => {
            const isActive = step.id === activeStep;
            const isCompleted = index < currentStepIndex && isStepComplete(step.id);
            const canNavigate = canNavigateToStep(step.id, index);
            const stepHasErrors =
              (step.id === "career-details" &&
                showCareerDetailsErrors &&
                !isStepComplete("career-details")) ||
              (step.id === "cv-screening" &&
                showCvScreeningValidation &&
                !isStepComplete("cv-screening")) ||
              (step.id === "ai-setup" && showAiQuestionValidation && totalInterviewQuestionCount < 5);
            const isReviewStepper = step.id === "review";
            
            let stepProgressWidth = 0;
            if (isCompleted) {
              stepProgressWidth = 100;
            } else if (isActive) {
              const stepHasAnyData = isStepComplete(step.id);
              stepProgressWidth = stepHasAnyData ? 50 : 0;
            }
            
            return (
              <button
                key={step.id}
                type="button"
                className={classNames(styles.step, {
                  [styles.active]: isActive,
                  [styles.done]: isCompleted,
                  [styles.disabled]: !canNavigate,
                })}
                onClick={() => canNavigate && setActiveStep(step.id)}
                disabled={!canNavigate}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%" }}>
                  <span
                    className={classNames(
                      stepHasErrors ? styles.stepErrorIndicator : styles.stepIndicator
                    )}
                  >
                    {stepHasErrors ? (
                      <i className="la la-exclamation-triangle" aria-hidden="true"></i>
                    ) : isCompleted ? (
                      <i className="la la-check" aria-hidden="true"></i>
                    ) : (
                      <span className={styles.stepDot} aria-hidden="true" />
                    )}
                  </span>
                  {!isReviewStepper && (
                    <div
                      className={styles.stepProgress}
                      style={{ "--step-progress": `${stepProgressWidth}%`, margin: 0 } as CSSProperties}
                    />
                  )}
                </div>
                <span
                  className={classNames(styles.stepLabel, {
                    [styles.stepLabelError]: stepHasErrors,
                  })}
                >
                  {step.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.stepContent}>
        <div className={styles.primaryColumn}>
          {activeStep === "career-details" && (
            <CareerDetailsTeamAccessStep
              draft={draft}
              updateDraft={updateDraft}
              teamMembers={teamMembers}
              showErrors={showCareerDetailsErrors}
              user={user}
              orgID={orgID}
              career={career}
              selectedCurrency={selectedCurrency}
              currencySymbol={currencySymbol}
              RichTextEditorComponent={RichTextEditor}
            />
                                        )}



          {activeStep === "cv-screening" && (
            <CvReviewPreScreeningStep
              draft={draft}
              updateDraft={updateDraft}
              showValidation={showCvScreeningValidation}
              isStepComplete={isStepComplete("cv-screening")}
              isDescriptionPresent={isDescriptionPresent}
              secretPromptIds={secretPromptFieldIds.cv}
              preScreeningQuestions={preScreeningQuestions}
              openPreScreenTypeFor={openPreScreenTypeFor}
              setOpenPreScreenTypeFor={setOpenPreScreenTypeFor}
              activeDragQuestionId={activeDragQuestionId}
              setActiveDragQuestionId={setActiveDragQuestionId}
              draggingQuestionId={draggingQuestionId}
              dragOverQuestionId={dragOverQuestionId}
              setDragOverQuestionId={setDragOverQuestionId}
              isDragOverTail={isDragOverTail}
              setIsDragOverTail={setIsDragOverTail}
              onAddPreScreenQuestion={handleAddPreScreenQuestion}
              onAddCustomPreScreenQuestion={handleAddCustomPreScreenQuestion}
              onUpdatePreScreenQuestion={handleUpdatePreScreenQuestion}
              onUpdatePreScreenRange={handleUpdatePreScreenRange}
              onAddPreScreenOption={handleAddPreScreenOption}
              onUpdatePreScreenOption={handleUpdatePreScreenOption}
              onRemovePreScreenOption={handleRemovePreScreenOption}
              onRemovePreScreenQuestion={handleRemovePreScreenQuestion}
              onReorderPreScreenQuestions={handleReorderPreScreenQuestions}
              onPreScreenDragStart={handlePreScreenDragStart}
              onPreScreenDragOver={handlePreScreenDragOver}
              onPreScreenDrop={handlePreScreenDrop}
              onPreScreenDragLeave={handlePreScreenDragLeave}
              onPreScreenDragEnd={handlePreScreenDragEnd}
            />
          )}

          {activeStep === "ai-setup" && (
            <AiInterviewSetupStep
              draft={draft}
              updateDraft={updateDraft}
              secretPromptIds={secretPromptFieldIds.ai}
              totalInterviewQuestionCount={totalInterviewQuestionCount}
              showAiQuestionValidation={showAiQuestionValidation}
              questions={questions}
              isInterviewQuestion={isInterviewQuestion}
              draggingInterviewQuestionId={draggingInterviewQuestionId}
              dragOverInterviewQuestionId={dragOverInterviewQuestionId}
              activeDragInterviewGroupId={activeDragInterviewGroupId}
              interviewTailHoverGroupId={interviewTailHoverGroupId}
              pendingQuestionGeneration={pendingQuestionGeneration}
              isGeneratingQuestions={isGeneratingQuestions}
              onGenerateAll={handleGenerateAllInterviewQuestions}
              onGenerateForCategory={handleGenerateQuestionsForCategory}
              onDragStart={handleInterviewDragStart}
              onDragEnter={handleInterviewDragEnter}
              onDragOver={handleInterviewDragOver}
              onDragLeave={handleInterviewDragLeave}
              onDrop={handleInterviewDrop}
              onDragEnd={handleInterviewDragEnd}
              onTailDragOver={handleInterviewTailDragOver}
              onTailDragLeave={handleInterviewTailDragLeave}
              onTailDrop={handleInterviewTailDrop}
              openQuestionModal={openQuestionModal}
            />
          )}

          {activeStep === "pipeline" && (
            <PipelineStagesStep
              onBack={goToPreviousStep}
              onNext={goToNextStep}
            />
          )}

          {activeStep === "review" && (
            <ReviewCareerStep
              sections={reviewSections}
              expandedSections={expandedReviewSections}
              onToggleSection={toggleReviewSection}
              onEditSection={handleReviewSectionEdit}
            />
          )}
        </div>

        {activeStep !== "review" && (
          <aside className={styles.secondaryColumn}>
            <div className={styles.tipsCard}>
              <div className={styles.tipsHeader}>
                <span className={styles.tipsBadge} aria-hidden="true">
                <svg
                  className={styles.tipsIcon}
                  viewBox="0 0 48 48"
                  role="presentation"
                  focusable="false"
                >
                  <defs>
                    <linearGradient
                      id={tipsBulbGradientId}
                      x1="12"
                      y1="8"
                      x2="36"
                      y2="40"
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop offset="0" stopColor="#f9a8d4" />
                      <stop offset="0.5" stopColor="#c4b5fd" />
                      <stop offset="1" stopColor="#93c5fd" />
                    </linearGradient>
                    <linearGradient
                      id={tipsStarGradientId}
                      x1="34"
                      y1="10"
                      x2="42"
                      y2="20"
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop offset="0" stopColor="#c4b5fd" />
                      <stop offset="1" stopColor="#93c5fd" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M24 6C16.82 6 11 11.82 11 19c0 4.82 2.65 8.97 6.57 11.16L18 33h12l-.57-2.84C31.35 27.97 34 23.82 34 19c0-7.18-5.82-13-13-13Z"
                    fill="none"
                    stroke={`url(#${tipsBulbGradientId})`}
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M19 34h10"
                    stroke={`url(#${tipsBulbGradientId})`}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M20.5 38h7"
                    stroke={`url(#${tipsBulbGradientId})`}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M22 42h3.5"
                    stroke={`url(#${tipsBulbGradientId})`}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M36 11.5 37.2 14l2.6.3-1.9 1.8.5 2.4-2.2-1.2-2.1 1.2.4-2.4-1.9-1.8 2.6-.3z"
                    fill={`url(#${tipsStarGradientId})`}
                    fillOpacity="0.9"
                  />
                  <path
                    d="m41 18.2.6 1.3 1.4.1-1 1 .3 1.3-1.2-.7-1.2.7.3-1.3-1-1 1.4-.1z"
                    fill={`url(#${tipsStarGradientId})`}
                    fillOpacity="0.75"
                  />
                </svg>
                </span>
                <span className={styles.tipsTitle}>Tips</span>
              </div>
              <div className={styles.tipsBody}>
                <ul className={styles.tipsList}>
                  {tipsContent.map((tip) => (
                    <li key={tip.heading}>
                      <strong>{tip.heading}</strong>
                      <span>{tip.body}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>
        )}
      </div>

      {questionModalState.action && questionModalState.groupId !== null && (
        <InterviewQuestionModal
          groupId={questionModalState.groupId}
          questionToEdit={questionModalState.questionToEdit}
          action={questionModalState.action}
          onAction={handleQuestionModalAction}
        />
      )}

      {showSaveModal && (
        <CareerActionModal
          action={showSaveModal}
          onAction={(action) => {
            setShowSaveModal("");
            if (action) {
              saveCareer(action);
            }
          }}
        />
      )}

      {isSavingCareer && (
        <FullScreenLoadingAnimation
          title={formType === "add" ? "Saving career..." : "Updating career..."}
          subtext={`Please wait while we are ${
            formType === "add" ? "saving" : "updating"
          } the career`}
        />
      )}
    </div>
  );
}