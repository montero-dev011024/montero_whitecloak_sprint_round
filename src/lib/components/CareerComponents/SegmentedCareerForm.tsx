"use client";

import {
  CSSProperties,
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
import FormHeader from "./SegmentedCareerForm/components/FormHeader";
import FormStepper from "./SegmentedCareerForm/components/FormStepper";
import ReviewCareerSection from "./SegmentedCareerForm/components/ReviewCareerSection";
import ReviewCvSection from "./SegmentedCareerForm/components/ReviewCvSection";
import ReviewAiSection from "./SegmentedCareerForm/components/ReviewAiSection";
import FormTipsSidebar from "./SegmentedCareerForm/components/FormTipsSidebar";
import useSalaryFormatting from "./SegmentedCareerForm/hooks/useSalaryFormatting";
import useFormValidation from "./SegmentedCareerForm/hooks/useFormValidation";
import useQuestionManagement from "./SegmentedCareerForm/hooks/useQuestionManagement";
import {
  isInterviewQuestion,
  normalizeQuestionGroups,
} from "./SegmentedCareerForm/utils/questionUtils";
import {
  INTERVIEW_QUESTION_COUNT,
  SCREENING_SETTING_OPTIONS,
  SEGMENTED_DRAFT_STORAGE_KEY,
  SUGGESTED_PRE_SCREENING_QUESTIONS,
  SuggestedPreScreenQuestion,
  getPreScreenTypeLabel,
  PRE_SCREEN_TYPE_OPTIONS,
} from "./SegmentedCareerForm/constants";
import CvReviewPreScreeningStep from "./SegmentedCareerForm/steps/CvReviewPreScreeningStep";
import AiInterviewSetupStep from "./SegmentedCareerForm/steps/AiInterviewSetupStep";

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
  const [questionGenPrompt, setQuestionGenPrompt] = useState("");
  const [pendingQuestionGeneration, setPendingQuestionGeneration] = useState<string | null>(null);
  const [showCvScreeningValidation, setShowCvScreeningValidation] = useState(false);
  const [showAiQuestionValidation, setShowAiQuestionValidation] = useState(false);
  const [expandedReviewSections, setExpandedReviewSections] = useState<Record<ReviewSectionKey, boolean>>({
    career: true,
    cv: true,
    ai: true,
  });
  const isGeneratingQuestions = pendingQuestionGeneration !== null;
  const isOnReviewStep = activeStep === "review";

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

  const [openPreScreenTypeFor, setOpenPreScreenTypeFor] = useState<string | null>(null);
  const {
    preScreeningQuestions,
    interviewQuestionGroups,
    activeDragQuestionId,
    setActiveDragQuestionId,
    draggingQuestionId,
    setDraggingQuestionId,
    dragOverQuestionId,
    setDragOverQuestionId,
    isDragOverTail,
    setIsDragOverTail,
    handleAddPreScreenQuestion,
    handleRemovePreScreenQuestion,
    handleUpdatePreScreenQuestion,
    handleReorderPreScreenQuestions,
    handlePreScreenDragStart,
    handlePreScreenDragOver,
    handlePreScreenDrop,
    handlePreScreenDragLeave,
    handlePreScreenDragEnd,
    handleUpdatePreScreenRange,
    handleAddPreScreenOption,
    handleUpdatePreScreenOption,
    handleRemovePreScreenOption,
    handleAddCustomPreScreenQuestion,
    draggingInterviewQuestionId,
    setDraggingInterviewQuestionId,
    dragOverInterviewQuestionId,
    setDragOverInterviewQuestionId,
    activeDragInterviewGroupId,
    setActiveDragInterviewGroupId,
    interviewTailHoverGroupId,
    setInterviewTailHoverGroupId,
    handleReorderInterviewQuestions,
    handleInterviewDragStart,
    handleInterviewDragEnter,
    handleInterviewDragOver,
    handleInterviewDragLeave,
    handleInterviewDrop,
    handleInterviewDragEnd,
    handleInterviewTailDragOver,
    handleInterviewTailDragLeave,
    handleInterviewTailDrop,
    addInterviewQuestionToGroup,
    updateInterviewQuestionInGroup,
    removeInterviewQuestionFromGroup,
    integrateGeneratedQuestions,
    parseGeneratedQuestionPayload,
    questionModalState,
    openQuestionModal,
    closeQuestionModal,
    handleQuestionModalAction,
  } = useQuestionManagement({
    questions,
    setQuestions,
    setOpenPreScreenTypeFor,
  });
  const totalInterviewQuestionCount = useMemo(
    () =>
      interviewQuestionGroups.reduce(
        (total, group) => total + group.interviewQuestions.length,
        0
      ),
    [interviewQuestionGroups]
  );
  // Clear the AI validation banner once the minimum question requirement has been satisfied.
  useEffect(() => {
    if (totalInterviewQuestionCount >= 5 && showAiQuestionValidation) {
      setShowAiQuestionValidation(false);
    }
  }, [totalInterviewQuestionCount, showAiQuestionValidation]);
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
  const persistedDraftQuestionsRef = useRef<string | null>(null);
  const hasHydratedDraftRef = useRef(false);

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
  const {
    selectedCurrency,
    currencySymbol,
    minimumSalaryDisplay,
    maximumSalaryDisplay,
  } = useSalaryFormatting(draft.salary);

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

      const addedCount = Number(integrateGeneratedQuestions(parsed));

      console.log("[SegmentedCareerForm] Generate all - addedCount:", addedCount);

      if (addedCount > 0) {
        candidateActionToast(
          <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27", marginLeft: 8 }}>
            {`Generated ${addedCount} new question${addedCount === 1 ? "" : "s"}`}
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

      const addedCount = Number(integrateGeneratedQuestions(parsed));

      console.log("[SegmentedCareerForm] Generate category - addedCount:", addedCount);

      if (addedCount > 0) {
        candidateActionToast(
          <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27", marginLeft: 8 }}>
            {`Generated ${addedCount} ${categoryName} question${addedCount === 1 ? "" : "s"}`}
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

  const { isStepComplete, isFormValid } = useFormValidation({
    draft,
    teamMembers,
    totalInterviewQuestionCount,
    isDescriptionPresent,
  });

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

    const screeningDescription = renderScreeningDescription(draft.screeningSetting);

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
      render: () => (
        <ReviewCareerSection
          draft={draft}
          teamMembers={teamMembers}
          minimumSalaryDisplay={minimumSalaryDisplay}
          maximumSalaryDisplay={maximumSalaryDisplay}
          jobDescriptionMarkup={jobDescriptionMarkup}
        />
      ),
    },
    {
      key: "cv",
      title: "CV Review & Pre-Screening",
      subtitle: "Step 2",
      meta: "",
      render: () => (
        <ReviewCvSection
          cvSecretPrompt={draft.cvSecretPrompt}
          screeningDescription={screeningDescription}
          preScreeningQuestions={preScreeningQuestions}
        />
      ),
    },
    {
      key: "ai",
      title: "AI Interview Setup",
      subtitle: "Step 3",
      meta: "",
      render: () => (
        <ReviewAiSection
          aiSecretPrompt={draft.aiInterviewSecretPrompt}
          screeningDescription={screeningDescription}
          requireVideoSetting={requireVideoSetting}
          totalInterviewQuestionCount={totalInterviewQuestionCount}
          interviewQuestionGroups={interviewQuestionGroups}
        />
      ),
    },
  ];

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

  return (
    <div className={styles.wrapper}>
      <div className={styles.pageHeader}>
        <FormHeader
          formType={formType}
          isOnReviewStep={isOnReviewStep}
          isSavingCareer={isSavingCareer}
          onSaveUnpublished={() => confirmSaveCareer("inactive")}
          onSaveAndContinue={() => confirmSaveCareer("active")}
        />
        <FormStepper
          activeStep={activeStep}
          currentStepIndex={currentStepIndex}
          showCareerDetailsErrors={showCareerDetailsErrors}
          showCvScreeningValidation={showCvScreeningValidation}
          showAiQuestionValidation={showAiQuestionValidation}
          totalInterviewQuestionCount={totalInterviewQuestionCount}
          progressRatio={progressRatio}
          isStepComplete={isStepComplete}
          canNavigateToStep={canNavigateToStep}
          onStepClick={setActiveStep}
                    />
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
          <FormTipsSidebar
            tipsContent={tipsContent}
            tipsBulbGradientId={tipsBulbGradientId}
            tipsStarGradientId={tipsStarGradientId}
          />
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