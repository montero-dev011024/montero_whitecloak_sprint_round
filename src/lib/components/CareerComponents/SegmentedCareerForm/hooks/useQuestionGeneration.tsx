"use client";

import { useCallback, useMemo, useState } from "react";
import axios from "axios";

import {
  candidateActionToast,
  errorToast,
  interviewQuestionCategoryMap,
} from "@/lib/Utils";
import type { QuestionGroup } from "@/lib/hooks/useSegmentedCareerFormState";

import { INTERVIEW_QUESTION_COUNT } from "../constants";
import { isInterviewQuestion } from "../utils/questionUtils";

interface UseQuestionGenerationArgs {
  draft: any;
  questions: QuestionGroup[];
  questionGenPrompt: string;
  integrateGeneratedQuestions: (payload: any) => number;
  parseGeneratedQuestionPayload: (raw: unknown, categoryContext?: string | string[]) => any;
}

interface UseQuestionGenerationResult {
  pendingQuestionGeneration: string | null;
  isGeneratingQuestions: boolean;
  handleGenerateAllInterviewQuestions: () => Promise<void>;
  handleGenerateQuestionsForCategory: (categoryName: string) => Promise<void>;
}

const useQuestionGeneration = ({
  draft,
  questions,
  questionGenPrompt,
  integrateGeneratedQuestions,
  parseGeneratedQuestionPayload,
}: UseQuestionGenerationArgs): UseQuestionGenerationResult => {
  const [pendingQuestionGeneration, setPendingQuestionGeneration] = useState<string | null>(null);

  const isGeneratingQuestions = useMemo(
    () => pendingQuestionGeneration !== null,
    [pendingQuestionGeneration]
  );

  const ensureJobDetailsForGeneration = useCallback(() => {
    const jobTitle = (draft?.jobTitle ?? "").trim();
    const plainDescription = (draft?.description ?? "").replace(/<[^>]+>/g, " ").trim();

    if (!jobTitle || !plainDescription) {
      errorToast("Please complete the job title and description first", 1500);
      return null;
    }

    return { jobTitle, plainDescription };
  }, [draft?.description, draft?.jobTitle]);

  const buildExistingQuestionList = useCallback(
    () =>
      questions
        .map((group) => {
          const groupQuestions = Array.isArray(group.questions)
            ? group.questions.filter((question: any) => isInterviewQuestion(question))
            : [];

          if (!groupQuestions.length) {
            return "";
          }

          return groupQuestions
            .map(
              (question: any, index: number) => `          ${index + 1}. ${question.question}`
            )
            .join("\n");
        })
        .filter(Boolean)
        .join("\n"),
    [questions]
  );

  const handleGenerateAllInterviewQuestions = useCallback(async () => {
    if (pendingQuestionGeneration) {
      return;
    }

    const jobDetails = ensureJobDetailsForGeneration();
    if (!jobDetails) {
      return;
    }

    const categories = Object.keys(interviewQuestionCategoryMap);
    const totalExisting = questions.reduce(
      (acc, group) =>
        acc +
        (Array.isArray(group.questions)
          ? group.questions.filter((question: any) => isInterviewQuestion(question)).length
          : 0),
      0
    );

    const promptSegments = [
      `Generate ${INTERVIEW_QUESTION_COUNT * categories.length} interview questions for the following Job opening:`,
      "Job Title:",
      jobDetails.jobTitle,
      "Job Description:",
      jobDetails.plainDescription,
      categories
        .map((category) => {
          const categoryDetails = interviewQuestionCategoryMap[
            category as keyof typeof interviewQuestionCategoryMap
          ];
          return `Category:\n${category}\nCategory Description:\n${categoryDetails?.description ?? ""}`;
        })
        .join("\n\n"),
      categories.map((category) => `${INTERVIEW_QUESTION_COUNT} questions for ${category}`).join(", "),
    ];

    if (totalExisting > 0) {
      promptSegments.push(
        `Do not generate questions that are already covered in this list:\n${buildExistingQuestionList()}`
      );
    }

    if (questionGenPrompt) {
      promptSegments.push(questionGenPrompt);
    }

    promptSegments.push(
      "Respond ONLY with valid JSON.",
      "Use this exact JSON schema:",
      '[{"category":"<category name>","questions":["Question 1","Question 2","Question 3","Question 4","Question 5"]}]',
      "The JSON array must contain one object per interview category listed above, using the same category names.",
      "Each object must list exactly the generated questions in the questions array.",
      `Each questions array must contain exactly ${INTERVIEW_QUESTION_COUNT} items.`,
      "Do not include any explanations, markdown fences, or surrounding text."
    );

    setPendingQuestionGeneration("all");

    try {
      const response = await axios.post("/api/llm-engine", {
        systemPrompt:
          "You are a helpful assistant that can answer questions and help with tasks.",
        prompt: promptSegments.join("\n\n"),
      });

      const parsed = parseGeneratedQuestionPayload(
        response?.data?.result ?? response?.data,
        categories
      );

      const addedCount = Number(integrateGeneratedQuestions(parsed));

      if (addedCount > 0) {
        candidateActionToast(
          <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27", marginLeft: 8 }}>
            {`Generated ${addedCount} new question${addedCount === 1 ? "" : "s"}`}
          </span>,
          1500,
          <i className="la la-check-circle" style={{ color: "#039855", fontSize: 32 }}></i>
        );
      } else {
        errorToast("No new questions generated", 1500);
      }
    } catch (error) {
      console.error("[SegmentedCareerForm] Failed to generate interview questions", error);
      errorToast("Error generating questions, please try again", 1500);
    } finally {
      setPendingQuestionGeneration(null);
    }
  }, [
    buildExistingQuestionList,
    ensureJobDetailsForGeneration,
    integrateGeneratedQuestions,
    parseGeneratedQuestionPayload,
    pendingQuestionGeneration,
    questionGenPrompt,
    questions,
  ]);

  const handleGenerateQuestionsForCategory = useCallback(
    async (categoryName: string) => {
      if (pendingQuestionGeneration) {
        return;
      }

      const jobDetails = ensureJobDetailsForGeneration();
      if (!jobDetails) {
        return;
      }

      const categoryDefinition = interviewQuestionCategoryMap[
        categoryName as keyof typeof interviewQuestionCategoryMap
      ];
      if (!categoryDefinition) {
        errorToast("Unknown interview category", 1500);
        return;
      }

      const promptSegments = [
        `Generate ${INTERVIEW_QUESTION_COUNT} interview questions for the following Job opening:`,
        "Job Title:",
        jobDetails.jobTitle,
        "Job Description:",
        jobDetails.plainDescription,
        "Interview Category:",
        categoryName,
        "Interview Category Description:",
        categoryDefinition.description,
        `The ${INTERVIEW_QUESTION_COUNT} interview questions should be related to the job description and follow the scope of the interview category.`,
      ];

      const totalExisting = questions.reduce(
        (acc, group) =>
          acc +
          (Array.isArray(group.questions)
            ? group.questions.filter((question: any) => isInterviewQuestion(question)).length
            : 0),
        0
      );

      if (totalExisting > 0) {
        promptSegments.push(
          `Do not generate questions that are already covered in this list:\n${buildExistingQuestionList()}`
        );
      }

      if (questionGenPrompt) {
        promptSegments.push(questionGenPrompt);
      }

      promptSegments.push(
        "Respond ONLY with valid JSON.",
        "Return an array containing a single object with this exact structure:",
        `[{"category":"${categoryName}","questions":["Question 1","Question 2","Question 3","Question 4","Question 5"]}]`,
        "Use the category value provided above verbatim.",
        `Provide exactly ${INTERVIEW_QUESTION_COUNT} questions in the questions array.`,
        "Do not include any explanations, markdown fences, or extra text."
      );

      setPendingQuestionGeneration(categoryName);

      try {
        const response = await axios.post("/api/llm-engine", {
          systemPrompt:
            "You are a helpful assistant that can answer questions and help with tasks.",
          prompt: promptSegments.join("\n\n"),
        });

        const parsed = parseGeneratedQuestionPayload(
          response?.data?.result ?? response?.data,
          categoryName
        );

        const addedCount = Number(integrateGeneratedQuestions(parsed));

        if (addedCount > 0) {
          candidateActionToast(
            <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27", marginLeft: 8 }}>
              {`Generated ${addedCount} ${categoryName} question${addedCount === 1 ? "" : "s"}`}
            </span>,
            1500,
            <i className="la la-check-circle" style={{ color: "#039855", fontSize: 32 }}></i>
          );
        } else {
          errorToast("No new questions generated", 1500);
        }
      } catch (error) {
        console.error(
          `[SegmentedCareerForm] Failed to generate interview questions for ${categoryName}`,
          error
        );
        errorToast("Error generating questions, please try again", 1500);
      } finally {
        setPendingQuestionGeneration(null);
      }
    },
    [
      buildExistingQuestionList,
      ensureJobDetailsForGeneration,
      integrateGeneratedQuestions,
      parseGeneratedQuestionPayload,
      pendingQuestionGeneration,
      questionGenPrompt,
      questions,
    ]
  );

  return {
    pendingQuestionGeneration,
    isGeneratingQuestions,
    handleGenerateAllInterviewQuestions,
    handleGenerateQuestionsForCategory,
  };
};

export default useQuestionGeneration;

