"use client";

import styles from "@/lib/styles/segmentedCareerForm.module.scss";

interface FormHeaderProps {
  formType: "add" | "edit";
  isOnReviewStep: boolean;
  isSavingCareer: boolean;
  onSaveUnpublished: () => void;
  onSaveAndContinue: () => void;
}

const FormHeader = ({
  formType,
  isOnReviewStep,
  isSavingCareer,
  onSaveUnpublished,
  onSaveAndContinue,
}: FormHeaderProps) => {
  return (
    <div className={styles.headerRow}>
      <div className={styles.titleGroup}>
        <h1>{formType === "add" ? "Add new career" : "Edit career"}</h1>
      </div>
      <div className={styles.actions}>
        <button
          className={styles.ghostButton}
          type="button"
          disabled={isSavingCareer}
          onClick={onSaveUnpublished}
        >
          Save as Unpublished
        </button>
        <button
          className={styles.primaryButton}
          type="button"
          disabled={isSavingCareer}
          onClick={onSaveAndContinue}
        >
          {isOnReviewStep ? "Publish" : "Save and Continue"}
          {!isOnReviewStep && <i className="la la-arrow-right"></i>}
        </button>
      </div>
    </div>
  );
};

export default FormHeader;

