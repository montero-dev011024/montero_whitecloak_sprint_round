"use client";

import { DragEvent, CSSProperties } from "react";
import classNames from "classnames";

import CustomDropdown from "@/lib/components/CareerComponents/CustomDropdown";
import type { CareerFormDraft, QuestionGroup } from "@/lib/hooks/useSegmentedCareerFormState";
import {
  SCREENING_SETTING_OPTIONS,
} from "../constants";
import SecretPromptField from "../components/SecretPromptField";
import styles from "@/lib/styles/segmentedCareerForm.module.scss";

interface AiSecretPromptIds {
  input: string;
  description: string;
}

interface AiInterviewSetupStepProps {
  draft: CareerFormDraft;
  updateDraft: (update: Partial<CareerFormDraft>) => void;
  secretPromptIds: AiSecretPromptIds;
  totalInterviewQuestionCount: number;
  showAiQuestionValidation: boolean;
  questions: QuestionGroup[];
  isInterviewQuestion: (question: any) => boolean;
  draggingInterviewQuestionId: string | null;
  dragOverInterviewQuestionId: string | null;
  activeDragInterviewGroupId: number | null;
  interviewTailHoverGroupId: number | null;
  pendingQuestionGeneration: string | null;
  isGeneratingQuestions: boolean;
  onGenerateAll: () => void;
  onGenerateForCategory: (category: string) => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>, questionId: string, groupId: number) => void;
  onDragEnter: (event: DragEvent<HTMLDivElement>, questionId: string) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>, questionId: string) => void;
  onDragLeave: (questionId: string) => void;
  onDrop: (event: DragEvent<HTMLDivElement>, questionId: string) => void;
  onDragEnd: () => void;
  onTailDragOver: (event: DragEvent<HTMLDivElement>, groupId: number) => void;
  onTailDragLeave: (groupId: number) => void;
  onTailDrop: (event: DragEvent<HTMLDivElement>, groupId: number) => void;
  openQuestionModal: (
    action: "add" | "edit" | "delete",
    groupId: number,
    question?: { id: string; question: string }
  ) => void;
}

