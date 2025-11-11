"use client";

import { ReactNode } from "react";

import classNames from "classnames";

import styles from "@/lib/styles/segmentedCareerForm.module.scss";

interface ReviewAiQuestionGroup {
  id: number;
  category: string;
  interviewQuestions: any[];
}

interface ReviewAiSectionProps {
  aiSecretPrompt?: string;
  screeningDescription: ReactNode;
  requireVideoSetting: boolean;
  totalInterviewQuestionCount: number;
  interviewQuestionGroups: ReviewAiQuestionGroup[];
}

const ReviewAiSection = ({
  aiSecretPrompt,
  screeningDescription,
  requireVideoSetting,
  totalInterviewQuestionCount,
  interviewQuestionGroups,
}: ReviewAiSectionProps) => {
  const secretPromptLines =
    typeof aiSecretPrompt === "string"
      ? aiSecretPrompt
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
      : [];
  const requireVideoLabel = requireVideoSetting ? "Yes" : "No";
  const populatedInterviewGroups = interviewQuestionGroups.filter(
    (group) => group.interviewQuestions.length > 0
  );

  let runningQuestionIndex = 0;

  return (
    <div className={classNames(styles.reviewAccordionBody, styles.reviewAiBody)}>
      <div className={styles.reviewAiCard}>
        <div className={styles.reviewAiHeader}>
          <div className={styles.reviewAiHeaderText}>
            <p className={styles.reviewAiTitle}>AI Interview Screening</p>
            <p className={styles.reviewAiDescription}>{screeningDescription}</p>
          </div>
        </div>

        <div className={styles.reviewAiMetaRow}>
          <div className={styles.reviewAiMetaItem}>
            <span className={styles.reviewAiMetaLabel}>Require Video on Interview</span>
            <span className={styles.reviewAiMetaValue}>
              {requireVideoLabel}
              {requireVideoSetting && (
                <span className={styles.reviewAiMetaIcon} aria-hidden="true">
                  <i className="la la-check"></i>
                </span>
              )}
            </span>
          </div>
        </div>

        <div className={styles.reviewAiDivider} aria-hidden="true"></div>

        <section className={styles.reviewAiSection}>
          <header className={styles.reviewAiSectionHeader}>
            <div className={styles.reviewAiSectionTitleGroup}>
              <img
                alt="AI Interview Secret Prompt"
                className={styles.secretPromptGlyphImg}
                src="/assets/icons/ai-sparkles.svg"
              />
              <span className={styles.reviewAiSectionTitle}>AI Interview Secret Prompt</span>
            </div>
          </header>
          {secretPromptLines.length ? (
            <ul className={styles.reviewAiPromptList}>
              {secretPromptLines.map((line, index) => (
                <li key={`ai-secret-prompt-${index}`}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className={styles.reviewAiEmpty}>No secret prompt provided.</p>
          )}
        </section>

        <div className={styles.reviewAiDivider} aria-hidden="true"></div>

        <section className={styles.reviewAiSection}>
          <header className={styles.reviewAiSectionHeader}>
            <span className={styles.reviewAiSectionTitle}>Interview Questions</span>
            <span className={styles.reviewAiCountBadge}>{totalInterviewQuestionCount}</span>
          </header>
          {populatedInterviewGroups.length ? (
            <div className={styles.reviewAiQuestionGroups}>
              {populatedInterviewGroups.map((group) => {
                const startIndex = runningQuestionIndex + 1;
                runningQuestionIndex += group.interviewQuestions.length;

                return (
                  <div key={group.id} className={styles.reviewAiQuestionGroup}>
                    <div className={styles.reviewAiQuestionGroupHeader}>
                      <span className={styles.reviewAiQuestionCategory}>
                        {group.category || "Interview Questions"}
                      </span>
                    </div>
                    <ol className={styles.reviewAiQuestionList} start={startIndex}>
                      {group.interviewQuestions.map((question: any, index: number) => {
                        const questionText =
                          typeof question?.question === "string" && question.question.trim().length
                            ? question.question.trim()
                            : `Question ${startIndex + index}`;
                        return (
                          <li
                            key={question?.id ?? `interview-${group.id}-${index}`}
                            className={styles.reviewAiQuestion}
                          >
                            <span className={styles.reviewAiQuestionText}>{questionText}</span>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className={styles.reviewAiEmpty}>No interview questions configured.</p>
          )}
        </section>
      </div>
    </div>
  );
};

export default ReviewAiSection;

