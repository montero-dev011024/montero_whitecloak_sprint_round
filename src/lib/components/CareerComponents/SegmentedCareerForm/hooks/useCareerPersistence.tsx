"use client";

import { useCallback, useRef, useState } from "react";
import axios from "axios";

import {
  candidateActionToast,
  errorToast,
} from "@/lib/Utils";
import type { SegmentedCareerStep } from "@/lib/hooks/useSegmentedCareerFormState";
import { segmentedSteps } from "@/lib/hooks/useSegmentedCareerFormState";

interface UseCareerPersistenceArgs {
  draft: any;
  career: any;
  questions: any[];
  teamMembers: any[];
  requireVideoSetting: boolean;
  selectedCurrency: string;
  user: {
    image?: string;
    name?: string;
    email?: string;
  } | null;
  orgID?: string | null;
  formType: "add" | "edit";
  persistDraft: (
    draftOverrides?: Record<string, unknown>,
    options?: { orgID?: string | null; userEmail?: string | null }
  ) => void;
  resetDraft: () => void;
  isStepComplete: (stepId: SegmentedCareerStep) => boolean;
  isOnReviewStep: boolean;
  currentStepIndex: number;
  setActiveStep: (step: SegmentedCareerStep) => void;
  goToNextStep: () => void;
  setShowCareerDetailsErrors: (value: boolean) => void;
  setShowAiQuestionValidation: (value: boolean) => void;
}

interface UseCareerPersistenceResult {
  isSavingCareer: boolean;
  showSaveModal: string;
  setShowSaveModal: (value: string) => void;
  confirmSaveCareer: (status: string) => void;
  saveCareer: (status: string) => Promise<void>;
  formatCareerPayload: (status: string) => any;
}

const useCareerPersistence = ({
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
}: UseCareerPersistenceArgs): UseCareerPersistenceResult => {
  const [showSaveModal, setShowSaveModal] = useState<string>("");
  const [isSavingCareer, setIsSavingCareer] = useState(false);
  const savingCareerRef = useRef(false);

  const userEmail = user?.email ?? null;

  const formatCareerPayload = useCallback(
    (status: string) => {
      const minimumSalary = draft?.salary?.minimum ? Number(draft.salary.minimum) : null;
      const maximumSalary = draft?.salary?.maximum ? Number(draft.salary.maximum) : null;

      return {
        ...(career?._id ? { _id: career._id } : {}),
        jobTitle: draft?.jobTitle,
        description: draft?.description,
        workSetup: draft?.workSetup,
        workSetupRemarks: draft?.workSetupRemarks,
        cvSecretPrompt: draft?.cvSecretPrompt,
        aiInterviewSecretPrompt: draft?.aiInterviewSecretPrompt,
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
        screeningSetting: draft?.screeningSetting,
        requireVideo: requireVideoSetting,
        orgID,
        salaryNegotiable: draft?.salary?.isNegotiable,
        minimumSalary,
        maximumSalary,
        salaryCurrency: selectedCurrency,
        country: draft?.location?.country,
        province: draft?.location?.province,
        location: draft?.location?.city,
        status,
        employmentType: draft?.employmentType,
        teamMembers,
        team: {
          members: teamMembers,
        },
      };
    },
    [
      career?._id,
      career?.createdBy,
      career?.lastEditedBy,
      draft,
      orgID,
      questions,
      requireVideoSetting,
      selectedCurrency,
      teamMembers,
      user?.email,
      user?.image,
      user?.name,
    ]
  );

  const confirmSaveCareer = useCallback(
    (status: string) => {
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

        goToNextStep();
        return;
      }

      setShowSaveModal(status);
    },
    [
      currentStepIndex,
      formatCareerPayload,
      goToNextStep,
      isOnReviewStep,
      isStepComplete,
      setActiveStep,
      setShowAiQuestionValidation,
      setShowCareerDetailsErrors,
    ]
  );

  const saveCareer = useCallback(
    async (status: string) => {
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
            { orgID, userEmail }
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
            { orgID, userEmail }
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
    },
    [
      formType,
      formatCareerPayload,
      orgID,
      persistDraft,
      resetDraft,
      userEmail,
    ]
  );

  return {
    isSavingCareer,
    showSaveModal,
    setShowSaveModal,
    confirmSaveCareer,
    saveCareer,
    formatCareerPayload,
  };
};

export default useCareerPersistence;

