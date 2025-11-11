"use client";

import { ReactNode, MouseEvent as ReactMouseEvent } from "react";
import classNames from "classnames";

import styles from "@/lib/styles/segmentedCareerForm.module.scss";
import { ReviewSectionKey } from "../segmentTypes";

interface ReviewSection {
  key: ReviewSectionKey;
  title: string;
  subtitle: string;
  meta: string;
  render: () => ReactNode;
}

interface ReviewCareerStepProps {
  sections: ReviewSection[];
  expandedSections: Record<ReviewSectionKey, boolean>;
  onToggleSection: (section: ReviewSectionKey) => void;
  onEditSection: (section: ReviewSectionKey, event: ReactMouseEvent<HTMLButtonElement>) => void;
}

const ReviewCareerStep = ({
  sections,
  expandedSections,
  onToggleSection,
  onEditSection,
}: ReviewCareerStepProps) => {
  return (
    <div className={styles.reviewStandaloneContainer}>
      <div className={styles.reviewAccordion}>
        {sections.map((section) => {
          const isOpen = expandedSections[section.key];

          return (
            <div
              key={section.key}
              className={classNames(styles.reviewAccordionItem, {
                [styles.reviewAccordionItemOpen]: isOpen,
              })}
            >
              <div
                className={classNames(styles.reviewAccordionHeader, {
                  [styles.reviewAccordionHeaderOpen]: isOpen,
                })}
              >
                <button
                  type="button"
                  className={styles.reviewAccordionToggle}
                  onClick={() => onToggleSection(section.key)}
                  aria-expanded={isOpen}
                >
                  <span
                    className={classNames(
                      styles.reviewAccordionIcon,
                      styles.reviewAccordionChevron
                    )}
                    aria-hidden="true"
                  >
                    <i className={classNames("la", isOpen ? "la-angle-up" : "la-angle-down")}></i>
                  </span>
                  <div className={styles.reviewAccordionHeaderLeft}>
                    <span className={styles.reviewAccordionTitle}>{section.title}</span>
                    <span className={styles.reviewAccordionSubtitle}>{section.subtitle}</span>
                  </div>
                </button>
                <div className={styles.reviewAccordionHeaderRight}>
                  <button
                    type="button"
                    className={styles.reviewAccordionEditButton}
                    onClick={(event) => onEditSection(section.key, event)}
                    aria-label={`Edit ${section.title}`}
                  >
                    <i className="la la-pen" aria-hidden="true"></i>
                  </button>
                </div>
              </div>
              {isOpen && section.render()}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ReviewCareerStep;
