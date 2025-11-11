"use client";

import { ReactNode } from "react";

import classNames from "classnames";

import { PreScreenQuestionType } from "../constants";
import styles from "@/lib/styles/segmentedCareerForm.module.scss";

interface ReviewCvSectionProps {
  cvSecretPrompt?: string;
  screeningDescription: ReactNode;
  preScreeningQuestions: any[];
}

const ReviewCvSection = ({
  cvSecretPrompt,
  screeningDescription,
  preScreeningQuestions,
}: ReviewCvSectionProps) => {
  const secretPromptLines =
    typeof cvSecretPrompt === "string"
      ? cvSecretPrompt
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
      : [];
  const totalPreScreenQuestions = preScreeningQuestions.length;

  return (
    <div className={classNames(styles.reviewAccordionBody, styles.reviewCvBody)}>
      <div className={styles.reviewCvCard}>
        <div className={styles.reviewCvHeader}>
          <div className={styles.reviewCvHeaderText}>
            <p className={styles.reviewCvTitle}>CV Screening</p>
            <p className={styles.reviewCvDescription}>{screeningDescription}</p>
          </div>
        </div>

        <div className={styles.reviewCvDivider} aria-hidden="true"></div>

        <section className={styles.reviewCvSection}>
          <header className={styles.reviewCvSectionHeader}>
            <div className={styles.reviewCvSectionTitleGroup}>
              <img
                alt="CV Secret Prompt"
                className={styles.secretPromptGlyphImg}
                src="/assets/icons/ai-sparkles.svg"
              />
              <span className={styles.reviewCvSectionTitle}>CV Secret Prompt</span>
            </div>
          </header>
          {secretPromptLines.length ? (
            <ul className={styles.reviewCvPromptList}>
              {secretPromptLines.map((line, index) => (
                <li key={`secret-prompt-${index}`}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className={styles.reviewCvEmpty}>No secret prompt provided.</p>
          )}
        </section>

        <div className={styles.reviewCvDivider} aria-hidden="true"></div>

        <section className={styles.reviewCvSection}>
          <header className={styles.reviewCvSectionHeader}>
            <div className={styles.reviewCvSectionTitleGroup}>
              <span className={styles.reviewCvSectionTitle}>Pre-Screening Questions</span>
            </div>
            <span className={styles.reviewCvCountBadge}>{totalPreScreenQuestions}</span>
          </header>
          {totalPreScreenQuestions ? (
            <ol className={styles.reviewCvQuestionList}>
              {preScreeningQuestions.map((question: any, index: number) => {
                const questionText =
                  typeof question?.question === "string" && question.question.trim().length
                    ? question.question.trim()
                    : `Question ${index + 1}`;
                const answerType =
                  typeof question?.answerType === "string"
                    ? (question.answerType as PreScreenQuestionType)
                    : "short_text";
                const optionLabels = Array.isArray(question?.options)
                  ? question.options
                      .map((option: any) => option?.label)
                      .filter((label: any) => typeof label === "string" && label.trim().length)
                  : [];
                const hasRangeValues = answerType === "range";

                return (
                  <li key={question?.id ?? `pre-screen-${index}`} className={styles.reviewCvQuestion}>
                    <div className={styles.reviewCvQuestionText}>{questionText}</div>
                    {optionLabels.length > 0 && (
                      <ul className={styles.reviewCvOptionList}>
                        {optionLabels.map((label: string, optionIndex: number) => (
                          <li key={`${question?.id ?? index}-option-${optionIndex}`}>{label}</li>
                        ))}
                      </ul>
                    )}
                    {hasRangeValues && (
                      <div className={styles.reviewCvQuestionMeta}>
                        Preferred range: {question?.rangeMin || "—"} – {question?.rangeMax || "—"}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className={styles.reviewCvEmpty}>No pre-screening questions configured.</p>
          )}
        </section>
      </div>
    </div>
  );
};

export default ReviewCvSection;