const AiInterviewSetupStep = ({
  draft,
  updateDraft,
  secretPromptIds,
  totalInterviewQuestionCount,
  showAiQuestionValidation,
  questions,
  isInterviewQuestion,
  draggingInterviewQuestionId,
  dragOverInterviewQuestionId,
  activeDragInterviewGroupId,
  interviewTailHoverGroupId,
  pendingQuestionGeneration,
  isGeneratingQuestions,
  onGenerateAll,
  onGenerateForCategory,
  onDragStart,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onTailDragOver,
  onTailDragLeave,
  onTailDrop,
  openQuestionModal,
}: AiInterviewSetupStepProps) => {
  const requireVideoSetting = draft.requireVideo ?? true;

  return (
    <>
      <div className={styles.card}>
        <header className={classNames(styles.cardHeader, styles.aiCardHeader)}>
          <div className={styles.aiCardHeaderLeft}>
            <div className={styles.aiCardBadge}>1</div>
            <div className={styles.titleGroup}>
              <strong>AI Interview Settings</strong>
              <span>Guide Jia's live interview experience.</span>
            </div>
          </div>
        </header>
        <div className={classNames(styles.cardInner, styles.aiSettingsInner)}>
          <section className={styles.aiSettingSection}>
            <div className={styles.aiSettingHeading}>
              <h3>AI Interview Screening</h3>
              <p>Jia automatically endorses candidates who meet the chosen criteria.</p>
            </div>
            <div className={styles.aiSettingControl}>
              <CustomDropdown
                screeningSetting={draft.screeningSetting}
                settingList={SCREENING_SETTING_OPTIONS}
                placeholder="Select screening setting"
                onSelectSetting={(value: string) => updateDraft({ screeningSetting: value })}
              />
            </div>
          </section>

          <div className={styles.aiSettingDivider} aria-hidden="true"></div>

          <section className={classNames(styles.aiSettingSection, styles.requireVideoSection)}>
            <div className={styles.aiSettingHeading}>
              <h3>Require Video on Interview</h3>
              <p>
                Require candidates to keep their camera on. Recordings will appear on their analysis page.
              </p>
            </div>
            <div className={styles.requireVideoToggleRow}>
              <div className={styles.requireVideoLabel}>
                <span className={styles.requireVideoIcon} aria-hidden="true">
                  <i className="la la-video"></i>
                </span>
                <span>Require Video Interview</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={requireVideoSetting}
                onClick={() => updateDraft({ requireVideo: !requireVideoSetting })}
                className={classNames(styles.toggle, requireVideoSetting && styles.toggleOn)}
              >
                <span className={styles.toggleThumb}></span>
              </button>
              <span className={styles.toggleValue}>{requireVideoSetting ? "Yes" : "No"}</span>
            </div>
          </section>

          <SecretPromptField
            inputId={secretPromptIds.input}
            descriptionId={secretPromptIds.description}
            label="AI Interview Secret Prompt"
            helper="Shape Jia's interview scoring focus; this prompt does not affect CV screening."
            placeholder="Enter an interview secret prompt (e.g. Highlight storytelling around client impact and coaching experience)."
            value={draft.aiInterviewSecretPrompt || ""}
            onChange={(nextValue) => updateDraft({ aiInterviewSecretPrompt: nextValue })}
            withDivider
            iconSrc="/assets/icons/ai-sparkles.svg"
            iconAlt="AI Secret Prompt"
            tooltipContent={
              <span className={styles.secretPromptTooltipText}>
                These prompts remain hidden from candidates and the public job portal. Additionally, only
                Admins and the Job Owner can view the secret prompt.
              </span>
            }
            tooltipAriaLabel="Learn more about AI interview secret prompts"
          />
        </div>
      </div>

      <div className={styles.card}>
        <header className={classNames(styles.cardHeader, styles.aiCardHeader)}>
          <div className={styles.aiCardHeaderLeft}>
            <div className={styles.aiCardBadge}>2</div>
            <div className={styles.titleGroup}>
              <strong>AI Interview Questions</strong>
              <span>Create and manage Jia's interview prompts.</span>
            </div>
          </div>
          <div className={styles.aiCardHeaderRight}>
            <span className={styles.aiQuestionsCounter} aria-live="polite">
              {totalInterviewQuestionCount}
            </span>
            <button
              type="button"
              className={styles.aiQuestionsGenerateAll}
              onClick={onGenerateAll}
              disabled={isGeneratingQuestions}
            >
              <i className="la la-sparkles" aria-hidden="true"></i>
              {pendingQuestionGeneration === "all" ? "Generating..." : "Generate all questions"}
            </button>
          </div>
        </header>
        <div className={styles.aiQuestionsBody}>
          {showAiQuestionValidation && (
            <div className={styles.aiQuestionsValidation} role="alert">
              <span className={styles.aiQuestionsValidationIcon} aria-hidden="true">
                <i className="la la-exclamation-triangle"></i>
              </span>
              <span>Please add at least 5 interview questions.</span>
            </div>
          )}
          <div className={styles.aiQuestionsList} aria-label="AI interview question controls">
            {questions.map((group) => {
              const groupQuestions = Array.isArray(group.questions)
                ? group.questions.filter((question: any) => isInterviewQuestion(question))
                : [];
              const tailZoneActive = Boolean(draggingInterviewQuestionId) && activeDragInterviewGroupId === group.id;
              const tailZoneStyle = {
                height: tailZoneActive ? 36 : 0,
                marginTop: tailZoneActive ? 12 : 0,
                opacity: tailZoneActive ? 1 : 0,
                pointerEvents: tailZoneActive ? "auto" : "none",
              } as CSSProperties;

              return (
                <div className={styles.aiQuestionsRow} key={group.id}>
                  <div className={styles.aiQuestionRowHeader}>
                    <div className={styles.aiQuestionCategory}>
                      <span>{group.category}</span>
                    </div>
                  </div>
                  {groupQuestions.length > 0 ? (
                    <div className={styles.aiQuestionList}>
                      {groupQuestions.map((question: any, index: number) => {
                        const questionId = question?.id ?? `ai-question-${group.id}-${index}`;
                        const questionText = typeof question?.question === "string" ? question.question : "";
                        const isDragging = draggingInterviewQuestionId === questionId;
                        const isDragOver =
                          dragOverInterviewQuestionId === questionId && draggingInterviewQuestionId !== questionId;

                        return (
                          <div
                            className={classNames(styles.aiQuestionListItem, {
                              [styles.questionCardDragging]: isDragging,
                              [styles.questionCardDragOver]: isDragOver,
                            })}
                            key={questionId}
                            draggable={isDragging}
                            onDragEnter={(event) => onDragEnter(event, questionId)}
                            onDragOver={(event) => onDragOver(event, questionId)}
                            onDragLeave={() => onDragLeave(questionId)}
                            onDrop={(event) => onDrop(event, questionId)}
                            onDragEnd={onDragEnd}
                          >
                            <button
                              type="button"
                              className={styles.dragHandleButton}
                              aria-label="Drag to reorder interview question"
                              aria-grabbed={isDragging}
                              draggable
                              onDragStart={(event) => onDragStart(event, questionId, group.id)}
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
                            <div className={styles.aiQuestionListContent}>
                              <span aria-label="Interview question">{questionText}</span>
                            </div>
                            <div className={styles.aiQuestionListActions}>
                              <button
                                type="button"
                                className={classNames(
                                  styles.aiQuestionListButton,
                                  styles.aiQuestionListButtonWithLabel
                                )}
                                onClick={() =>
                                  openQuestionModal("edit", group.id, {
                                    id: questionId,
                                    question: questionText,
                                  })
                                }
                                aria-label="Edit interview question"
                              >
                                <i className="la la-pen" aria-hidden="true"></i>
                                <span className={styles.aiQuestionListButtonLabel}>Edit</span>
                              </button>
                              <button
                                type="button"
                                className={classNames(
                                  styles.aiQuestionListButton,
                                  styles.aiQuestionListButtonDelete
                                )}
                                onClick={() =>
                                  openQuestionModal("delete", group.id, {
                                    id: questionId,
                                    question: questionText,
                                  })
                                }
                                aria-label="Delete interview question"
                              >
                                <i className="la la-trash-alt" aria-hidden="true"></i>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      <div
                        className={classNames(styles.dragTailZone, {
                          [styles.dragTailZoneActive]: interviewTailHoverGroupId === group.id,
                        })}
                        style={tailZoneStyle}
                        onDragOver={(event) => onTailDragOver(event, group.id)}
                        onDragLeave={() => onTailDragLeave(group.id)}
                        onDrop={(event) => onTailDrop(event, group.id)}
                        aria-label="Drop to move question to the end of this category"
                      ></div>
                    </div>
                  ) : (
                    <>
                      <div className={styles.aiQuestionEmpty}>
                        <i className="la la-info-circle" aria-hidden="true"></i>
                        <span>No questions added yet.</span>
                      </div>
                      <div
                        className={classNames(styles.dragTailZone, {
                          [styles.dragTailZoneActive]: interviewTailHoverGroupId === group.id,
                        })}
                        style={tailZoneStyle}
                        onDragOver={(event) => onTailDragOver(event, group.id)}
                        onDragLeave={() => onTailDragLeave(group.id)}
                        onDrop={(event) => onTailDrop(event, group.id)}
                        aria-label="Drop to move question to this category"
                      ></div>
                    </>
                  )}
                  <div className={styles.aiQuestionActions}>
                    <div className={styles.aiQuestionActionsButtons}>
                      <button
                        type="button"
                        className={styles.aiQuestionPrimary}
                        onClick={() => onGenerateForCategory(group.category)}
                        disabled={isGeneratingQuestions}
                      >
                        <i className="la la-sparkles" aria-hidden="true"></i>
                        {pendingQuestionGeneration === group.category
                          ? "Generating..."
                          : "Generate questions"}
                      </button>
                      <button
                        type="button"
                        className={styles.aiQuestionSecondary}
                        onClick={() => openQuestionModal("add", group.id)}
                        disabled={isGeneratingQuestions}
                      >
                        <i className="la la-plus" aria-hidden="true"></i>
                        Manually add
                      </button>
                    </div>
                    <div className={styles.aiQuestionCounterGroup}>
                      <span className={styles.aiQuestionCounterLabel}># of questions to ask</span>
                      <span className={styles.aiQuestionCounterValue} aria-live="polite">
                        {groupQuestions.length}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};

export default AiInterviewSetupStep;
