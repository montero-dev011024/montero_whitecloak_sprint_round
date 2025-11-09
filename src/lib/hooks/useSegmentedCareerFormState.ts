import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage";

export type SegmentedCareerStep =
  | "career-details"
  | "cv-screening"
  | "ai-setup"
  | "pipeline"
  | "review";

export interface QuestionGroup {
  id: number;
  category: string;
  questionCountToAsk: number | null;
  questions: any[];
}

export interface CareerTeamMember {
  memberId: string;
  name: string;
  email: string;
  image?: string;
  role: string;
}

export interface CareerFormDraft {
  jobTitle: string;
  description: string;
  screeningSetting: string;
  employmentType: string;
  workSetup: string;
  workSetupRemarks: string;
  requireVideo: boolean;
  salary: {
    isNegotiable: boolean;
    minimum: string;
    maximum: string;
    currency: string;
  };
  location: {
    country: string;
    province: string;
    city: string;
  };
  questions: QuestionGroup[];
  team: {
    members: CareerTeamMember[];
  };
  status: string;
  context: {
    orgID?: string;
    lastPersistedBy?: string;
    lastPersistedAt?: string;
  };
}

export interface PersistContext {
  orgID?: string;
  userEmail?: string;
}

export const segmentedSteps: Array<{
  id: SegmentedCareerStep;
  title: string;
  subtitle: string;
}> = [
  {
    id: "career-details",
    title: "Career Details & Team Access",
    subtitle: "Step 1",
  },
  {
    id: "cv-screening",
    title: "CV Review & Pre-screening",
    subtitle: "Step 2",
  },
  {
    id: "ai-setup",
    title: "AI Interview Setup",
    subtitle: "Step 3",
  },
  {
    id: "pipeline",
    title: "Pipeline Stages",
    subtitle: "Step 4",
  },
  {
    id: "review",
    title: "Review Career",
    subtitle: "Step 5",
  },
];

const DRAFT_STORAGE_KEY = "jia-segmented-career-draft";
const STEP_STORAGE_KEY = "jia-segmented-career-step";

export const createDefaultQuestionGroups = (): QuestionGroup[] => [
  {
    id: 1,
    category: "CV Validation / Experience",
    questionCountToAsk: null,
    questions: [],
  },
  {
    id: 2,
    category: "Technical",
    questionCountToAsk: null,
    questions: [],
  },
  {
    id: 3,
    category: "Behavioral",
    questionCountToAsk: null,
    questions: [],
  },
  {
    id: 4,
    category: "Analytical",
    questionCountToAsk: null,
    questions: [],
  },
  {
    id: 5,
    category: "Others",
    questionCountToAsk: null,
    questions: [],
  },
];

export const defaultCareerDraft: CareerFormDraft = {
  jobTitle: "",
  description: "",
  screeningSetting: "Good Fit and above",
  employmentType: "",
  workSetup: "",
  workSetupRemarks: "",
  requireVideo: true,
  salary: {
    isNegotiable: true,
    minimum: "",
    maximum: "",
    currency: "PHP",
  },
  location: {
    country: "Philippines",
    province: "",
    city: "",
  },
  questions: createDefaultQuestionGroups(),
  team: {
    members: [],
  },
  status: "draft",
  context: {},
};

const mergeDraft = (
  previous: CareerFormDraft,
  update: Partial<CareerFormDraft>
): CareerFormDraft => {
  const next: CareerFormDraft = {
    ...previous,
    ...update,
    salary: update.salary
      ? { ...previous.salary, ...update.salary }
      : previous.salary,
    location: update.location
      ? { ...previous.location, ...update.location }
      : previous.location,
    team: update.team
      ? {
          members:
            update.team.members !== undefined
              ? update.team.members
              : previous.team.members,
        }
      : previous.team,
    questions: update.questions ?? previous.questions,
    context: update.context ?? previous.context,
  };

  return next;
};

