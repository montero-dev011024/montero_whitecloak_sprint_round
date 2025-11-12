"use client";

import {
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
import FormHeader from "./SegmentedCareerForm/components/FormHeader";
import FormStepper from "./SegmentedCareerForm/components/FormStepper";
import FormTipsSidebar from "./SegmentedCareerForm/components/FormTipsSidebar";
import SegmentedCareerStepperContent from "./SegmentedCareerForm/components/SegmentedCareerStepperContent";
import useSalaryFormatting from "./SegmentedCareerForm/hooks/useSalaryFormatting";
import useFormValidation from "./SegmentedCareerForm/hooks/useFormValidation";
import useQuestionManagement from "./SegmentedCareerForm/hooks/useQuestionManagement";
import useQuestionGeneration from "./SegmentedCareerForm/hooks/useQuestionGeneration";
import useStepperNavigation from "./SegmentedCareerForm/hooks/useStepperNavigation";
import useReviewSections from "./SegmentedCareerForm/hooks/useReviewSections";
import useCareerPersistence from "./SegmentedCareerForm/hooks/useCareerPersistence";
import { ReviewSectionKey } from "./SegmentedCareerForm/segmentTypes";
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
  const [showCvScreeningValidation, setShowCvScreeningValidation] = useState(false);
  const [showAiQuestionValidation, setShowAiQuestionValidation] = useState(false);
  const [expandedReviewSections, setExpandedReviewSections] = useState<Record<ReviewSectionKey, boolean>>({
    career: true,
    cv: true,
    ai: true,
  });
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
  const {
    pendingQuestionGeneration,
    isGeneratingQuestions,
    handleGenerateAllInterviewQuestions,
    handleGenerateQuestionsForCategory,
  } = useQuestionGeneration({
    draft,
    questions,
    questionGenPrompt,
    integrateGeneratedQuestions,
    parseGeneratedQuestionPayload,
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
  const { isStepComplete, isFormValid } = useFormValidation({
    draft,
    teamMembers,
    totalInterviewQuestionCount,
    isDescriptionPresent,
  });
  const {
    currentStepIndex,
    progressRatio,
    goToNextStep,
    goToPreviousStep,
    canNavigateToStep,
  } = useStepperNavigation({
    activeStep,
    setActiveStep,
    isStepComplete,
    onCareerDetailsIncomplete: () => setShowCareerDetailsErrors(true),
    onCvScreeningIncomplete: () => setShowCvScreeningValidation(true),
    onAiSetupIncomplete: () => setShowAiQuestionValidation(true),
    persistDraft,
    orgID,
    userEmail: user?.email ?? null,
  });

  const requireVideoSetting = draft.requireVideo ?? true;
  const { reviewSections, handleReviewSectionEdit } = useReviewSections({
    draft,
    teamMembers,
    minimumSalaryDisplay,
    maximumSalaryDisplay,
    jobDescriptionMarkup,
    preScreeningQuestions,
    requireVideoSetting,
    totalInterviewQuestionCount,
    interviewQuestionGroups,
    setActiveStep,
    resetCareerDetailsErrors: () => setShowCareerDetailsErrors(false),
    resetCvScreeningValidation: () => setShowCvScreeningValidation(false),
    resetAiQuestionValidation: () => setShowAiQuestionValidation(false),
  });

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

  const {
    isSavingCareer,
    showSaveModal,
    setShowSaveModal,
    confirmSaveCareer,
    saveCareer,
  } = useCareerPersistence({
    draft,
    career,
    questions,
    teamMembers,
    requireVideoSetting,
    selectedCurrency,
    user,
    orgID,
    formType,
    persistDraft,
    resetDraft,
    isStepComplete,
    isOnReviewStep,
    currentStepIndex,
    setActiveStep,
    goToNextStep,
    setShowCareerDetailsErrors,
    setShowAiQuestionValidation,
  });

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
          <SegmentedCareerStepperContent
            activeStep={activeStep}
            draft={draft}
            updateDraft={updateDraft}
            teamMembers={teamMembers}
            showCareerDetailsErrors={showCareerDetailsErrors}
            user={user}
            orgID={orgID}
            career={career}
            selectedCurrency={selectedCurrency}
            currencySymbol={currencySymbol}
            RichTextEditorComponent={RichTextEditor}
            showCvScreeningValidation={showCvScreeningValidation}
            isCvStepComplete={isStepComplete("cv-screening")}
            isDescriptionPresent={isDescriptionPresent}
            cvSecretPromptIds={secretPromptFieldIds.cv}
            aiSecretPromptIds={secretPromptFieldIds.ai}
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
            onGenerateAllInterviewQuestions={handleGenerateAllInterviewQuestions}
            onGenerateQuestionsForCategory={handleGenerateQuestionsForCategory}
            onInterviewDragStart={handleInterviewDragStart}
            onInterviewDragEnter={handleInterviewDragEnter}
            onInterviewDragOver={handleInterviewDragOver}
            onInterviewDragLeave={handleInterviewDragLeave}
            onInterviewDrop={handleInterviewDrop}
            onInterviewDragEnd={handleInterviewDragEnd}
            onInterviewTailDragOver={handleInterviewTailDragOver}
            onInterviewTailDragLeave={handleInterviewTailDragLeave}
            onInterviewTailDrop={handleInterviewTailDrop}
            openQuestionModal={openQuestionModal}
            goToPreviousStep={goToPreviousStep}
            goToNextStep={goToNextStep}
            reviewSections={reviewSections}
            expandedReviewSections={expandedReviewSections}
            onToggleReviewSection={toggleReviewSection}
            onEditReviewSection={handleReviewSectionEdit}
          />
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