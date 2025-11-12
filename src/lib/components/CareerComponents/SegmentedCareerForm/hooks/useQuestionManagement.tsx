"use client";

import {
  Dispatch,
  DragEvent,
  SetStateAction,
  useCallback,
  useMemo,
  useState,
} from "react";

import {
  candidateActionToast,
  errorToast,
  guid,
} from "@/lib/Utils";
import {
  QUESTION_ORIGIN,
  PreScreenQuestionType,
} from "../constants";
import {
  createDefaultQuestionGroups,
  type QuestionGroup,
} from "@/lib/hooks/useSegmentedCareerFormState";
import {
  cloneQuestionGroups,
  ensureQuestionCountWithinBounds,
  extractQuestionText,
  isInterviewQuestion,
  isPreScreenQuestion,
  normalizeCategoryName,
  normalizeQuestionGroups,
  normalizeQuestionText,
} from "../utils/questionUtils";
import type {
  QuestionModalAction,
  QuestionModalState,
} from "../segmentTypes";

interface UseQuestionManagementArgs {
  questions: QuestionGroup[];
  setQuestions: Dispatch<SetStateAction<QuestionGroup[]>>;
  setOpenPreScreenTypeFor?: Dispatch<SetStateAction<string | null>>;
}

interface InterviewQuestionGroupSummary {
  id: number;
  category: string;
  interviewQuestions: any[];
}

interface UseQuestionManagementResult {
  preScreeningQuestions: any[];
  interviewQuestionGroups: InterviewQuestionGroupSummary[];
  activeDragQuestionId: string | null;
  setActiveDragQuestionId: Dispatch<SetStateAction<string | null>>;
  draggingQuestionId: string | null;
  setDraggingQuestionId: Dispatch<SetStateAction<string | null>>;
  dragOverQuestionId: string | null;
  setDragOverQuestionId: Dispatch<SetStateAction<string | null>>;
  isDragOverTail: boolean;
  setIsDragOverTail: Dispatch<SetStateAction<boolean>>;
  handleAddPreScreenQuestion: (
    questionText: string,
    template?: {
      answerType?: PreScreenQuestionType;
      options?: string[];
      rangeDefaults?: { min?: string; max?: string };
    }
  ) => void;
  handleRemovePreScreenQuestion: (questionId: string) => void;
  handleUpdatePreScreenQuestion: (
    questionId: string,
    updates: Partial<{ question: string; answerType: PreScreenQuestionType }>
  ) => void;
  handleReorderPreScreenQuestions: (sourceQuestionId: string, targetQuestionId: string | null) => void;
  handlePreScreenDragStart: (event: DragEvent<HTMLDivElement>, questionId: string) => void;
  handlePreScreenDragOver: (event: DragEvent<HTMLDivElement>, targetQuestionId: string) => void;
  handlePreScreenDrop: (event: DragEvent<HTMLDivElement>, targetQuestionId: string) => void;
  handlePreScreenDragLeave: (targetQuestionId: string) => void;
  handlePreScreenDragEnd: () => void;
  handleUpdatePreScreenRange: (questionId: string, key: "rangeMin" | "rangeMax", value: string) => void;
  handleAddPreScreenOption: (questionId: string) => void;
  handleUpdatePreScreenOption: (questionId: string, optionId: string, label: string) => void;
  handleRemovePreScreenOption: (questionId: string, optionId: string) => void;
  handleAddCustomPreScreenQuestion: () => void;
  draggingInterviewQuestionId: string | null;
  setDraggingInterviewQuestionId: Dispatch<SetStateAction<string | null>>;
  dragOverInterviewQuestionId: string | null;
  setDragOverInterviewQuestionId: Dispatch<SetStateAction<string | null>>;
  activeDragInterviewGroupId: number | null;
  setActiveDragInterviewGroupId: Dispatch<SetStateAction<number | null>>;
  interviewTailHoverGroupId: number | null;
  setInterviewTailHoverGroupId: Dispatch<SetStateAction<number | null>>;
  handleReorderInterviewQuestions: (groupId: number, draggedId: string, targetId: string | null) => void;
  handleInterviewDragStart: (
    event: DragEvent<HTMLButtonElement>,
    questionId: string,
    groupId: number
  ) => void;
  handleInterviewDragEnter: (event: DragEvent<HTMLDivElement>, questionId: string) => void;
  handleInterviewDragOver: (event: DragEvent<HTMLDivElement>, questionId: string) => void;
  handleInterviewDragLeave: (questionId: string) => void;
  handleInterviewDrop: (event: DragEvent<HTMLDivElement>, questionId: string) => void;
  handleInterviewDragEnd: () => void;
  handleInterviewTailDragOver: (event: DragEvent<HTMLDivElement>, groupId: number) => void;
  handleInterviewTailDragLeave: (groupId: number) => void;
  handleInterviewTailDrop: (event: DragEvent<HTMLDivElement>, groupId: number) => void;
  addInterviewQuestionToGroup: (groupId: number, rawQuestion: string) => void;
  updateInterviewQuestionInGroup: (
    groupId: number,
    questionId: string | number,
    rawQuestion: string
  ) => void;
  removeInterviewQuestionFromGroup: (groupId: number, questionId: string | number) => void;
  integrateGeneratedQuestions: (payload: any) => number;
  parseGeneratedQuestionPayload: (raw: unknown, categoryContext?: string | string[]) => any;
  questionModalState: QuestionModalState;
  openQuestionModal: (
    action: QuestionModalAction,
    groupId: number,
    questionToEdit?: { id: string | number; question: string }
  ) => void;
  closeQuestionModal: () => void;
  handleQuestionModalAction: (
    action: QuestionModalAction,
    groupId?: number,
    questionText?: string,
    questionId?: string | number
  ) => void;
}

