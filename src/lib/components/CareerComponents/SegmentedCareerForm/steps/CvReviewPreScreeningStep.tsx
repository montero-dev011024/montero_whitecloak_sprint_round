"use client";

import { DragEvent } from "react";
import classNames from "classnames";

import CustomDropdown from "@/lib/components/CareerComponents/CustomDropdown";
import type { CareerFormDraft } from "@/lib/hooks/useSegmentedCareerFormState";
import {
  PreScreenQuestionType,
  PRE_SCREEN_TYPE_OPTIONS,
  SCREENING_SETTING_OPTIONS,
  SUGGESTED_PRE_SCREENING_QUESTIONS,
  getPreScreenTypeLabel,
} from "../constants";
import SecretPromptField from "../components/SecretPromptField";
import styles from "@/lib/styles/segmentedCareerForm.module.scss";
import type { SuggestedPreScreenQuestion } from "../constants";

interface CvSecretPromptIds {
  input: string;
  description: string;
}

interface CvReviewPreScreeningStepProps {
  draft: CareerFormDraft;
  updateDraft: (update: Partial<CareerFormDraft>) => void;
  showValidation: boolean;
  isStepComplete: boolean;
  isDescriptionPresent: (value?: string) => boolean;
  secretPromptIds: CvSecretPromptIds;
  preScreeningQuestions: any[];
  openPreScreenTypeFor: string | null;
  setOpenPreScreenTypeFor: (value: string | null) => void;
  activeDragQuestionId: string | null;
  setActiveDragQuestionId: (value: string | null) => void;
  draggingQuestionId: string | null;
  dragOverQuestionId: string | null;
  setDragOverQuestionId: (value: string | null) => void;
  isDragOverTail: boolean;
  setIsDragOverTail: (value: boolean) => void;
  onAddPreScreenQuestion: (
    questionText: string,
    template?: {
      answerType?: PreScreenQuestionType;
      options?: string[];
      rangeDefaults?: { min?: string; max?: string };
    }
  ) => void;
  onAddCustomPreScreenQuestion: () => void;
  onUpdatePreScreenQuestion: (
    questionId: string,
    updates: Partial<{ question: string; answerType: PreScreenQuestionType }>
  ) => void;
  onUpdatePreScreenRange: (
    questionId: string,
    key: "rangeMin" | "rangeMax",
    value: string
  ) => void;
  onAddPreScreenOption: (questionId: string) => void;
  onUpdatePreScreenOption: (questionId: string, optionId: string, label: string) => void;
  onRemovePreScreenOption: (questionId: string, optionId: string) => void;
  onRemovePreScreenQuestion: (questionId: string) => void;
  onReorderPreScreenQuestions: (sourceQuestionId: string, targetQuestionId: string | null) => void;
  onPreScreenDragStart: (event: DragEvent<HTMLDivElement>, questionId: string) => void;
  onPreScreenDragOver: (event: DragEvent<HTMLDivElement>, questionId: string) => void;
  onPreScreenDrop: (event: DragEvent<HTMLDivElement>, questionId: string) => void;
  onPreScreenDragLeave: (questionId: string) => void;
  onPreScreenDragEnd: () => void;
}

