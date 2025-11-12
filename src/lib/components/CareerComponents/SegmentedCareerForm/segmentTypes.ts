export type ReviewSectionKey = "career" | "cv" | "ai";

export type QuestionModalAction = "" | "add" | "edit" | "delete";

export interface QuestionModalState {
  action: QuestionModalAction;
  groupId: number | null;
  questionToEdit?: { id: string | number; question: string };
}
