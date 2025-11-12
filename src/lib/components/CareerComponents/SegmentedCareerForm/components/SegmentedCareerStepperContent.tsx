"use client";

import type { ComponentType, Dispatch, DragEvent, SetStateAction } from "react";

import type {
  QuestionGroup,
  SegmentedCareerStep,
} from "@/lib/hooks/useSegmentedCareerFormState";

import CareerDetailsTeamAccessStep from "../steps/CareerDetailsTeamAccessStep";
import CvReviewPreScreeningStep from "../steps/CvReviewPreScreeningStep";
import AiInterviewSetupStep from "../steps/AiInterviewSetupStep";
import PipelineStagesStep from "../steps/PipelineStagesStep";
import ReviewCareerStep from "../steps/ReviewCareerStep";
import type { ReviewSectionKey } from "../segmentTypes";

interface SecretPromptIdentifiers {
  input: string;
  description: string;
}

interface SegmentedCareerStepperContentProps {
  activeStep: SegmentedCareerStep;
  draft: any;
  updateDraft: (update: Record<string, unknown>) => void;
  teamMembers: any[];
  showCareerDetailsErrors: boolean;
  user: any;
  orgID?: string | null;
  career?: any;
  selectedCurrency: string;
  currencySymbol: string;
  RichTextEditorComponent: ComponentType<{ text: string; setText: (value: string) => void }>;

  // CV Review & Pre-screening step
  showCvScreeningValidation: boolean;
  isCvStepComplete: boolean;
  isDescriptionPresent: (value?: string) => boolean;
  cvSecretPromptIds: SecretPromptIdentifiers;
  aiSecretPromptIds: SecretPromptIdentifiers;
  preScreeningQuestions: any[];
  openPreScreenTypeFor: string | null;
  setOpenPreScreenTypeFor: Dispatch<SetStateAction<string | null>>;
  activeDragQuestionId: string | null;
  setActiveDragQuestionId: Dispatch<SetStateAction<string | null>>;
  draggingQuestionId: string | null;
  dragOverQuestionId: string | null;
  setDragOverQuestionId: Dispatch<SetStateAction<string | null>>;
  isDragOverTail: boolean;
  setIsDragOverTail: Dispatch<SetStateAction<boolean>>;
  onAddPreScreenQuestion: (
    questionText: string,
    template?: {
      answerType?: string;
      options?: string[];
      rangeDefaults?: { min?: string; max?: string };
    }
  ) => void;
  onAddCustomPreScreenQuestion: () => void;
  onUpdatePreScreenQuestion: (
    questionId: string,
    updates: Partial<{ question: string; answerType: string }>
  ) => void;
  onUpdatePreScreenRange: (questionId: string, key: "rangeMin" | "rangeMax", value: string) => void;
  onAddPreScreenOption: (questionId: string) => void;
  onUpdatePreScreenOption: (questionId: string, optionId: string, label: string) => void;
  onRemovePreScreenOption: (questionId: string, optionId: string) => void;
  onRemovePreScreenQuestion: (questionId: string) => void;
  onReorderPreScreenQuestions: (sourceQuestionId: string, targetQuestionId: string | null) => void;
  onPreScreenDragStart: (event: DragEvent<HTMLDivElement>, questionId: string) => void;
  onPreScreenDragOver: (event: DragEvent<HTMLDivElement>, targetQuestionId: string) => void;
  onPreScreenDrop: (event: DragEvent<HTMLDivElement>, targetQuestionId: string) => void;
  onPreScreenDragLeave: (targetQuestionId: string) => void;
  onPreScreenDragEnd: () => void;

  // AI Interview step
  totalInterviewQuestionCount: number;
  showAiQuestionValidation: boolean;
  questions: QuestionGroup[];
  isInterviewQuestion: (question: any) => boolean;
  draggingInterviewQuestionId: string | null;
  dragOverInterviewQuestionId: string | null;
  activeDragInterviewGroupId: number | null;
  interviewTailHoverGroupId: number | null;
  pendingQuestionGeneration: string | null;
  isGeneratingQuestions: boolean;
  onGenerateAllInterviewQuestions: () => Promise<void>;
  onGenerateQuestionsForCategory: (categoryName: string) => Promise<void>;
  onInterviewDragStart: (event: DragEvent<HTMLButtonElement>, questionId: string, groupId: number) => void;
  onInterviewDragEnter: (event: DragEvent<HTMLDivElement>, questionId: string) => void;
  onInterviewDragOver: (event: DragEvent<HTMLDivElement>, questionId: string) => void;
  onInterviewDragLeave: (questionId: string) => void;
  onInterviewDrop: (event: DragEvent<HTMLDivElement>, questionId: string) => void;
  onInterviewDragEnd: () => void;
  onInterviewTailDragOver: (event: DragEvent<HTMLDivElement>, groupId: number) => void;
  onInterviewTailDragLeave: (groupId: number) => void;
  onInterviewTailDrop: (event: DragEvent<HTMLDivElement>, groupId: number) => void;
  openQuestionModal: (
    action: string,
    groupId: number,
    questionToEdit?: { id: string | number; question: string }
  ) => void;

  // Pipeline navigation
  goToPreviousStep: () => void;
  goToNextStep: () => void;

  // Review step
  reviewSections: Array<{
    key: ReviewSectionKey;
    title: string;
    subtitle: string;
    meta: string;
    render: () => React.ReactNode;
  }>;
  expandedReviewSections: Record<ReviewSectionKey, boolean>;
  onToggleReviewSection: (section: ReviewSectionKey) => void;
  onEditReviewSection: (
    sectionKey: ReviewSectionKey,
    event: React.MouseEvent<HTMLButtonElement>
  ) => void;
}

