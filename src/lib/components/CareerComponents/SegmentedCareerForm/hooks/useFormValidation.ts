"use client";

import { useCallback, useMemo } from "react";

import type {
  CareerFormDraft,
  CareerTeamMember,
  SegmentedCareerStep,
} from "@/lib/hooks/useSegmentedCareerFormState";

interface UseFormValidationParams {
  draft: CareerFormDraft;
  teamMembers: CareerTeamMember[];
  totalInterviewQuestionCount: number;
  isDescriptionPresent: (value?: string) => boolean;
}

const useFormValidation = ({
  draft,
  teamMembers,
  totalInterviewQuestionCount,
  isDescriptionPresent,
}: UseFormValidationParams) => {
  const isStepComplete = useCallback(
    (step: SegmentedCareerStep) => {
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
    },
    [draft, teamMembers, totalInterviewQuestionCount, isDescriptionPresent]
  );

  const isFormValid = useMemo(
    () =>
      isStepComplete("career-details") &&
      isStepComplete("cv-screening") &&
      totalInterviewQuestionCount >= 5,
    [isStepComplete, totalInterviewQuestionCount]
  );

  return {
    isStepComplete,
    isFormValid,
  };
};

export default useFormValidation;

