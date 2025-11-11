"use client";

import classNames from "classnames";

import type {
  CareerFormDraft,
  CareerTeamMember,
} from "@/lib/hooks/useSegmentedCareerFormState";
import styles from "@/lib/styles/segmentedCareerForm.module.scss";

interface ReviewCareerSectionProps {
  draft: CareerFormDraft;
  teamMembers: CareerTeamMember[];
  minimumSalaryDisplay: string;
  maximumSalaryDisplay: string;
  jobDescriptionMarkup: { __html: string } | null;
}

const ReviewCareerSection = ({
  draft,
  teamMembers,
  minimumSalaryDisplay,
  maximumSalaryDisplay,
  jobDescriptionMarkup,
}: ReviewCareerSectionProps) => {
  return (
    <div className={classNames(styles.reviewAccordionBody, styles.reviewCareerBody)}>
      <div className={styles.reviewCareerCard}>
        <div className={styles.reviewCareerSection}>
          <h5 className={styles.reviewCareerFieldLabel}>Job Title</h5>
          <p className={styles.reviewCareerFieldValue}>{draft.jobTitle || "Not specified"}</p>
        </div>

        <div className={styles.reviewCareerFieldsGrid}>
          <div className={styles.reviewCareerSection}>
            <h5 className={styles.reviewCareerFieldLabel}>Employment Type</h5>
            <p className={styles.reviewCareerFieldValue}>{draft.employmentType || "Not specified"}</p>
          </div>
          <div className={styles.reviewCareerSection}>
            <h5 className={styles.reviewCareerFieldLabel}>Work Arrangement</h5>
            <p className={styles.reviewCareerFieldValue}>{draft.workSetup || "Not specified"}</p>
          </div>
        </div>

        <div className={styles.reviewCareerFieldsGrid3}>
          <div className={styles.reviewCareerSection}>
            <h5 className={styles.reviewCareerFieldLabel}>Country</h5>
            <p className={styles.reviewCareerFieldValue}>{draft.location.country || "Not specified"}</p>
          </div>
          <div className={styles.reviewCareerSection}>
            <h5 className={styles.reviewCareerFieldLabel}>State / Province</h5>
            <p className={styles.reviewCareerFieldValue}>{draft.location.province || "Not specified"}</p>
          </div>
          <div className={styles.reviewCareerSection}>
            <h5 className={styles.reviewCareerFieldLabel}>City</h5>
            <p className={styles.reviewCareerFieldValue}>{draft.location.city || "Not specified"}</p>
          </div>
        </div>

        <div className={styles.reviewCareerFieldsGrid}>
          <div className={styles.reviewCareerSection}>
            <h5 className={styles.reviewCareerFieldLabel}>Minimum Salary</h5>
            <p className={styles.reviewCareerFieldValue}>{minimumSalaryDisplay}</p>
          </div>
          <div className={styles.reviewCareerSection}>
            <h5 className={styles.reviewCareerFieldLabel}>Maximum Salary</h5>
            <p className={styles.reviewCareerFieldValue}>{maximumSalaryDisplay}</p>
          </div>
        </div>

        <div className={styles.reviewCareerDivider} aria-hidden="true"></div>
        <div className={styles.reviewCareerSection}>
          <h5 className={styles.reviewCareerFieldLabel}>Job Description</h5>
          {jobDescriptionMarkup ? (
            <div
              className={classNames(styles.reviewRichText, styles.reviewRichTextFramed)}
              dangerouslySetInnerHTML={jobDescriptionMarkup}
            ></div>
          ) : (
            <p className={styles.reviewEmptyState}>No description provided.</p>
          )}
        </div>
        <div className={styles.reviewCareerDivider} aria-hidden="true"></div>
        <div className={styles.reviewCareerSection}>
          <h5 className={styles.reviewCareerFieldLabel}>Team Access</h5>
          {teamMembers.length ? (
            <div className={styles.reviewTeamTable}>
              {teamMembers.map((member) => {
                const displayName = member.name || member.email || "Member";
                const displayEmail = member.email || "—";
                return (
                  <div key={member.memberId} className={styles.reviewTeamRow}>
                    <div className={styles.reviewTeamIdentity}>
                      {member.image ? (
                        <img
                          src={member.image}
                          alt={displayName}
                          className={styles.reviewTeamAvatarImage}
                        />
                      ) : (
                        <span className={styles.reviewTeamAvatarFallback} aria-hidden="true">
                          {(displayName || "?").charAt(0)}
                        </span>
                      )}
                      <div className={styles.reviewTeamPrimary}>
                        <span className={styles.reviewTeamName}>{displayName}</span>
                        <span className={styles.reviewTeamEmail}>{displayEmail}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className={styles.reviewEmptyState}>No team members assigned.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReviewCareerSection;