const CvReviewPreScreeningStep = ({
  draft,
  updateDraft,
  showValidation,
  isStepComplete,
  isDescriptionPresent,
  secretPromptIds,
  preScreeningQuestions,
  openPreScreenTypeFor,
  setOpenPreScreenTypeFor,
  activeDragQuestionId,
  setActiveDragQuestionId,
  draggingQuestionId,
  dragOverQuestionId,
  setDragOverQuestionId,
  isDragOverTail,
  setIsDragOverTail,
  onAddPreScreenQuestion,
  onAddCustomPreScreenQuestion,
  onUpdatePreScreenQuestion,
  onUpdatePreScreenRange,
  onAddPreScreenOption,
  onUpdatePreScreenOption,
  onRemovePreScreenOption,
  onRemovePreScreenQuestion,
  onReorderPreScreenQuestions,
  onPreScreenDragStart,
  onPreScreenDragOver,
  onPreScreenDrop,
  onPreScreenDragLeave,
  onPreScreenDragEnd,
}: CvReviewPreScreeningStepProps) => {
  return (
    <>
      <div className={styles.card}>
        <header className={styles.cardHeader}>
          <span className={styles.icon}>
            <i className="la la-id-badge"></i>
          </span>
          <div className={styles.titleGroup}>
            <strong>CV Review Settings</strong>
            <span>Control how Jia endorses candidates</span>
          </div>
        </header>
        <div className={styles.cardInner}>
          {showValidation && !isStepComplete && (
            <div className={styles.aiQuestionsValidation} role="alert" style={{ marginBottom: 20 }}>
              <span className={styles.aiQuestionsValidationIcon} aria-hidden="true">
                <i className="la la-exclamation-triangle"></i>
              </span>
              <span>
                {(() => {
                  const missingDescription = !isDescriptionPresent(draft.description);
                  const missingQuestions =
                    preScreeningQuestions.length === 0 ||
                    !preScreeningQuestions.some(
                      (question: any) =>
                        typeof question?.question === "string" && question.question.trim().length > 0
                    );

                  if (missingDescription && missingQuestions) {
                    return "Add a job description and at least one pre-screening question.";
                  }
                  if (missingDescription) {
                    return "Add a job description to continue.";
                  }
                  if (missingQuestions) {
                    return "Add at least one pre-screening question.";
                  }
                  return "Please complete required fields.";
                })()}
              </span>
            </div>
          )}
          <div className={styles.inlineField}>
            <label
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: "#111827",
                marginBottom: "8px",
              }}
            >
              CV Screening
            </label>
            <p style={{ margin: "0 0 12px 0", fontSize: "14px", lineHeight: "20px", color: "#4b5563" }}>
              Jia automatically endorses candidates who meet the chosen criteria.
            </p>
            <CustomDropdown
              screeningSetting={draft.screeningSetting}
              settingList={SCREENING_SETTING_OPTIONS}
              placeholder="Select screening setting"
              onSelectSetting={(value: string) => updateDraft({ screeningSetting: value })}
            />
          </div>
          <SecretPromptField
            inputId={secretPromptIds.input}
            descriptionId={secretPromptIds.description}
            label="CV Secret Prompt"
            helper="Secret prompts fine-tune how Jia reviews resumes before recommending candidates."
            placeholder="Enter a CV secret prompt (e.g. Emphasize candidates with product-led growth experience in SaaS)."
            value={draft.cvSecretPrompt || ""}
            onChange={(nextValue) => updateDraft({ cvSecretPrompt: nextValue })}
            iconSrc="/assets/icons/ai-sparkles.svg"
            iconAlt="CV Secret Prompt"
            tooltipContent={
              <span className={styles.secretPromptTooltipText}>
                These prompts remain hidden from candidates and the public job portal. Additionally, only
                Admins and the Job Owner can view the secret prompt.
              </span>
            }
            tooltipAriaLabel="Learn more about CV secret prompts"
          />
        </div>
      </div>

      <div className={styles.card}>
        <header className={styles.cardHeader}>
          <span className={styles.icon}>
            <i className="la la-list-alt"></i>
          </span>
          <div className={styles.titleGroup}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <strong>Pre-Screening Questions</strong>
              <span style={{ fontSize: "14px", fontWeight: 500, color: "#6b7280" }}>(optional)</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onAddCustomPreScreenQuestion}
            style={{
              marginLeft: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 16px",
              borderRadius: "999px",
              border: "none",
              backgroundColor: "#111827",
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <i className="la la-plus" aria-hidden="true"></i>
            Add custom
          </button>
        </header>
        <div className={styles.cardInner}>
          {preScreeningQuestions.length === 0 ? (
            <div
              style={{
                border: "1px solid #E5E7EB",
                borderRadius: "12px",
                padding: "24px",
                marginBottom: "24px",
                fontSize: "14px",
                color: "#4b5563",
                textAlign: "center",
              }}
            >
              No pre-screening questions added yet.
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                marginBottom: "24px",
              }}
            >
              {preScreeningQuestions.map((item: any, index: number) => {
                const resolvedAnswerType: PreScreenQuestionType =
                  (typeof item?.answerType === "string"
                    ? (item.answerType as PreScreenQuestionType)
                    : Array.isArray(item?.options) && item.options.length
                      ? "dropdown"
                      : "short_text") || "short_text";

                const currentTypeOption =
                  PRE_SCREEN_TYPE_OPTIONS.find((option) => option.value === resolvedAnswerType) ||
                  PRE_SCREEN_TYPE_OPTIONS[0];

                const optionList: Array<{ id: string; label: string }> = Array.isArray(item?.options)
                  ? item.options
                  : [];
                const isChoiceBased =
                  resolvedAnswerType === "dropdown" || resolvedAnswerType === "checkboxes";
                const isRange = resolvedAnswerType === "range";
                const isShortAnswer = resolvedAnswerType === "short_text";
                const isLongAnswer = resolvedAnswerType === "long_text";
                const rangeMinValue = Number(item?.rangeMin ?? "");
                const rangeMaxValue = Number(item?.rangeMax ?? "");
                const showRangeError =
                  isRange &&
                  item?.rangeMin?.trim() &&
                  item?.rangeMax?.trim() &&
                  !Number.isNaN(rangeMinValue) &&
                  !Number.isNaN(rangeMaxValue) &&
                  rangeMinValue > rangeMaxValue;
                const typeButtonId = `pre-screen-type-trigger-${item.id}`;
                const typeMenuId = `pre-screen-type-menu-${item.id}`;
                const isTypeMenuOpen = openPreScreenTypeFor === item.id;
                const addOptionLabel = resolvedAnswerType === "checkboxes" ? "Add Choice" : "Add Option";
                const choiceHelperText = resolvedAnswerType === "checkboxes"
                  ? "Candidates can select more than one choice."
                  : "Candidates choose a single option.";
                const freeformHelperTextMap: Record<PreScreenQuestionType, string> = {
                  short_text: "Candidates will provide a short written response.",
                  long_text: "Candidates can write a longer, detailed answer.",
                  dropdown: "",
                  checkboxes: "",
                  range: "Candidates pick a numeric range or value.",
                };
                const isDragEnabled = activeDragQuestionId === item.id;
                const isDraggingQuestion = draggingQuestionId === item.id;
                const isDragOverQuestion =
                  dragOverQuestionId === item.id && draggingQuestionId !== item.id;

                return (
                  <div
                    key={item.id}
                    className={classNames({
                      [styles.questionCardDragging]: isDraggingQuestion,
                      [styles.questionCardDragOver]: isDragOverQuestion,
                    })}
                    style={{
                      border: "1px solid #E5E7EB",
                      borderRadius: "16px",
                      padding: "20px",
                      paddingLeft: "28px",
                      backgroundColor: "#fbfcff",
                      display: "flex",
                      flexDirection: "column",
                      gap: "16px",
                      position: "relative",
                      marginLeft: "64px",
                      overflow: "visible",
                    }}
                    draggable={isDragEnabled || isDraggingQuestion}
                    onDragStart={(event) => onPreScreenDragStart(event, item.id)}
                    onDragEnter={(event) => onPreScreenDragOver(event, item.id)}
                    onDragOver={(event) => onPreScreenDragOver(event, item.id)}
                    onDragLeave={() => onPreScreenDragLeave(item.id)}
                    onDrop={(event) => onPreScreenDrop(event, item.id)}
                    onDragEnd={onPreScreenDragEnd}
                  >
                    <button
                      type="button"
                      className={styles.dragHandleButton}
                      aria-label="Drag to reorder question"
                      aria-grabbed={isDraggingQuestion}
                      onMouseDown={() => setActiveDragQuestionId(item.id)}
                      onMouseUp={() => {
                        if (!draggingQuestionId) {
                          setActiveDragQuestionId(null);
                        }
                      }}
                      onMouseLeave={() => {
                        if (!draggingQuestionId) {
                          setActiveDragQuestionId(null);
                        }
                      }}
                      onTouchStart={() => setActiveDragQuestionId(item.id)}
                      onTouchEnd={() => {
                        if (!draggingQuestionId) {
                          setActiveDragQuestionId(null);
                        }
                      }}
                      onTouchCancel={() => {
                        if (!draggingQuestionId) {
                          setActiveDragQuestionId(null);
                        }
                      }}
                    >
                      <span className={styles.dragHandleDots} aria-hidden="true">
                        <span className={styles.dragHandleDot}></span>
                        <span className={styles.dragHandleDot}></span>
                        <span className={styles.dragHandleDot}></span>
                        <span className={styles.dragHandleDot}></span>
                        <span className={styles.dragHandleDot}></span>
                        <span className={styles.dragHandleDot}></span>
                      </span>
                    </button>

                    <div
                      style={{
                        flex: "1 1 auto",
                        minWidth: 0,
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "16px",
                        alignItems: "flex-start",
                      }}
                    >
                      <div style={{ flex: "1 1 320px", minWidth: "260px" }}>
                        <label
                          htmlFor={`pre-screen-question-${item.id}`}
                          style={{
                            display: "block",
                            fontSize: "13px",
                            fontWeight: 600,
                            color: "#6b7280",
                            marginBottom: "6px",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          Question {index + 1}
                        </label>
                        <input
                          id={`pre-screen-question-${item.id}`}
                          value={item.question || ""}
                          onChange={(event) =>
                            onUpdatePreScreenQuestion(item.id, {
                              question: event.target.value,
                            })
                          }
                          placeholder="Enter question"
                          style={{
                            width: "100%",
                            padding: "12px 14px",
                            borderRadius: "10px",
                            border: "1px solid #d1d5db",
                            fontSize: "15px",
                            color: "#111827",
                            backgroundColor: "#ffffff",
                          }}
                        />
                      </div>

                      <div style={{ flex: "0 0 220px", minWidth: "220px", position: "relative" }}>
                        <label
                          style={{
                            display: "block",
                            fontSize: "13px",
                            fontWeight: 600,
                            color: "#6b7280",
                            marginBottom: "6px",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          Response type
                        </label>
                        <button
                          id={typeButtonId}
                          type="button"
                          onClick={() =>
                            setOpenPreScreenTypeFor((current) => (current === item.id ? null : item.id))
                          }
                          aria-haspopup="listbox"
                          aria-expanded={isTypeMenuOpen}
                          aria-controls={typeMenuId}
                          style={{
                            width: "100%",
                            padding: "12px 16px",
                            borderRadius: "12px",
                            border: isTypeMenuOpen ? "2px solid #2563eb" : "1px solid #d1d5db",
                            backgroundColor: "#ffffff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "12px",
                            fontSize: "15px",
                            fontWeight: 600,
                            color: "#111827",
                            boxShadow: isTypeMenuOpen ? "0 0 0 3px rgba(37,99,235,0.15)" : "none",
                            transition: "box-shadow 0.15s ease, border 0.15s ease",
                          }}
                        >
                          <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span
                              style={{
                                width: "28px",
                                height: "28px",
                                borderRadius: "50%",
                                backgroundColor: "#f3f4f6",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#4b5563",
                              }}
                            >
                              <i className={currentTypeOption.icon} style={{ fontSize: "16px" }}></i>
                            </span>
                            <span>{currentTypeOption.label}</span>
                          </span>
                          <i className="la la-angle-down" aria-hidden="true" style={{ fontSize: "18px", color: "#9ca3af" }}></i>
                        </button>
                        {isTypeMenuOpen && (
                          <div
                            id={typeMenuId}
                            role="listbox"
                            aria-label="Select response type"
                            style={{
                              position: "absolute",
                              top: "calc(100% + 8px)",
                              left: 0,
                              right: 0,
                              backgroundColor: "#ffffff",
                              borderRadius: "14px",
                              border: "1px solid #dbe2f0",
                              boxShadow: "0 16px 32px rgba(15, 23, 42, 0.14)",
                              padding: "8px 0",
                              zIndex: 40,
                            }}
                          >
                            {PRE_SCREEN_TYPE_OPTIONS.map((option) => {
                              const isSelected = option.value === resolvedAnswerType;
                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  role="option"
                                  aria-selected={isSelected}
                                  onClick={() => {
                                    onUpdatePreScreenQuestion(item.id, { answerType: option.value });
                                    setOpenPreScreenTypeFor(null);
                                  }}
                                  style={{
                                    width: "100%",
                                    padding: "10px 18px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: "12px",
                                    backgroundColor: isSelected ? "#f5f9ff" : "transparent",
                                    border: "none",
                                    cursor: "pointer",
                                  }}
                                >
                                  <span
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "12px",
                                      color: "#111827",
                                      fontWeight: isSelected ? 700 : 500,
                                    }}
                                  >
                                    <span
                                      style={{
                                        width: "28px",
                                        height: "28px",
                                        borderRadius: "50%",
                                        backgroundColor: "#f3f4f6",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: "#4b5563",
                                      }}
                                    >
                                      <i className={option.icon} style={{ fontSize: "16px" }}></i>
                                    </span>
                                    {option.label}
                                  </span>
                                  {isSelected && (
                                    <i className="la la-check" style={{ color: "#2563eb", fontSize: "16px" }}></i>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {isChoiceBased ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ fontSize: "13px", color: "#6b7280" }}>{choiceHelperText}</div>
                        {optionList.map((option, optionIndex) => {
                          const isCheckboxType = resolvedAnswerType === "checkboxes";
                          return (
                            <div
                              key={option.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                              }}
                            >
                              {isCheckboxType ? (
                                <input
                                  type="checkbox"
                                  disabled
                                  aria-hidden="true"
                                  style={{
                                    width: "18px",
                                    height: "18px",
                                    accentColor: "#111827",
                                    cursor: "not-allowed",
                                  }}
                                />
                              ) : (
                                <span
                                  style={{
                                    width: "32px",
                                    height: "38px",
                                    border: "1px solid #d1d5db",
                                    borderRadius: "8px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "14px",
                                    fontWeight: 600,
                                    color: "#6b7280",
                                    backgroundColor: "#f9fafb",
                                  }}
                                >
                                  {optionIndex + 1}
                                </span>
                              )}
                              <input
                                value={option.label || ""}
                                onChange={(event) =>
                                  onUpdatePreScreenOption(item.id, option.id, event.target.value)
                                }
                                placeholder="Option label"
                                style={{
                                  flex: 1,
                                  padding: "10px 14px",
                                  borderRadius: "10px",
                                  border: "1px solid #d1d5db",
                                  fontSize: "15px",
                                  color: "#111827",
                                  backgroundColor: "#ffffff",
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => onRemovePreScreenOption(item.id, option.id)}
                                style={{
                                  width: "36px",
                                  height: "36px",
                                  borderRadius: "50%",
                                  border: "1px solid #e5e7eb",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  backgroundColor: "#ffffff",
                                  color: "#9ca3af",
                                  cursor: "pointer",
                                }}
                                aria-label={`Remove option ${optionIndex + 1}`}
                              >
                                <i className="la la-times" aria-hidden="true"></i>
                              </button>
                            </div>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => onAddPreScreenOption(item.id)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            fontSize: "13px",
                            fontWeight: 700,
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                            color: "#18181b",
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            alignSelf: "flex-start",
                          }}
                        >
                          <i className="la la-plus" aria-hidden="true"></i>
                          {addOptionLabel}
                        </button>
                      </div>
                    ) : isRange ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div className={styles.salaryGroup}>
                          <div
                            className={classNames(styles.inlineField, styles.salaryInput, {
                              [styles.errorField]: showRangeError,
                            })}
                          >
                            <label htmlFor={`pre-screen-range-min-${item.id}`}>Minimum Value</label>
                            <div className={styles.salaryInputControl}>
                              <span className={styles.currencyPrefix} aria-hidden="true">
                                ₱
                              </span>
                              <input
                                id={`pre-screen-range-min-${item.id}`}
                                type="number"
                                placeholder="0"
                                value={item.rangeMin || ""}
                                onChange={(event) =>
                                  onUpdatePreScreenRange(item.id, "rangeMin", event.target.value)
                                }
                                className={classNames({
                                  [styles.errorInput]: showRangeError,
                                })}
                              />
                              <div className={styles.currencySuffixDropdown} aria-hidden="true">
                                <span
                                  className={styles.currencyButton}
                                  style={{ pointerEvents: "none", cursor: "default" }}
                                >
                                  <span>PHP</span>
                                  <i className="la la-angle-down" aria-hidden="true"></i>
                                </span>
                              </div>
                            </div>
                          </div>
                          <div
                            className={classNames(styles.inlineField, styles.salaryInput, {
                              [styles.errorField]: showRangeError,
                            })}
                          >
                            <label htmlFor={`pre-screen-range-max-${item.id}`}>Maximum Value</label>
                            <div className={styles.salaryInputControl}>
                              <span className={styles.currencyPrefix} aria-hidden="true">
                                ₱
                              </span>
                              <input
                                id={`pre-screen-range-max-${item.id}`}
                                type="number"
                                placeholder="0"
                                value={item.rangeMax || ""}
                                onChange={(event) =>
                                  onUpdatePreScreenRange(item.id, "rangeMax", event.target.value)
                                }
                                className={classNames({
                                  [styles.errorInput]: showRangeError,
                                })}
                              />
                              <div className={styles.currencySuffixDropdown} aria-hidden="true">
                                <span
                                  className={styles.currencyButton}
                                  style={{ pointerEvents: "none", cursor: "default" }}
                                >
                                  <span>PHP</span>
                                  <i className="la la-angle-down" aria-hidden="true"></i>
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        {showRangeError && (
                          <div style={{ color: "#dc2626", fontSize: "12px" }}>
                            Minimum value cannot be greater than maximum value.
                          </div>
                        )}
                        <div style={{ fontSize: "13px", color: "#6b7280" }}>
                          Candidates provide a value within this range.
                        </div>
                      </div>
                    ) : isShortAnswer ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: 600,
                            color: "#6b7280",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          Candidate Response Preview
                        </span>
                        <input
                          type="text"
                          disabled
                          placeholder="Candidate will type a short answer"
                          style={{
                            padding: "12px 14px",
                            borderRadius: "10px",
                            border: "1px solid #d1d5db",
                            fontSize: "15px",
                            color: "#9ca3af",
                            backgroundColor: "#f9fafb",
                          }}
                        />
                        <div style={{ fontSize: "13px", color: "#6b7280" }}>
                          {freeformHelperTextMap[resolvedAnswerType]}
                        </div>
                      </div>
                    ) : isLongAnswer ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: 600,
                            color: "#6b7280",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          Candidate Response Preview
                        </span>
                        <textarea
                          disabled
                          rows={4}
                          placeholder="Candidate will type a detailed answer"
                          style={{
                            padding: "12px 14px",
                            borderRadius: "10px",
                            border: "1px solid #d1d5db",
                            fontSize: "15px",
                            color: "#9ca3af",
                            backgroundColor: "#f9fafb",
                            resize: "vertical",
                          }}
                        />
                        <div style={{ fontSize: "13px", color: "#6b7280" }}>
                          {freeformHelperTextMap[resolvedAnswerType]}
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          fontSize: "13px",
                          color: "#6b7280",
                          backgroundColor: "#f9fafb",
                          borderRadius: "10px",
                          padding: "12px 16px",
                        }}
                      >
                        {freeformHelperTextMap[resolvedAnswerType] ||
                          "Candidates will provide a short written response."}
                      </div>
                    )}

                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => onRemovePreScreenQuestion(item.id)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "10px 18px",
                          borderRadius: "12px",
                          border: "1px solid #fca5a5",
                          backgroundColor: "transparent",
                          color: "#dc2626",
                          fontSize: "14px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                        aria-label={`Remove question ${index + 1}`}
                      >
                        <i className="la la-times" aria-hidden="true"></i>
                        Remove Question
                      </button>
                    </div>
                  </div>
                );
              })}
              <div
                className={classNames(styles.dragTailZone, {
                  [styles.dragTailZoneActive]: isDragOverTail,
                })}
                style={{
                  height: draggingQuestionId ? 36 : 0,
                  marginTop: draggingQuestionId ? 12 : 0,
                  opacity: draggingQuestionId ? 1 : 0,
                  pointerEvents: draggingQuestionId ? "auto" : "none",
                }}
                onDragOver={(event) => {
                  if (!draggingQuestionId) {
                    return;
                  }
                  event.preventDefault();
                  event.stopPropagation();
                  event.dataTransfer.dropEffect = "move";
                  if (!isDragOverTail) {
                    setIsDragOverTail(true);
                  }
                  if (dragOverQuestionId) {
                    setDragOverQuestionId(null);
                  }
                }}
                onDragLeave={() => setIsDragOverTail(false)}
                onDrop={(event) => {
                  if (!draggingQuestionId) {
                    return;
                  }
                  event.preventDefault();
                  event.stopPropagation();
                  onReorderPreScreenQuestions(draggingQuestionId, null);
                  onPreScreenDragEnd();
                }}
                aria-label="Drop to move question to the end"
              ></div>
            </div>
          )}

          <div style={{ fontSize: "14px", color: "#111827", fontWeight: 600, marginBottom: "12px" }}>
            Suggested Pre-screening Questions:
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {SUGGESTED_PRE_SCREENING_QUESTIONS.map((suggestion: SuggestedPreScreenQuestion) => {
              const alreadyAdded = preScreeningQuestions.some(
                (question: any) =>
                  typeof question?.question === "string" &&
                  question.question.trim().toLowerCase() === suggestion.prompt.trim().toLowerCase()
              );

              return (
                <div
                  key={suggestion.prompt}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: 600, color: "#111827" }}>
                      {suggestion.label}
                    </div>
                    <div style={{ fontSize: "14px", color: "#4b5563", marginTop: "2px" }}>
                      {suggestion.prompt}
                    </div>
                    {suggestion.answerType === "dropdown" && suggestion.defaultOptions && (
                      <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "8px" }}>
                        Default options: {suggestion.defaultOptions.join(", ")}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onAddPreScreenQuestion(suggestion.prompt, {
                        answerType: suggestion.answerType ?? "dropdown",
                        options: suggestion.defaultOptions,
                      })
                    }
                    disabled={alreadyAdded}
                    style={{
                      borderRadius: "999px",
                      border: "1px solid #E5E7EB",
                      padding: "8px 18px",
                      backgroundColor: alreadyAdded ? "#F3F4F6" : "#ffffff",
                      color: alreadyAdded ? "#9ca3af" : "#111827",
                      fontSize: "14px",
                      fontWeight: 600,
                      cursor: alreadyAdded ? "not-allowed" : "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {alreadyAdded ? "Added" : "Add"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};

export default CvReviewPreScreeningStep;
