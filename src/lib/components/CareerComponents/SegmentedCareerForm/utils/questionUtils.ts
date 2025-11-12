"use client";

import { guid } from "@/lib/Utils";
import {
  QUESTION_ORIGIN,
  type QuestionOrigin,
} from "../constants";
import {
  createDefaultQuestionGroups,
  type QuestionGroup,
} from "@/lib/hooks/useSegmentedCareerFormState";

export const resolveQuestionOrigin = (question: any): QuestionOrigin => {
  const declaredOrigin = typeof question?.origin === "string" ? question.origin : "";
  if (
    declaredOrigin === QUESTION_ORIGIN.PRE_SCREEN ||
    declaredOrigin === QUESTION_ORIGIN.INTERVIEW
  ) {
    return declaredOrigin;
  }

  if (
    typeof question?.answerType === "string" ||
    Array.isArray(question?.options) ||
    typeof question?.rangeMin === "string" ||
    typeof question?.rangeMax === "string"
  ) {
    return QUESTION_ORIGIN.PRE_SCREEN;
  }

  return QUESTION_ORIGIN.INTERVIEW;
};

export const normalizeQuestionEntry = (question: any) => {
  const origin = resolveQuestionOrigin(question);
  const questionId =
    question && question.id !== undefined && question.id !== null && question.id !== ""
      ? question.id
      : guid();

  const normalized: any = {
    ...question,
    id: questionId,
    origin,
  };

  if (origin === QUESTION_ORIGIN.PRE_SCREEN) {
    normalized.answerType =
      typeof question?.answerType === "string" ? question.answerType : "short_text";
    normalized.options = Array.isArray(question?.options)
      ? question.options.map((option: any) => ({ ...option }))
      : [];
    normalized.rangeMin = typeof question?.rangeMin === "string" ? question.rangeMin : "";
    normalized.rangeMax = typeof question?.rangeMax === "string" ? question.rangeMax : "";
  } else {
    if (Array.isArray(question?.options) && question.options.length) {
      normalized.options = question.options.map((option: any) => ({ ...option }));
    } else {
      delete normalized.options;
    }
    delete normalized.answerType;
    delete normalized.rangeMin;
    delete normalized.rangeMax;
  }

  if (typeof normalized.question !== "string" || normalized.question.trim().length === 0) {
    if (typeof question?.text === "string") {
      normalized.question = question.text;
    } else if (typeof question?.prompt === "string") {
      normalized.question = question.prompt;
    }
  }

  return normalized;
};

export const normalizeQuestionGroups = (groups?: QuestionGroup[]): QuestionGroup[] => {
  const sourceGroups =
    Array.isArray(groups) && groups.length ? groups : createDefaultQuestionGroups();

  return sourceGroups.map((group) => ({
    ...group,
    questions: Array.isArray(group.questions)
      ? group.questions.map((question: any) => normalizeQuestionEntry(question))
      : [],
  }));
};

export const isPreScreenQuestion = (question: any) =>
  resolveQuestionOrigin(question) === QUESTION_ORIGIN.PRE_SCREEN;

export const isInterviewQuestion = (question: any) =>
  resolveQuestionOrigin(question) === QUESTION_ORIGIN.INTERVIEW;

export const cloneQuestionGroups = (groups: QuestionGroup[]): QuestionGroup[] =>
  groups.map((group) => ({
    ...group,
    questions: Array.isArray(group.questions)
      ? group.questions.map((question: any) => normalizeQuestionEntry(question))
      : [],
  }));

export const normalizeQuestionText = (value: string) => value.trim().toLowerCase();

export const normalizeCategoryName = (value: string) =>
  value
    .toLowerCase()
    .replace(/\s*\/\s*/g, " / ")
    .replace(/\s+/g, " ")
    .trim();

export const extractQuestionText = (entry: unknown): string => {
  if (typeof entry === "string") {
    return entry.trim();
  }

  if (entry && typeof entry === "object") {
    const candidate = entry as Record<string, unknown>;

    if (typeof candidate.question === "string") {
      return candidate.question.trim();
    }

    if (typeof candidate.text === "string") {
      return candidate.text.trim();
    }

    if (typeof candidate.prompt === "string") {
      return candidate.prompt.trim();
    }

    const stringValue = Object.values(candidate).find((value) => typeof value === "string");
    if (typeof stringValue === "string") {
      return stringValue.trim();
    }
  }

  return "";
};

export const ensureQuestionCountWithinBounds = (group: QuestionGroup) => {
  if (typeof group.questionCountToAsk !== "number") {
    return;
  }

  const interviewCount = Array.isArray(group.questions)
    ? group.questions.filter((question: any) => isInterviewQuestion(question)).length
    : 0;

  if (group.questionCountToAsk > interviewCount) {
    group.questionCountToAsk = interviewCount;
  }
};

