"use client";

import { useCallback, useMemo } from "react";

import {
  SegmentedCareerStep,
  segmentedSteps,
} from "@/lib/hooks/useSegmentedCareerFormState";

interface UseStepperNavigationArgs {
  activeStep: SegmentedCareerStep;
  setActiveStep: (step: SegmentedCareerStep) => void;
  isStepComplete: (stepId: SegmentedCareerStep) => boolean;
  onCareerDetailsIncomplete: () => void;
  onCvScreeningIncomplete: () => void;
  onAiSetupIncomplete: () => void;
  persistDraft: (
    draftOverrides?: Record<string, unknown>,
    options?: { orgID?: string | null; userEmail?: string | null }
  ) => void;
  orgID?: string | null;
  userEmail?: string | null;
}

interface UseStepperNavigationResult {
  currentStepIndex: number;
  progressRatio: number;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  canNavigateToStep: (targetStep: SegmentedCareerStep, index: number) => boolean;
}

const useStepperNavigation = ({
  activeStep,
  setActiveStep,
  isStepComplete,
  onCareerDetailsIncomplete,
  onCvScreeningIncomplete,
  onAiSetupIncomplete,
  persistDraft,
  orgID,
  userEmail,
}: UseStepperNavigationArgs): UseStepperNavigationResult => {
  const currentStepIndex = useMemo(
    () => segmentedSteps.findIndex((step) => step.id === activeStep),
    [activeStep]
  );

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

  const goToNextStep = useCallback(() => {
    if (currentStepIndex === -1 || currentStepIndex === segmentedSteps.length - 1) {
      return;
    }

    if (!isStepComplete(activeStep)) {
      if (activeStep === "career-details") {
        onCareerDetailsIncomplete();
        return;
      }

      if (activeStep === "cv-screening") {
        onCvScreeningIncomplete();
        return;
      }

      if (activeStep === "ai-setup") {
        onAiSetupIncomplete();
        return;
      }

      return;
    }

    const nextStep = segmentedSteps[currentStepIndex + 1];
    setActiveStep(nextStep.id);
    persistDraft?.({}, { orgID: orgID ?? null, userEmail: userEmail ?? null });
  }, [
    activeStep,
    currentStepIndex,
    isStepComplete,
    onCareerDetailsIncomplete,
    onCvScreeningIncomplete,
    onAiSetupIncomplete,
    persistDraft,
    setActiveStep,
    orgID,
    userEmail,
  ]);

  const goToPreviousStep = useCallback(() => {
    if (currentStepIndex <= 0) {
      return;
    }
    const prevStep = segmentedSteps[currentStepIndex - 1];
    setActiveStep(prevStep.id);
  }, [currentStepIndex, setActiveStep]);

  const canNavigateToStep = useCallback(
    (targetStep: SegmentedCareerStep, index: number) => {
      if (index <= currentStepIndex) {
        return true;
      }

      const requiredSteps = segmentedSteps.slice(0, index);
      return requiredSteps.every((step) => isStepComplete(step.id));
    },
    [currentStepIndex, isStepComplete]
  );

  return {
    currentStepIndex,
    progressRatio,
    goToNextStep,
    goToPreviousStep,
    canNavigateToStep,
  };
};

export default useStepperNavigation;