export default function useSegmentedCareerFormState() {
  const [draft, setDraft] = useLocalStorage<CareerFormDraft>(
    DRAFT_STORAGE_KEY,
    defaultCareerDraft
  );
  const [activeStep, setStoredStep] = useLocalStorage<SegmentedCareerStep>(
    STEP_STORAGE_KEY,
    "career-details"
  );

  const setActiveStep = useCallback(
    (step: SegmentedCareerStep) => {
      setStoredStep(step);
    },
    [setStoredStep]
  );

  const updateDraft = useCallback(
    (update: Partial<CareerFormDraft>) => {
      setDraft((previous) => mergeDraft(previous, update));
    },
    [setDraft]
  );

  const resetDraft = useCallback(() => {
    setDraft(defaultCareerDraft);
    setStoredStep("career-details");
  }, [setDraft, setStoredStep]);

  const hydrateFromCareer = useCallback(
    ({
      career,
      questions,
    }: {
      career: any;
      questions?: QuestionGroup[];
    }) => {
      if (!career) {
        return;
      }

      const hydrated: CareerFormDraft = {
        jobTitle: career.jobTitle || "",
        description: career.description || "",
        screeningSetting: career.screeningSetting || "Good Fit and above",
        employmentType: career.employmentType || "",
        workSetup: career.workSetup || "",
        workSetupRemarks: career.workSetupRemarks || "",
        requireVideo:
          typeof career.requireVideo === "boolean" ? career.requireVideo : true,
        salary: {
          isNegotiable:
            typeof career.salaryNegotiable === "boolean"
              ? career.salaryNegotiable
              : true,
          minimum:
            typeof career.minimumSalary === "number" && !isNaN(career.minimumSalary)
              ? String(career.minimumSalary)
              : "",
          maximum:
            typeof career.maximumSalary === "number" && !isNaN(career.maximumSalary)
              ? String(career.maximumSalary)
              : "",
          currency:
            typeof career.salaryCurrency === "string" && career.salaryCurrency.trim().length > 0
              ? career.salaryCurrency.trim().toUpperCase()
              : typeof career.currency === "string" && career.currency.trim().length > 0
                ? career.currency.trim().toUpperCase()
                : "PHP",
        },
        location: {
          country: career.country || "Philippines",
          province: career.province || "",
          city: career.location || "",
        },
        questions:
          questions && questions.length > 0
            ? questions
            : createDefaultQuestionGroups(),
        team: {
          members:
            (career.teamMembers && Array.isArray(career.teamMembers)
              ? career.teamMembers
              : career.team?.members) || [],
        },
        status: career.status || "draft",
        context: {
          orgID: career.orgID,
          lastPersistedBy: career.lastEditedBy?.email,
          lastPersistedAt: new Date().toISOString(),
        },
      };

      setDraft(hydrated);
      setStoredStep("career-details");
    },
    [setDraft, setStoredStep]
  );

  const loadPersistedDraft = useCallback(
    (context?: PersistContext) => {
      if (!context || !context.orgID) {
        return;
      }

      setDraft((previous) => {
        if (!previous.context?.orgID) {
          return previous;
        }

        if (previous.context.orgID === context.orgID) {
          return previous;
        }

        return defaultCareerDraft;
      });
    },
    [setDraft]
  );

  const persistDraft = useCallback(
    (update: Partial<CareerFormDraft>, context?: PersistContext) => {
      setDraft((previous) => {
        const merged = mergeDraft(previous, update);
        const nextContext = {
          ...merged.context,
          ...(context?.orgID ? { orgID: context.orgID } : {}),
          ...(context?.userEmail
            ? { lastPersistedBy: context.userEmail }
            : {}),
          lastPersistedAt: new Date().toISOString(),
        };

        return {
          ...merged,
          context: nextContext,
        };
      });
    },
    [setDraft]
  );

  return {
    activeStep,
    setActiveStep,
    draft,
    updateDraft,
    hydrateFromCareer,
    resetDraft,
    loadPersistedDraft,
    persistDraft,
  };
}
