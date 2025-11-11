"use client";

import { CSSProperties } from "react";
import classNames from "classnames";

import { segmentedSteps, type SegmentedCareerStep } from "@/lib/hooks/useSegmentedCareerFormState";
import styles from "@/lib/styles/segmentedCareerForm.module.scss";

interface FormStepperProps {
  activeStep: SegmentedCareerStep;
  currentStepIndex: number;
  showCareerDetailsErrors: boolean;
  showCvScreeningValidation: boolean;
  showAiQuestionValidation: boolean;
  totalInterviewQuestionCount: number;
  progressRatio: number;
  isStepComplete: (step: SegmentedCareerStep) => boolean;
  canNavigateToStep: (step: SegmentedCareerStep, index: number) => boolean;
  onStepClick: (step: SegmentedCareerStep) => void;
}

const FormStepper = ({
  activeStep,
  currentStepIndex,
  showCareerDetailsErrors,
  showCvScreeningValidation,
  showAiQuestionValidation,
  totalInterviewQuestionCount,
  progressRatio,
  isStepComplete,
  canNavigateToStep,
  onStepClick,
}: FormStepperProps) => {
  return (
    <div
      className={styles.stepper}
      style={
        {
          "--progress-percentage": `${progressRatio}`,
        } as CSSProperties
      }
    >
      {segmentedSteps.map((step, index) => {
        const isActive = step.id === activeStep;
        const isCompleted = index < currentStepIndex && isStepComplete(step.id);
        const canNavigate = canNavigateToStep(step.id, index);
        const stepHasErrors =
          (step.id === "career-details" && showCareerDetailsErrors && !isStepComplete("career-details")) ||
          (step.id === "cv-screening" && showCvScreeningValidation && !isStepComplete("cv-screening")) ||
          (step.id === "ai-setup" && showAiQuestionValidation && totalInterviewQuestionCount < 5);
        const isReviewStep = step.id === "review";

        let stepProgressWidth = 0;
        if (isCompleted) {
          stepProgressWidth = 100;
        } else if (isActive) {
          stepProgressWidth = isStepComplete(step.id) ? 50 : 0;
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
            onClick={() => canNavigate && onStepClick(step.id)}
            disabled={!canNavigate}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%" }}>
              <span
                className={classNames(stepHasErrors ? styles.stepErrorIndicator : styles.stepIndicator)}
              >
                {stepHasErrors ? (
                  <i className="la la-exclamation-triangle" aria-hidden="true"></i>
                ) : isCompleted ? (
                  <i className="la la-check" aria-hidden="true"></i>
                ) : (
                  <span className={styles.stepDot} aria-hidden="true" />
                )}
              </span>
              {!isReviewStep && (
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
  );
};

export default FormStepper;

