"use client";

import { useState, type ReactNode } from "react";
import classNames from "classnames";

import styles from "@/lib/styles/segmentedCareerForm.module.scss";

export interface SecretPromptFieldProps {
  inputId: string;
  descriptionId: string;
  label: string;
  helper: string;
  placeholder: string;
  value: string;
  onChange: (nextValue: string) => void;
  withDivider?: boolean;
  iconSrc?: string;
  iconAlt?: string;
  tooltipContent?: ReactNode;
  tooltipAriaLabel?: string;
}

const SecretPromptField = ({
  inputId,
  descriptionId,
  label,
  helper,
  placeholder,
  value,
  onChange,
  withDivider = false,
  iconSrc,
  iconAlt,
  tooltipContent,
  tooltipAriaLabel,
}: SecretPromptFieldProps) => {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const tooltipId = `${inputId}-tooltip`;

  const showTooltip = () => setIsTooltipVisible(true);
  const hideTooltip = () => setIsTooltipVisible(false);

  return (
    <>
      {withDivider && <div className={styles.aiSettingDivider} aria-hidden="true"></div>}
      <section className={classNames(styles.aiSettingSection, styles.secretPromptSection)}>
        <div className={styles.secretPromptHeading}>
          <span
            className={classNames(
              styles.secretPromptGlyph,
              iconSrc && styles.secretPromptGlyphImage
            )}
            aria-hidden="true"
          >
            {iconSrc ? (
              <img src={iconSrc} alt={iconAlt || ""} className={styles.secretPromptGlyphImg} />
            ) : (
              <i className="la la-sparkles"></i>
            )}
          </span>
          <div className={styles.secretPromptTitleGroup}>
            <div className={styles.secretPromptTitleRow}>
              <h3>{label}</h3>
              <span className={styles.optionalTag}>(optional)</span>
              {tooltipContent && (
                <span
                  className={styles.secretPromptTooltipWrapper}
                  onMouseEnter={showTooltip}
                  onMouseLeave={hideTooltip}
                >
                  <button
                    type="button"
                    className={styles.secretPromptInfoButton}
                    aria-label={tooltipAriaLabel || "Learn more"}
                    aria-describedby={tooltipId}
                    onFocus={showTooltip}
                    onBlur={hideTooltip}
                  >
                    <i className="la la-question-circle" aria-hidden="true"></i>
                  </button>
                  <span
                    id={tooltipId}
                    role="tooltip"
                    className={classNames(
                      styles.secretPromptTooltip,
                      isTooltipVisible && styles.secretPromptTooltipVisible
                    )}
                    aria-hidden={!isTooltipVisible}
                  >
                    {tooltipContent}
                  </span>
                </span>
              )}
            </div>
            <p id={descriptionId}>{helper}</p>
          </div>
        </div>
        <textarea
          className={styles.secretPromptInput}
          id={inputId}
          aria-describedby={descriptionId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={5}
        ></textarea>
      </section>
    </>
  );
};

export default SecretPromptField;