const useQuestionManagement = ({
  questions,
  setQuestions,
  setOpenPreScreenTypeFor,
}: UseQuestionManagementArgs): UseQuestionManagementResult => {
  const preScreeningGroup = useMemo(
    () => (questions.length > 0 ? questions[0] : undefined),
    [questions]
  );

  const preScreeningQuestions = useMemo(
    () =>
      preScreeningGroup && Array.isArray(preScreeningGroup.questions)
        ? preScreeningGroup.questions.filter((question: any) => isPreScreenQuestion(question))
        : [],
    [preScreeningGroup]
  );

  const interviewQuestionGroups = useMemo(
    () =>
      questions.map((group) => ({
        id: group.id,
        category: group.category,
        interviewQuestions: Array.isArray(group.questions)
          ? group.questions.filter((question: any) => isInterviewQuestion(question))
          : [],
      })),
    [questions]
  );

  const [activeDragQuestionId, setActiveDragQuestionId] = useState<string | null>(null);
  const [draggingQuestionId, setDraggingQuestionId] = useState<string | null>(null);
  const [dragOverQuestionId, setDragOverQuestionId] = useState<string | null>(null);
  const [isDragOverTail, setIsDragOverTail] = useState(false);

  const [draggingInterviewQuestionId, setDraggingInterviewQuestionId] = useState<string | null>(null);
  const [dragOverInterviewQuestionId, setDragOverInterviewQuestionId] = useState<string | null>(null);
  const [activeDragInterviewGroupId, setActiveDragInterviewGroupId] = useState<number | null>(null);
  const [interviewTailHoverGroupId, setInterviewTailHoverGroupId] = useState<number | null>(null);

  const [questionModalState, setQuestionModalState] = useState<QuestionModalState>({
    action: "",
    groupId: null,
    questionToEdit: undefined,
  });

  const handleAddPreScreenQuestion = useCallback(
    (
      questionText: string,
      template?: {
        answerType?: PreScreenQuestionType;
        options?: string[];
        rangeDefaults?: { min?: string; max?: string };
      }
    ) => {
      const trimmed = questionText.trim();
      if (!trimmed) {
        errorToast("Question cannot be empty", 1400);
        return;
      }

      const alreadyExists = preScreeningQuestions.some(
        (item: any) =>
          typeof item?.question === "string" &&
          item.question.trim().toLowerCase() === trimmed.toLowerCase()
      );

      if (alreadyExists) {
        errorToast("Pre-screening question already added", 1400);
        return;
      }

      const answerType: PreScreenQuestionType = template?.answerType ?? "dropdown";

      const baseOptions =
        (answerType === "dropdown" || answerType === "checkboxes") &&
        Array.isArray(template?.options)
          ? template.options.map((label) => ({ id: guid(), label }))
          : [];

      const requiresOptions = answerType === "dropdown" || answerType === "checkboxes";
      const normalizedOptions = baseOptions.length
        ? baseOptions
        : requiresOptions
          ? [{ id: guid(), label: "" }]
          : [];

      const rangeDefaults = template?.rangeDefaults || {};
      const rangeMinDefault =
        answerType === "range" ? (typeof rangeDefaults.min === "string" ? rangeDefaults.min : "") : "";
      const rangeMaxDefault =
        answerType === "range" ? (typeof rangeDefaults.max === "string" ? rangeDefaults.max : "") : "";

      setQuestions((previous) => {
        if (!previous.length) {
          const defaultGroups = createDefaultQuestionGroups();
          defaultGroups[0].questions = [
            {
              id: guid(),
              origin: QUESTION_ORIGIN.PRE_SCREEN,
              question: trimmed,
              answerType,
              options: normalizedOptions,
              rangeMin: rangeMinDefault,
              rangeMax: rangeMaxDefault,
            },
          ];
          return defaultGroups;
        }

        const nextGroups = cloneQuestionGroups(previous);
        const targetGroup = nextGroups[0];
        if (!targetGroup) {
          return previous;
        }

        targetGroup.questions = [
          ...targetGroup.questions,
          {
            id: guid(),
            origin: QUESTION_ORIGIN.PRE_SCREEN,
            question: trimmed,
            answerType,
            options: normalizedOptions,
            rangeMin: rangeMinDefault,
            rangeMax: rangeMaxDefault,
          },
        ];

        return nextGroups;
      });

      candidateActionToast(
        <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>
          Question added
        </span>,
        1400,
        <i className="la la-check-circle" style={{ color: "#039855", fontSize: 24 }}></i>
      );
    },
    [preScreeningQuestions, setQuestions]
  );

  const handleRemovePreScreenQuestion = useCallback(
    (questionId: string) => {
      setOpenPreScreenTypeFor?.((current) => (current === questionId ? null : current));

      setQuestions((previous) => {
        if (!previous.length) {
          return previous;
        }

        const nextGroups = cloneQuestionGroups(previous);
        const targetGroup = nextGroups[0];
        if (!targetGroup) {
          return previous;
        }

        const initialLength = targetGroup.questions.length;
        const filtered = targetGroup.questions.filter((item: any) => {
          if (String(item?.id) !== questionId) {
            return true;
          }
          return !isPreScreenQuestion(item);
        });

        if (filtered.length === initialLength) {
          return previous;
        }

        targetGroup.questions = filtered;
        return nextGroups;
      });
    },
    [setOpenPreScreenTypeFor, setQuestions]
  );

  const handleUpdatePreScreenQuestion = useCallback(
    (
      questionId: string,
      updates: Partial<{ question: string; answerType: PreScreenQuestionType }>
    ) => {
      setQuestions((previous) => {
        if (!previous.length) {
          return previous;
        }

        const nextGroups = cloneQuestionGroups(previous);
        const targetGroup = nextGroups[0];
        if (!targetGroup) {
          return previous;
        }

        const questionIndex = targetGroup.questions.findIndex(
          (item: any) => item?.id === questionId
        );

        if (questionIndex === -1) {
          return previous;
        }

        const currentQuestion = targetGroup.questions[questionIndex];
        if (!isPreScreenQuestion(currentQuestion)) {
          return previous;
        }

        const nextQuestion = {
          ...currentQuestion,
          ...updates,
          origin: QUESTION_ORIGIN.PRE_SCREEN,
        };

        if (updates.answerType) {
          if (updates.answerType === "dropdown" || updates.answerType === "checkboxes") {
            const existingOptions = Array.isArray(currentQuestion?.options)
              ? currentQuestion.options.map((option: any) => ({ ...option }))
              : [];
            nextQuestion.options = existingOptions.length
              ? existingOptions
              : [{ id: guid(), label: "" }];
            nextQuestion.rangeMin = "";
            nextQuestion.rangeMax = "";
          } else if (updates.answerType === "range") {
            nextQuestion.options = [];
            nextQuestion.rangeMin =
              typeof currentQuestion?.rangeMin === "string" ? currentQuestion.rangeMin : "";
            nextQuestion.rangeMax =
              typeof currentQuestion?.rangeMax === "string" ? currentQuestion.rangeMax : "";
          } else {
            nextQuestion.options = [];
            nextQuestion.rangeMin = "";
            nextQuestion.rangeMax = "";
          }
        } else if (!Array.isArray(nextQuestion.options)) {
          nextQuestion.options = [];
        }

        targetGroup.questions[questionIndex] = nextQuestion;
        return nextGroups;
      });
    },
    [setQuestions]
  );

  const handleReorderPreScreenQuestions = useCallback(
    (sourceQuestionId: string, targetQuestionId: string | null) => {
      if (!sourceQuestionId) {
        return;
      }

      setQuestions((previous) => {
        if (!previous.length) {
          return previous;
        }

        const nextGroups = cloneQuestionGroups(previous);
        const targetGroup = nextGroups[0];
        if (!targetGroup || !Array.isArray(targetGroup.questions)) {
          return previous;
        }

        const questionList = targetGroup.questions;
        const sourceIndex = questionList.findIndex((item: any) => item?.id === sourceQuestionId);
        if (sourceIndex === -1) {
          return previous;
        }

        const [movedQuestion] = questionList.splice(sourceIndex, 1);
        if (!movedQuestion) {
          return previous;
        }

        if (!isPreScreenQuestion(movedQuestion)) {
          questionList.splice(sourceIndex, 0, movedQuestion);
          return previous;
        }

        if (targetQuestionId === null) {
          questionList.push(movedQuestion);
          return nextGroups;
        }

        if (targetQuestionId === sourceQuestionId) {
          questionList.splice(sourceIndex, 0, movedQuestion);
          return previous;
        }

        const targetIndexAfterRemoval = questionList.findIndex(
          (item: any) => item?.id === targetQuestionId
        );

        if (targetIndexAfterRemoval === -1) {
          questionList.push(movedQuestion);
          return nextGroups;
        }

        if (sourceIndex > targetIndexAfterRemoval) {
          questionList.splice(targetIndexAfterRemoval, 0, movedQuestion);
        } else {
          questionList.splice(targetIndexAfterRemoval + 1, 0, movedQuestion);
        }

        return nextGroups;
      });
    },
    [setQuestions]
  );

  const handlePreScreenDragStart = useCallback(
    (event: DragEvent<HTMLDivElement>, questionId: string) => {
      if (activeDragQuestionId !== questionId) {
        event.preventDefault();
        return;
      }

      setDraggingQuestionId(questionId);
      setDragOverQuestionId(null);
      setIsDragOverTail(false);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", questionId);
      setActiveDragQuestionId(questionId);
    },
    [activeDragQuestionId]
  );

  const handlePreScreenDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>, targetQuestionId: string) => {
      if (!draggingQuestionId || draggingQuestionId === targetQuestionId) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      if (dragOverQuestionId !== targetQuestionId) {
        setDragOverQuestionId(targetQuestionId);
      }
      if (isDragOverTail) {
        setIsDragOverTail(false);
      }
    },
    [dragOverQuestionId, draggingQuestionId, isDragOverTail]
  );

  const handlePreScreenDrop = useCallback(
    (event: DragEvent<HTMLDivElement>, targetQuestionId: string) => {
      event.preventDefault();
      event.stopPropagation();
      const sourceId = draggingQuestionId || event.dataTransfer.getData("text/plain");
      if (sourceId && sourceId !== targetQuestionId) {
        handleReorderPreScreenQuestions(sourceId, targetQuestionId);
      }
      setDraggingQuestionId(null);
      setDragOverQuestionId(null);
      setActiveDragQuestionId(null);
      setIsDragOverTail(false);
    },
    [draggingQuestionId, handleReorderPreScreenQuestions]
  );

  const handlePreScreenDragLeave = useCallback((targetQuestionId: string) => {
    if (dragOverQuestionId === targetQuestionId) {
      setDragOverQuestionId(null);
    }
  }, [dragOverQuestionId]);

  const handlePreScreenDragEnd = useCallback(() => {
    setDraggingQuestionId(null);
    setDragOverQuestionId(null);
    setActiveDragQuestionId(null);
    setIsDragOverTail(false);
  }, []);

  const handleUpdatePreScreenRange = useCallback(
    (questionId: string, key: "rangeMin" | "rangeMax", value: string) => {
      setQuestions((previous) => {
        if (!previous.length) {
          return previous;
        }

        const nextGroups = cloneQuestionGroups(previous);
        const targetGroup = nextGroups[0];
        if (!targetGroup) {
          return previous;
        }

        const nextQuestion = targetGroup.questions.find((item: any) => item?.id === questionId);
        if (!nextQuestion || !isPreScreenQuestion(nextQuestion) || nextQuestion.answerType !== "range") {
          return previous;
        }

        nextQuestion[key] = value;
        return nextGroups;
      });
    },
    [setQuestions]
  );

  const handleAddPreScreenOption = useCallback(
    (questionId: string) => {
      setQuestions((previous) => {
        if (!previous.length) {
          return previous;
        }

        const nextGroups = cloneQuestionGroups(previous);
        const targetGroup = nextGroups[0];
        if (!targetGroup) {
          return previous;
        }

        const nextQuestion = targetGroup.questions.find(
          (item: any) => item?.id === questionId
        );

        if (
          !nextQuestion ||
          !isPreScreenQuestion(nextQuestion) ||
          (nextQuestion.answerType !== "dropdown" && nextQuestion.answerType !== "checkboxes")
        ) {
          return previous;
        }

        const existingOptions = Array.isArray(nextQuestion.options)
          ? nextQuestion.options
          : [];

        nextQuestion.options = [
          ...existingOptions,
          {
            id: guid(),
            label: `Option ${existingOptions.length + 1}`,
          },
        ];

        return nextGroups;
      });
    },
    [setQuestions]
  );

  const handleUpdatePreScreenOption = useCallback(
    (questionId: string, optionId: string, label: string) => {
      setQuestions((previous) => {
        if (!previous.length) {
          return previous;
        }

        const nextGroups = cloneQuestionGroups(previous);
        const targetGroup = nextGroups[0];
        if (!targetGroup) {
          return previous;
        }

        const nextQuestion = targetGroup.questions.find(
          (item: any) => item?.id === questionId
        );

        if (
          !nextQuestion ||
          !isPreScreenQuestion(nextQuestion) ||
          (nextQuestion.answerType !== "dropdown" && nextQuestion.answerType !== "checkboxes")
        ) {
          return previous;
        }

        nextQuestion.options = Array.isArray(nextQuestion.options)
          ? nextQuestion.options.map((option: any) =>
              option.id === optionId ? { ...option, label } : option
            )
          : [];

        return nextGroups;
      });
    },
    [setQuestions]
  );

  const handleRemovePreScreenOption = useCallback(
    (questionId: string, optionId: string) => {
      setQuestions((previous) => {
        if (!previous.length) {
          return previous;
        }

        const nextGroups = cloneQuestionGroups(previous);
        const targetGroup = nextGroups[0];
        if (!targetGroup) {
          return previous;
        }

        const nextQuestion = targetGroup.questions.find(
          (item: any) => item?.id === questionId
        );

        if (
          !nextQuestion ||
          !isPreScreenQuestion(nextQuestion) ||
          (nextQuestion.answerType !== "dropdown" && nextQuestion.answerType !== "checkboxes")
        ) {
          return previous;
        }

        const existingOptions = Array.isArray(nextQuestion.options)
          ? nextQuestion.options
          : [];

        const filtered = existingOptions.filter((option: any) => option.id !== optionId);
        if (filtered.length === existingOptions.length || filtered.length === 0) {
          return previous;
        }

        nextQuestion.options = filtered;
        return nextGroups;
      });
    },
    [setQuestions]
  );

  const handleAddCustomPreScreenQuestion = useCallback(() => {
    const newQuestionId = guid();

    setQuestions((previous) => {
      if (!previous.length) {
        const defaultGroups = createDefaultQuestionGroups();
        defaultGroups[0].questions = [
          {
            id: newQuestionId,
            origin: QUESTION_ORIGIN.PRE_SCREEN,
            question: "",
            answerType: "short_text",
            options: [],
            rangeMin: "",
            rangeMax: "",
          },
        ];
        return defaultGroups;
      }

      const nextGroups = cloneQuestionGroups(previous);
      const targetGroup = nextGroups[0];
      if (!targetGroup) {
        return previous;
      }

      const currentQuestions = Array.isArray(targetGroup.questions)
        ? targetGroup.questions
        : [];

      targetGroup.questions = [
        ...currentQuestions,
        {
          id: newQuestionId,
          origin: QUESTION_ORIGIN.PRE_SCREEN,
          question: "",
          answerType: "short_text",
          options: [],
          rangeMin: "",
          rangeMax: "",
        },
      ];

      return nextGroups;
    });

    if (typeof document !== "undefined") {
      setTimeout(() => {
        const inputField = document.getElementById(
          `pre-screen-question-${newQuestionId}`
        ) as HTMLInputElement | null;
        if (inputField) {
          inputField.focus();
        }
      }, 80);
    }

    candidateActionToast(
      <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>
        Custom question added
      </span>,
      1400,
      <i className="la la-check-circle" style={{ color: "#039855", fontSize: 24 }}></i>
    );
  }, [setQuestions]);

  const handleReorderInterviewQuestions = useCallback(
    (groupId: number, draggedId: string, targetId: string | null) => {
      setQuestions((prev) => {
        const clone = prev.map((g) => ({
          ...g,
          questions: Array.isArray(g.questions) ? [...g.questions] : [],
        }));
        const group = clone.find((g) => g.id === groupId);
        if (!group || !Array.isArray(group.questions)) return prev;

        const interviewQuestions = group.questions.filter((q: any) => isInterviewQuestion(q));
        const otherQuestions = group.questions.filter((q: any) => !isInterviewQuestion(q));

        const getQuestionId = (q: any, idx: number) => (q?.id ?? `auto-${idx}`);
        const originalOrderIds = interviewQuestions.map((q: any, idx: number) => getQuestionId(q, idx));
        const draggedOriginalIndex = originalOrderIds.indexOf(draggedId);

        if (draggedOriginalIndex === -1) {
          return prev;
        }

        const draggedIndex = interviewQuestions.findIndex((q: any, idx: number) => {
          const id = getQuestionId(q, idx);
          return id === draggedId;
        });
        if (draggedIndex === -1) return prev;
        const [draggedItem] = interviewQuestions.splice(draggedIndex, 1);

        if (targetId) {
          if (targetId === draggedId) {
            interviewQuestions.splice(draggedIndex, 0, draggedItem);
            group.questions = [...interviewQuestions, ...otherQuestions];
            return clone;
          }

          const targetOriginalIndex = originalOrderIds.indexOf(targetId);
          const targetIndex = interviewQuestions.findIndex((q: any, idx: number) => {
            const id = getQuestionId(q, idx);
            return id === targetId;
          });
          if (targetOriginalIndex === -1) {
            interviewQuestions.push(draggedItem);
          } else {
            const adjustedTargetIndex = targetIndex === -1 ? interviewQuestions.length - 1 : targetIndex;
            const isMovingDownward = draggedOriginalIndex < targetOriginalIndex;
            const insertIndex = Math.min(
              interviewQuestions.length,
              isMovingDownward ? adjustedTargetIndex + 1 : Math.max(adjustedTargetIndex, 0)
            );
            interviewQuestions.splice(insertIndex, 0, draggedItem);
          }
        } else {
          interviewQuestions.push(draggedItem);
        }

        group.questions = [...interviewQuestions, ...otherQuestions];
        return clone;
      });
    },
    [setQuestions]
  );

  const handleInterviewDragStart = useCallback(
    (event: DragEvent<HTMLButtonElement>, questionId: string, groupId: number) => {
      event.dataTransfer.effectAllowed = "move";
      setDraggingInterviewQuestionId(questionId);
      setActiveDragInterviewGroupId(groupId);
      setInterviewTailHoverGroupId(null);
    },
    []
  );

  const handleInterviewDragEnter = useCallback(
    (event: DragEvent<HTMLDivElement>, questionId: string) => {
      if (!draggingInterviewQuestionId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      if (questionId !== draggingInterviewQuestionId) {
        setDragOverInterviewQuestionId(questionId);
        setInterviewTailHoverGroupId(null);
      }
    },
    [draggingInterviewQuestionId]
  );

  const handleInterviewDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>, questionId: string) => {
      if (!draggingInterviewQuestionId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      if (questionId !== draggingInterviewQuestionId && dragOverInterviewQuestionId !== questionId) {
        setDragOverInterviewQuestionId(questionId);
        setInterviewTailHoverGroupId(null);
      }
    },
    [dragOverInterviewQuestionId, draggingInterviewQuestionId]
  );

  const handleInterviewDragLeave = useCallback((questionId: string) => {
    if (dragOverInterviewQuestionId === questionId) {
      setDragOverInterviewQuestionId(null);
    }
  }, [dragOverInterviewQuestionId]);

  const handleInterviewDrop = useCallback(
    (event: DragEvent<HTMLDivElement>, questionId: string) => {
      if (!draggingInterviewQuestionId || activeDragInterviewGroupId === null) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      handleReorderInterviewQuestions(activeDragInterviewGroupId, draggingInterviewQuestionId, questionId);
      setDraggingInterviewQuestionId(null);
      setDragOverInterviewQuestionId(null);
      setActiveDragInterviewGroupId(null);
      setInterviewTailHoverGroupId(null);
    },
    [activeDragInterviewGroupId, draggingInterviewQuestionId, handleReorderInterviewQuestions]
  );

  const handleInterviewDragEnd = useCallback(() => {
    setDraggingInterviewQuestionId(null);
    setDragOverInterviewQuestionId(null);
    setActiveDragInterviewGroupId(null);
    setInterviewTailHoverGroupId(null);
  }, []);

  const handleInterviewTailDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>, groupId: number) => {
      if (!draggingInterviewQuestionId || activeDragInterviewGroupId !== groupId) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = "move";

      if (interviewTailHoverGroupId !== groupId) {
        setInterviewTailHoverGroupId(groupId);
      }

      if (dragOverInterviewQuestionId !== null) {
        setDragOverInterviewQuestionId(null);
      }
    },
    [activeDragInterviewGroupId, dragOverInterviewQuestionId, draggingInterviewQuestionId, interviewTailHoverGroupId]
  );

  const handleInterviewTailDragLeave = useCallback((groupId: number) => {
    if (interviewTailHoverGroupId === groupId) {
      setInterviewTailHoverGroupId(null);
    }
  }, [interviewTailHoverGroupId]);

  const handleInterviewTailDrop = useCallback(
    (event: DragEvent<HTMLDivElement>, groupId: number) => {
      if (!draggingInterviewQuestionId || activeDragInterviewGroupId === null) {
        return;
      }

      if (groupId !== activeDragInterviewGroupId) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = "move";

      handleReorderInterviewQuestions(groupId, draggingInterviewQuestionId, null);
      setDraggingInterviewQuestionId(null);
      setDragOverInterviewQuestionId(null);
      setActiveDragInterviewGroupId(null);
      setInterviewTailHoverGroupId(null);
    },
    [activeDragInterviewGroupId, draggingInterviewQuestionId, handleReorderInterviewQuestions]
  );

  const addInterviewQuestionToGroup = useCallback(
    (groupId: number, rawQuestion: string) => {
      const trimmedQuestion = rawQuestion.trim();
      if (!trimmedQuestion) {
        errorToast("Question cannot be empty", 1400);
        return;
      }

      let wasAdded = false;

      setQuestions((previous) => {
        const baseGroups = previous.length
          ? cloneQuestionGroups(previous)
          : normalizeQuestionGroups(createDefaultQuestionGroups());
        const targetIndex = baseGroups.findIndex((group) => group.id === groupId);

        if (targetIndex === -1) {
          return previous.length ? previous : baseGroups;
        }

        const targetGroup = baseGroups[targetIndex];
        const existingQuestions = Array.isArray(targetGroup.questions)
          ? targetGroup.questions
          : [];
        const normalizedNewQuestion = normalizeQuestionText(trimmedQuestion);
        const duplicateExists = existingQuestions.some(
          (item: any) =>
            typeof item?.question === "string" &&
            normalizeQuestionText(item.question) === normalizedNewQuestion
        );

        if (duplicateExists) {
          return previous.length ? previous : baseGroups;
        }

        targetGroup.questions = [
          ...existingQuestions,
          { id: guid(), origin: QUESTION_ORIGIN.INTERVIEW, question: trimmedQuestion },
        ];

        ensureQuestionCountWithinBounds(targetGroup);
        wasAdded = true;
        return baseGroups;
      });

      if (wasAdded) {
        candidateActionToast(
          <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>
            Question added
          </span>,
          1400,
          <i className="la la-check-circle" style={{ color: "#039855", fontSize: 24 }}></i>
        );
      } else {
        errorToast("Question already exists in this category", 1400);
      }
    },
    [setQuestions]
  );

  const updateInterviewQuestionInGroup = useCallback(
    (groupId: number, questionId: string | number, rawQuestion: string) => {
      const trimmedQuestion = rawQuestion.trim();
      if (!trimmedQuestion) {
        errorToast("Question cannot be empty", 1400);
        return;
      }

      const normalizedQuestionId = String(questionId);
      let wasUpdated = false;
      let duplicateDetected = false;

      setQuestions((previous) => {
        if (!previous.length) {
          return previous;
        }

        const nextGroups = cloneQuestionGroups(previous);
        const targetIndex = nextGroups.findIndex((group) => group.id === groupId);
        if (targetIndex === -1) {
          return previous;
        }

        const targetGroup = nextGroups[targetIndex];
        const existingQuestions = Array.isArray(targetGroup.questions)
          ? targetGroup.questions
          : [];
        const normalizedNewQuestion = normalizeQuestionText(trimmedQuestion);

        duplicateDetected = existingQuestions.some(
          (item: any) =>
            typeof item?.question === "string" &&
            normalizeQuestionText(item.question) === normalizedNewQuestion &&
            String(item?.id) !== normalizedQuestionId
        );

        if (duplicateDetected) {
          return previous;
        }

        const questionIndex = existingQuestions.findIndex(
          (item: any) => String(item?.id) === normalizedQuestionId
        );

        if (questionIndex === -1) {
          return previous;
        }

        const targetQuestion = existingQuestions[questionIndex];
        if (!isInterviewQuestion(targetQuestion)) {
          return previous;
        }

        targetGroup.questions[questionIndex] = {
          ...targetQuestion,
          origin: QUESTION_ORIGIN.INTERVIEW,
          question: trimmedQuestion,
        };

        wasUpdated = true;
        return nextGroups;
      });

      if (duplicateDetected) {
        errorToast("Question already exists in this category", 1400);
        return;
      }

      if (wasUpdated) {
        candidateActionToast(
          <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>
            Question updated
          </span>,
          1400,
          <i className="la la-check-circle" style={{ color: "#039855", fontSize: 24 }}></i>
        );
      }
    },
    [setQuestions]
  );

  const removeInterviewQuestionFromGroup = useCallback(
    (groupId: number, questionId: string | number) => {
      let wasRemoved = false;

      setQuestions((previous) => {
        if (!previous.length) {
          return previous;
        }

        const nextGroups = cloneQuestionGroups(previous);
        const targetIndex = nextGroups.findIndex((group) => group.id === groupId);
        if (targetIndex === -1) {
          return previous;
        }

        const targetGroup = nextGroups[targetIndex];
        const existingQuestions = Array.isArray(targetGroup.questions)
          ? targetGroup.questions
          : [];
        const initialLength = existingQuestions.length;

        const filtered = existingQuestions.filter((item: any) => {
          if (!isInterviewQuestion(item)) {
            return true;
          }
          return String(item?.id) !== String(questionId);
        });

        if (filtered.length === initialLength) {
          return previous;
        }

        targetGroup.questions = filtered;
        ensureQuestionCountWithinBounds(targetGroup);
        wasRemoved = true;
        return nextGroups;
      });

      if (wasRemoved) {
        candidateActionToast(
          <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>
            Question deleted
          </span>,
          1400,
          <i className="la la-check-circle" style={{ color: "#039855", fontSize: 24 }}></i>
        );
      }
    },
    [setQuestions]
  );

  const openQuestionModal = useCallback(
    (
      action: QuestionModalAction,
      groupId: number,
      questionToEdit?: { id: string | number; question: string }
    ) => {
      setQuestionModalState({ action, groupId, questionToEdit });
    },
    []
  );

  const closeQuestionModal = useCallback(() => {
    setQuestionModalState({ action: "", groupId: null, questionToEdit: undefined });
  }, []);

  const handleQuestionModalAction = useCallback(
    (
      action: QuestionModalAction,
      groupId?: number,
      questionText?: string,
      questionId?: string | number
    ) => {
      if (!action) {
        closeQuestionModal();
        return;
      }

      const resolvedGroupId = groupId ?? questionModalState.groupId;
      if (!resolvedGroupId) {
        closeQuestionModal();
        return;
      }

      if (action === "add" && typeof questionText === "string") {
        addInterviewQuestionToGroup(resolvedGroupId, questionText);
      } else if (
        action === "edit" &&
        typeof questionText === "string" &&
        typeof questionId !== "undefined"
      ) {
        updateInterviewQuestionInGroup(resolvedGroupId, questionId, questionText);
      } else if (action === "delete" && typeof questionId !== "undefined") {
        removeInterviewQuestionFromGroup(resolvedGroupId, questionId);
      }

      closeQuestionModal();
    },
    [
      addInterviewQuestionToGroup,
      closeQuestionModal,
      questionModalState.groupId,
      removeInterviewQuestionFromGroup,
      updateInterviewQuestionInGroup,
    ]
  );

  const parseGeneratedQuestionPayload = useCallback(
    (raw: unknown, categoryContext?: string | string[]) => {
      if (!raw) {
        throw new Error("Empty response from question generator");
      }

      if (typeof raw === "string") {
        const sanitized = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
        if (!sanitized) {
          throw new Error("Unable to parse generated questions");
        }

        try {
          return JSON.parse(sanitized);
        } catch (error) {
          const extractAndParseJSON = (value: string) => {
            const openingTokens: Array<{ open: string; close: string }> = [
              { open: "[", close: "]" },
              { open: "{", close: "}" },
            ];

            for (const token of openingTokens) {
              const start = value.indexOf(token.open);
              if (start === -1) {
                continue;
              }

              let depth = 0;

              for (let index = start; index < value.length; index += 1) {
                const char = value[index];
                if (char === token.open) {
                  depth += 1;
                } else if (char === token.close) {
                  depth -= 1;
                  if (depth === 0) {
                    const candidate = value.slice(start, index + 1);
                    try {
                      return JSON.parse(candidate);
                    } catch (innerError) {
                      // continue searching
                    }
                  }
                }
              }
            }

            return null;
          };

          const parsed = extractAndParseJSON(sanitized);
          if (parsed) {
            return parsed;
          }

          const fallbackItems = sanitized
            .split(/\r?\n|\u2022|\*/)
            .map((item) => item.replace(/^[\d\-\.\)\s]+/, "").trim())
            .filter((item) => item.length > 0);

          if (fallbackItems.length) {
            if (typeof categoryContext === "string" && categoryContext.trim().length > 0) {
              return [
                {
                  category: categoryContext,
                  questions: fallbackItems,
                },
              ];
            }

            throw new Error("Unable to associate generated questions with a category context");
          }

          throw new Error("Generated questions are not valid JSON");
        }
      }

      return raw;
    },
    []
  );

  const integrateGeneratedQuestions = useCallback(
    (payload: any): number => {
      const baseGroups = questions.length
        ? cloneQuestionGroups(questions)
        : normalizeQuestionGroups(createDefaultQuestionGroups());

      const items = Array.isArray(payload) ? payload : payload ? [payload] : [];
      let addedCount = 0;

      items.forEach((entry) => {
        const categoryName = typeof entry?.category === "string" ? entry.category : "";
        const generatedQuestions = Array.isArray(entry?.questions)
          ? entry.questions
          : entry?.questions && typeof entry.questions === "object"
            ? Object.values(entry.questions)
            : [];

        if (!categoryName || !generatedQuestions.length) {
          return;
        }

        const normalizedCategoryName = normalizeCategoryName(categoryName);
        const targetIndex = baseGroups.findIndex(
          (group) => normalizeCategoryName(group.category) === normalizedCategoryName
        );

        if (targetIndex === -1) {
          console.warn("[SegmentedCareerForm] Generated questions skipped (unknown category)", entry);
          return;
        }

        const targetGroup = baseGroups[targetIndex];
        const existingQuestions = Array.isArray(targetGroup.questions)
          ? targetGroup.questions
          : [];
        const existingLookup = new Set(
          existingQuestions
            .map((item: any) =>
              typeof item?.question === "string" ? normalizeQuestionText(item.question) : ""
            )
            .filter(Boolean)
        );

        const additions = generatedQuestions
          .map((item: unknown) => extractQuestionText(item))
          .filter((item) => item.length > 0)
          .filter((item) => {
            const normalized = normalizeQuestionText(item);
            if (existingLookup.has(normalized)) {
              return false;
            }
            existingLookup.add(normalized);
            return true;
          })
          .map((item) => ({ id: guid(), origin: QUESTION_ORIGIN.INTERVIEW, question: item }));

        if (!additions.length) {
          if (!existingQuestions.length && generatedQuestions.length) {
            console.warn("[SegmentedCareerForm] Generated questions discarded after normalization", {
              categoryName,
              generatedQuestions,
            });
          }
          return;
        }

        targetGroup.questions = [...existingQuestions, ...additions];
        ensureQuestionCountWithinBounds(targetGroup);
        addedCount += additions.length;
      });

      if (addedCount > 0) {
        setQuestions(baseGroups);
      }

      return addedCount;
    },
    [questions, setQuestions]
  );

  return {
    preScreeningQuestions,
    interviewQuestionGroups,
    activeDragQuestionId,
    setActiveDragQuestionId,
    draggingQuestionId,
    setDraggingQuestionId,
    dragOverQuestionId,
    setDragOverQuestionId,
    isDragOverTail,
    setIsDragOverTail,
    handleAddPreScreenQuestion,
    handleRemovePreScreenQuestion,
    handleUpdatePreScreenQuestion,
    handleReorderPreScreenQuestions,
    handlePreScreenDragStart,
    handlePreScreenDragOver,
    handlePreScreenDrop,
    handlePreScreenDragLeave,
    handlePreScreenDragEnd,
    handleUpdatePreScreenRange,
    handleAddPreScreenOption,
    handleUpdatePreScreenOption,
    handleRemovePreScreenOption,
    handleAddCustomPreScreenQuestion,
    draggingInterviewQuestionId,
    setDraggingInterviewQuestionId,
    dragOverInterviewQuestionId,
    setDragOverInterviewQuestionId,
    activeDragInterviewGroupId,
    setActiveDragInterviewGroupId,
    interviewTailHoverGroupId,
    setInterviewTailHoverGroupId,
    handleReorderInterviewQuestions,
    handleInterviewDragStart,
    handleInterviewDragEnter,
    handleInterviewDragOver,
    handleInterviewDragLeave,
    handleInterviewDrop,
    handleInterviewDragEnd,
    handleInterviewTailDragOver,
    handleInterviewTailDragLeave,
    handleInterviewTailDrop,
    addInterviewQuestionToGroup,
    updateInterviewQuestionInGroup,
    removeInterviewQuestionFromGroup,
    integrateGeneratedQuestions,
    parseGeneratedQuestionPayload,
    questionModalState,
    openQuestionModal,
    closeQuestionModal,
    handleQuestionModalAction,
  };
};

export default useQuestionManagement;

