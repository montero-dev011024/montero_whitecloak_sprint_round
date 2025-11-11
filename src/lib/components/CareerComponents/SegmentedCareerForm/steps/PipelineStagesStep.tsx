"use client";

import styles from "@/lib/styles/segmentedCareerForm.module.scss";

interface PipelineStagesStepProps {
  onBack: () => void;
  onNext: () => void;
}

const PipelineStagesStep = ({ onBack, onNext }: PipelineStagesStepProps) => {
  return (
    <div className={styles.card}>
      <header className={styles.cardHeader}>
        <span className={styles.icon}>
          <i className="la la-project-diagram"></i>
        </span>
        <div className={styles.titleGroup}>
          <strong>Pipeline stages</strong>
          <span>Map the journey from application to hire</span>
        </div>
      </header>
      <div className={styles.cardInner}>
        <div className={styles.pipelineCard}>
          <span className={styles.pipelineIcon}>
            <i className="la la-tools"></i>
          </span>
          <h3>Pipeline builder coming soon</h3>
          <p>
            We are preparing a dedicated pipeline builder for recruiters. Save this career now
            and you can define stages once the feature is released.
          </p>
        </div>
        <footer className={styles.stepFooter}>
          <button className={styles.backButton} onClick={onBack}>
            <i className="la la-arrow-left"></i>
            Back to AI setup
          </button>
          <button className={styles.nextButton} onClick={onNext}>
            Continue to review
            <i className="la la-arrow-right"></i>
          </button>
        </footer>
      </div>
    </div>
  );
};

export default PipelineStagesStep;