const SegmentedCareerStepperContent = ({
  activeStep,
  draft,
  updateDraft,
  teamMembers,
  showCareerDetailsErrors,
  user,
  orgID,
  career,
  selectedCurrency,
  currencySymbol,
  RichTextEditorComponent,
  showCvScreeningValidation,
  isCvStepComplete,
  isDescriptionPresent,
  cvSecretPromptIds,
  aiSecretPromptIds,
  preScreeningQuestions,
  openPreScreenTypeFor,
  setOpenPreScreenTypeFor,
  activeDragQuestionId,
  setActiveDragQuestionId,
  draggingQuestionId,
  dragOverQuestionId,
  setDragOverQuestionId,
  isDragOverTail,
  setIsDragOverTail,
  onAddPreScreenQuestion,
  onAddCustomPreScreenQuestion,
  onUpdatePreScreenQuestion,
  onUpdatePreScreenRange,
  onAddPreScreenOption,
  onUpdatePreScreenOption,
  onRemovePreScreenOption,
  onRemovePreScreenQuestion,
  onReorderPreScreenQuestions,
  onPreScreenDragStart,
  onPreScreenDragOver,
  onPreScreenDrop,
  onPreScreenDragLeave,
  onPreScreenDragEnd,
  totalInterviewQuestionCount,
  showAiQuestionValidation,
  questions,
  isInterviewQuestion,
  draggingInterviewQuestionId,
  dragOverInterviewQuestionId,
  activeDragInterviewGroupId,
  interviewTailHoverGroupId,
  pendingQuestionGeneration,
  isGeneratingQuestions,
  onGenerateAllInterviewQuestions,
  onGenerateQuestionsForCategory,
  onInterviewDragStart,
  onInterviewDragEnter,
  onInterviewDragOver,
  onInterviewDragLeave,
  onInterviewDrop,
  onInterviewDragEnd,
  onInterviewTailDragOver,
  onInterviewTailDragLeave,
  onInterviewTailDrop,
  openQuestionModal,
  goToPreviousStep,
  goToNextStep,
  reviewSections,
  expandedReviewSections,
  onToggleReviewSection,
  onEditReviewSection,
}: SegmentedCareerStepperContentProps) => {
  if (activeStep === "career-details") {
    return (
      <CareerDetailsTeamAccessStep
        draft={draft}
        updateDraft={updateDraft}
        teamMembers={teamMembers}
        showErrors={showCareerDetailsErrors}
        user={user}
        orgID={orgID ?? undefined}
        career={career}
        selectedCurrency={selectedCurrency}
        currencySymbol={currencySymbol}
        RichTextEditorComponent={RichTextEditorComponent}
      />
    );
  }

  if (activeStep === "cv-screening") {
    return (
      <CvReviewPreScreeningStep
        draft={draft}
        updateDraft={updateDraft}
        showValidation={showCvScreeningValidation}
        isStepComplete={isCvStepComplete}
        isDescriptionPresent={isDescriptionPresent}
        secretPromptIds={cvSecretPromptIds}
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
        onAddPreScreenQuestion={onAddPreScreenQuestion}
        onAddCustomPreScreenQuestion={onAddCustomPreScreenQuestion}
        onUpdatePreScreenQuestion={onUpdatePreScreenQuestion}
        onUpdatePreScreenRange={onUpdatePreScreenRange}
        onAddPreScreenOption={onAddPreScreenOption}
        onUpdatePreScreenOption={onUpdatePreScreenOption}
        onRemovePreScreenOption={onRemovePreScreenOption}
        onRemovePreScreenQuestion={onRemovePreScreenQuestion}
        onReorderPreScreenQuestions={onReorderPreScreenQuestions}
        onPreScreenDragStart={onPreScreenDragStart}
        onPreScreenDragOver={onPreScreenDragOver}
        onPreScreenDrop={onPreScreenDrop}
        onPreScreenDragLeave={onPreScreenDragLeave}
        onPreScreenDragEnd={onPreScreenDragEnd}
      />
    );
  }

  if (activeStep === "ai-setup") {
    return (
      <AiInterviewSetupStep
        draft={draft}
        updateDraft={updateDraft}
        secretPromptIds={aiSecretPromptIds}
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
        onGenerateAll={onGenerateAllInterviewQuestions}
        onGenerateForCategory={onGenerateQuestionsForCategory}
        onDragStart={onInterviewDragStart}
        onDragEnter={onInterviewDragEnter}
        onDragOver={onInterviewDragOver}
        onDragLeave={onInterviewDragLeave}
        onDrop={onInterviewDrop}
        onDragEnd={onInterviewDragEnd}
        onTailDragOver={onInterviewTailDragOver}
        onTailDragLeave={onInterviewTailDragLeave}
        onTailDrop={onInterviewTailDrop}
        openQuestionModal={openQuestionModal}
      />
    );
  }

  if (activeStep === "pipeline") {
    return <PipelineStagesStep onBack={goToPreviousStep} onNext={goToNextStep} />;
  }

  if (activeStep === "review") {
    return (
      <ReviewCareerStep
        sections={reviewSections}
        expandedSections={expandedReviewSections}
        onToggleSection={onToggleReviewSection}
        onEditSection={onEditReviewSection}
      />
    );
  }

  return null;
};

export default SegmentedCareerStepperContent;

