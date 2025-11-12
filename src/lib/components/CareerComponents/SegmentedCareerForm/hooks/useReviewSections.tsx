"use client";

import { useCallback, useMemo } from "react";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";

import type { SegmentedCareerStep } from "@/lib/hooks/useSegmentedCareerFormState";
import styles from "@/lib/styles/segmentedCareerForm.module.scss";

import ReviewAiSection from "../components/ReviewAiSection";
import ReviewCareerSection from "../components/ReviewCareerSection";
import ReviewCvSection from "../components/ReviewCvSection";
import type { ReviewSectionKey } from "../segmentTypes";

interface UseReviewSectionsArgs {
  draft: any;
  teamMembers: any[];
  minimumSalaryDisplay: string | null;
  maximumSalaryDisplay: string | null;
  jobDescriptionMarkup: { __html: string } | null;
  preScreeningQuestions: any[];
  requireVideoSetting: boolean;
  totalInterviewQuestionCount: number;
  interviewQuestionGroups: Array<{
    id: number;
    category: string;
    interviewQuestions: any[];
  }>;
  setActiveStep: (step: SegmentedCareerStep) => void;
  resetCareerDetailsErrors: () => void;
  resetCvScreeningValidation: () => void;
  resetAiQuestionValidation: () => void;
}

interface ReviewSectionConfig {
  key: ReviewSectionKey;
  title: string;
  subtitle: string;
  meta: string;
  render: () => ReactNode;
}

interface UseReviewSectionsResult {
  reviewSections: ReviewSectionConfig[];
  screeningDescription: ReactNode;
  formatCountLabel: (count: number, singular: string, plural?: string) => string;
  handleReviewSectionEdit: (
    sectionKey: ReviewSectionKey,
    event: ReactMouseEvent<HTMLButtonElement>
  ) => void;
}

const reviewSectionTargetStep: Record<ReviewSectionKey, SegmentedCareerStep> = {
  career: "career-details",
  cv: "cv-screening",
  ai: "ai-setup",
};

const useReviewSections = ({
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
  resetCareerDetailsErrors,
  resetCvScreeningValidation,
  resetAiQuestionValidation,
}: UseReviewSectionsArgs): UseReviewSectionsResult => {
  const formatCountLabel = useCallback(
    (count: number, singular: string, plural?: string) => {
      const pluralLabel = plural ?? `${singular}s`;
      if (count === 0) {
        return `No ${pluralLabel.toLowerCase()}`;
      }
      if (count === 1) {
        return `1 ${singular.toLowerCase()}`;
      }
      return `${count} ${pluralLabel.toLowerCase()}`;
    },
    []
  );

  const screeningDescription = useMemo(() => {
    switch (draft?.screeningSetting) {
      case "Good Fit and above":
        return (
          <>
            Automatically endorse candidates who are{" "}
            <span className={styles.reviewCvBadge}>Good Fit</span> and above
          </>
        );
      case "Only Strong Fit":
        return (
          <>
            Automatically endorse candidates who are{" "}
            <span className={styles.reviewCvBadge}>Strong Fit</span> only
          </>
        );
      case "No Automatic Promotion":
      default:
        return "Automatic endorsements are turned off.";
    }
  }, [draft?.screeningSetting]);

  const reviewSections = useMemo<ReviewSectionConfig[]>(
    () => [
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
        meta: formatCountLabel(preScreeningQuestions.length, "question"),
        render: () => (
          <ReviewCvSection
            cvSecretPrompt={draft?.cvSecretPrompt}
            screeningDescription={screeningDescription}
            preScreeningQuestions={preScreeningQuestions}
          />
        ),
      },
      {
        key: "ai",
        title: "AI Interview Setup",
        subtitle: "Step 3",
        meta: formatCountLabel(totalInterviewQuestionCount, "question"),
        render: () => (
          <ReviewAiSection
            aiSecretPrompt={draft?.aiInterviewSecretPrompt}
            screeningDescription={screeningDescription}
            requireVideoSetting={requireVideoSetting}
            totalInterviewQuestionCount={totalInterviewQuestionCount}
            interviewQuestionGroups={interviewQuestionGroups}
          />
        ),
      },
    ],
    [
      draft,
      formatCountLabel,
      interviewQuestionGroups,
      jobDescriptionMarkup,
      maximumSalaryDisplay,
      minimumSalaryDisplay,
      preScreeningQuestions,
      requireVideoSetting,
      screeningDescription,
      teamMembers,
      totalInterviewQuestionCount,
    ]
  );

  const handleReviewSectionEdit = useCallback(
    (sectionKey: ReviewSectionKey, event: ReactMouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const targetStep = reviewSectionTargetStep[sectionKey];
      if (!targetStep) {
        return;
      }

      setActiveStep(targetStep);

      if (sectionKey === "career") {
        resetCareerDetailsErrors();
      }

      if (sectionKey === "cv") {
        resetCvScreeningValidation();
      }

      if (sectionKey === "ai") {
        resetAiQuestionValidation();
      }
    },
    [
      resetAiQuestionValidation,
      resetCareerDetailsErrors,
      resetCvScreeningValidation,
      setActiveStep,
    ]
  );

  return {
    reviewSections,
    screeningDescription,
    formatCountLabel,
    handleReviewSectionEdit,
  };
};

export default useReviewSections;

