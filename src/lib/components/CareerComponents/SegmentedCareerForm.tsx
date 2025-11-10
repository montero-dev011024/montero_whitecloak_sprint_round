"use client";

import {
  CSSProperties,
  DragEvent,
  MutableRefObject,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import classNames from "classnames";
import axios from "axios";
import dynamic from "next/dynamic";
import styles from "@/lib/styles/segmentedCareerForm.module.scss";
import { candidateActionToast, errorToast, guid } from "@/lib/Utils";
import { useAppContext } from "@/lib/context/AppContext";
import CustomDropdown from "@/lib/components/CareerComponents/CustomDropdown";
import locations from "../../../../public/philippines-locations.json";
import CareerActionModal from "@/lib/components/CareerComponents/CareerActionModal";
import FullScreenLoadingAnimation from "@/lib/components/CareerComponents/FullScreenLoadingAnimation";
import useSegmentedFormState, {
  SegmentedCareerStep,
  segmentedSteps,
  createDefaultQuestionGroups,
  QuestionGroup,
} from "@/lib/hooks/useSegmentedCareerFormState";
type PreScreenQuestionType = "dropdown" | "short_text" | "long_text" | "checkboxes" | "range";

interface SuggestedPreScreenQuestion {
  label: string;
  prompt: string;
  answerType?: PreScreenQuestionType;
  defaultOptions?: string[];
  rangeDefaults?: {
    min?: string;
    max?: string;
  };
}

const SUGGESTED_PRE_SCREENING_QUESTIONS: SuggestedPreScreenQuestion[] = [
  {
    label: "Notice Period",
    prompt: "How long is your notice period?",
    answerType: "dropdown",
    defaultOptions: ["Immediately", "< 30 days", "> 30 days"],
  },
  {
    label: "Work Setup",
    prompt: "How often are you willing to report to the office each week?",
    answerType: "dropdown",
    defaultOptions: ["Fully remote", "1-2 days", "3+ days"],
  },
  {
    label: "Asking Salary",
    prompt: "How much is your expected monthly salary?",
    answerType: "range",
  },
];

const PRE_SCREEN_TYPE_OPTIONS: Array<{
  value: PreScreenQuestionType;
  label: string;
  icon: string;
}> = [
  { value: "short_text", label: "Short Answer", icon: "la la-user" },
  { value: "long_text", label: "Long Answer", icon: "la la-align-left" },
  { value: "dropdown", label: "Dropdown", icon: "la la-list" },
  { value: "checkboxes", label: "Checkboxes", icon: "la la-check-square" },
  { value: "range", label: "Range", icon: "la la-sliders-h" },
];

const cloneQuestionGroups = (groups: QuestionGroup[]): QuestionGroup[] =>
  groups.map((group) => ({
    ...group,
    questions: Array.isArray(group.questions)
      ? group.questions.map((question: any) => ({
          ...question,
          options: Array.isArray(question?.options)
            ? question.options.map((option: any) => ({ ...option }))
            : [],
        }))
      : [],
  }));

const RichTextEditor = dynamic(
  () => import("@/lib/components/CareerComponents/RichTextEditor"),
  { ssr: false }
);

const SCREENING_SETTING_OPTIONS = [
  { name: "Good Fit and above", icon: "la la-check" },
  { name: "Only Strong Fit", icon: "la la-check-double" },
  { name: "No Automatic Promotion", icon: "la la-times" },
];

const WORK_SETUP_OPTIONS = [
  { name: "Fully Remote" },
  { name: "Onsite" },
  { name: "Hybrid" },
];

const EMPLOYMENT_TYPE_OPTIONS = [
  { name: "Full-Time" },
  { name: "Part-Time" },
  { name: "Contract" },
  { name: "Internship" },
];

const CURRENCY_OPTIONS = [
  "PHP",
  "USD",
  "EUR",
  "GBP",
  "AUD",
  "SGD",
  "JPY",
] as const;

type CurrencyCode = (typeof CURRENCY_OPTIONS)[number];

const CURRENCY_SYMBOLS: Record<string, string> = {
  PHP: "₱",
  USD: "$",
  EUR: "€",
  GBP: "£",
  AUD: "A$",
  SGD: "S$",
  JPY: "¥",
};

const CURRENCY_DROPDOWN_IDS = {
  minimum: "salary-currency-minimum-menu",
  maximum: "salary-currency-maximum-menu",
} as const;

const MEMBER_ROLE_OPTIONS = [
  { value: "job_owner", label: "Job Owner" },
  { value: "collaborator", label: "Collaborator" },
  { value: "viewer", label: "Viewer" },
];

interface SegmentedCareerFormProps {
  formType: "add" | "edit";
  career?: any;
  setShowEditModal?: (show: boolean) => void;
}

interface MemberRecord {
  _id: string;
  name?: string;
  email: string;
  image?: string;
  role?: string;
}

const isDescriptionPresent = (value?: string) => {
  if (!value) return false;
  const plain = value.replace(/<[^>]+>/g, "").trim();
  return plain.length > 0;
};

const formatTimestamp = (value?: string | number | Date) => {
  if (!value) return "Not saved yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not saved yet";
  }
  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export default function SegmentedCareerForm({
  career,
  formType,
  setShowEditModal,
}: SegmentedCareerFormProps) {
  const { user, orgID } = useAppContext();
  const {
    activeStep,
    setActiveStep,
    draft,
    updateDraft,
    hydrateFromCareer,
    resetDraft,
    loadPersistedDraft,
    persistDraft,
  } = useSegmentedFormState();
  const [questions, setQuestions] = useState<QuestionGroup[]>(() =>
    career?.questions && career.questions.length
      ? career.questions
      : createDefaultQuestionGroups()
  );
  const preScreeningGroup = useMemo(
    () => (questions.length > 0 ? questions[0] : undefined),
    [questions]
  );
  const preScreeningQuestions = useMemo(
    () =>
      preScreeningGroup && Array.isArray(preScreeningGroup.questions)
        ? preScreeningGroup.questions
        : [],
    [preScreeningGroup]
  );
  const [provinceList, setProvinceList] = useState<Array<any>>([]);
  const [cityList, setCityList] = useState<Array<any>>([]);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
    // Track which member's role menu is open (for custom role dropdown UI)
  const [openRoleMenuFor, setOpenRoleMenuFor] = useState<string | null>(null);
  const [isMemberPickerOpen, setIsMemberPickerOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [openCurrencyDropdown, setOpenCurrencyDropdown] = useState<"minimum" | "maximum" | null>(null);
  const minimumCurrencyDropdownRef = useRef<HTMLDivElement | null>(null);
  const maximumCurrencyDropdownRef = useRef<HTMLDivElement | null>(null);
  const [openPreScreenTypeFor, setOpenPreScreenTypeFor] = useState<string | null>(null);
  const [activeDragQuestionId, setActiveDragQuestionId] = useState<string | null>(null);
  const [draggingQuestionId, setDraggingQuestionId] = useState<string | null>(null);
  const [dragOverQuestionId, setDragOverQuestionId] = useState<string | null>(null);
  const [isDragOverTail, setIsDragOverTail] = useState(false);

    // Close the role menu on outside click
    useEffect(() => {
      if (!openRoleMenuFor) return;
      const handler = (e: MouseEvent) => {
        const menu = document.getElementById(`role-menu-${openRoleMenuFor}`);
        const btn = document.getElementById(`role-button-${openRoleMenuFor}`);
        if (menu && btn) {
          if (!menu.contains(e.target as Node) && !btn.contains(e.target as Node)) {
            setOpenRoleMenuFor(null);
          }
        } else {
          setOpenRoleMenuFor(null);
        }
      };
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, [openRoleMenuFor]);

    // Close member picker on outside click
    useEffect(() => {
      if (!isMemberPickerOpen) return;
      const handler = (e: MouseEvent) => {
        const panel = document.getElementById("member-picker-panel");
        const btn = document.getElementById("member-picker-button");
        if (panel && btn) {
          if (!panel.contains(e.target as Node) && !btn.contains(e.target as Node)) {
            setIsMemberPickerOpen(false);
            setMemberSearch("");
          }
        } else {
          setIsMemberPickerOpen(false);
          setMemberSearch("");
        }
      };
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, [isMemberPickerOpen]);

    // Close pre-screen response type menus on outside click or escape
    useEffect(() => {
      if (!openPreScreenTypeFor) {
        return;
      }

      const handleClickOutside = (event: MouseEvent) => {
        const menu = document.getElementById(`pre-screen-type-menu-${openPreScreenTypeFor}`);
        const trigger = document.getElementById(`pre-screen-type-trigger-${openPreScreenTypeFor}`);
        if (menu && trigger) {
          const target = event.target as Node;
          if (!menu.contains(target) && !trigger.contains(target)) {
            setOpenPreScreenTypeFor(null);
          }
        } else {
          setOpenPreScreenTypeFor(null);
        }
      };

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          setOpenPreScreenTypeFor(null);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);

      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }, [openPreScreenTypeFor]);

  useEffect(() => {
    if (!openCurrencyDropdown) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const minimumRef = minimumCurrencyDropdownRef.current;
      const maximumRef = maximumCurrencyDropdownRef.current;

      const clickedInsideMinimum = minimumRef?.contains(target);
      const clickedInsideMaximum = maximumRef?.contains(target);

      if (clickedInsideMinimum || clickedInsideMaximum) {
        return;
      }

      setOpenCurrencyDropdown(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenCurrencyDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [openCurrencyDropdown]);

    // Rich descriptions for the role picker menu UI
    const ROLE_DESCRIPTIONS: Record<string, string> = {
      "Job Owner":
        "Leads the hiring process for assigned jobs. Has access with all career settings.",
      Collaborator:
        "Helps evaluate candidates and assist with hiring tasks. Can move candidates through the pipeline, but cannot change any career settings.",
      Viewer:
        "Reviews candidates and provides feedback. Can only view candidate profiles and comment.",
      // Also support alternate labels seen in design references
      Contributor:
        "Helps evaluate candidates and assist with hiring tasks. Can move candidates through the pipeline, but cannot change any career settings.",
      Reviewer:
        "Reviews candidates and provides feedback. Can only view candidate profiles and comment.",
    };
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [selectedMemberRole, setSelectedMemberRole] = useState<string>(
    MEMBER_ROLE_OPTIONS[0].value
  );
  const [showSaveModal, setShowSaveModal] = useState<string>("");
  const [isSavingCareer, setIsSavingCareer] = useState(false);
  const savingCareerRef = useRef(false);
  const baseTipsId = useId();
  const tipsBulbGradientId = `${baseTipsId}-bulb-gradient`;
  const tipsStarGradientId = `${baseTipsId}-star-gradient`;
  const tipsContent = useMemo(() => {
    if (activeStep === "cv-screening") {
      return [
        {
          heading: "Add a Secret Prompt",
          body: "to fine-tune how Jia scores and evaluates submitted CVs.",
        },
        {
          heading: "Add Pre-Screening questions",
          body: "to collect key details such as notice period, work setup, or salary expectations to guide your review and candidate discussions.",
        },
      ];
    }

    return [
      {
        heading: "Use clear, standard job titles",
        body:
          "for better searchability (e.g., “Software Engineer” instead of “Code Ninja” or “Tech Rockstar”).",
      },
      {
        heading: "Avoid abbreviations",
        body:
          "or internal role codes that applicants may not understand (e.g., use “QA Engineer” instead of “QE II” or “QA-TL”).",
      },
      {
        heading: "Keep it concise",
        body:
          "— job titles should be no more than a few words (2—4 max), avoiding fluff or marketing terms.",
      },
    ];
  }, [activeStep]);
  // Validation display toggles
  const [showCareerDetailsErrors, setShowCareerDetailsErrors] = useState(false);
  const teamMembers = useMemo(
    () => draft.team?.members || [],
    [draft.team?.members]
  );
  const hasJobOwner = useMemo(
    () => teamMembers.some((member: any) => member.role === 'job_owner'),
    [teamMembers]
  );
  const availableMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    const taken = new Set(
      teamMembers.map((member: any) => member.memberId)
    );

    return members.filter((member) => {
      if (!member?._id) {
        return false;
      }
      if (taken.has(member._id)) {
        return false;
      }

      if (!query) {
        return true;
      }

      const name = (member.name || "").toLowerCase();
      const email = (member.email || "").toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }, [members, teamMembers, memberSearch]);

  const selectedCurrency = useMemo(() => {
    const currency = draft.salary?.currency;
    if (currency && currency.trim().length > 0) {
      return currency;
    }
    return "PHP";
  }, [draft.salary?.currency]);

  const currencySymbol = useMemo(() => {
    return CURRENCY_SYMBOLS[selectedCurrency] || "";
  }, [selectedCurrency]);

  const currencyPrefixLabel = currencySymbol || selectedCurrency;

  const handleSelectCurrency = (currency: string) => {
    updateDraft({
      salary: {
        ...draft.salary,
        currency: currency.toUpperCase(),
      },
    });
    setOpenCurrencyDropdown(null);
  };

  const toggleCurrencyDropdown = (anchor: "minimum" | "maximum") => {
    setOpenCurrencyDropdown((current) => (current === anchor ? null : anchor));
  };

  const formatSalaryValue = (value: string) => {
    if (!value) {
      return "—";
    }

    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) {
      return value;
    }

    if (currencySymbol) {
      return `${currencySymbol}${numericValue.toLocaleString()}`;
    }

    return `${numericValue.toLocaleString()} ${selectedCurrency}`;
  };

  const renderCurrencyControl = (
    anchor: "minimum" | "maximum",
    ref: MutableRefObject<HTMLDivElement | null>
  ) => (
    <div
      className={styles.currencySuffixDropdown}
      ref={ref}
      data-testid={`salary-${anchor}-currency-control`}
    >
      <button
        type="button"
        className={styles.currencyButton}
        onClick={() => toggleCurrencyDropdown(anchor)}
        aria-label={anchor === "minimum" ? "Select minimum salary currency" : "Select maximum salary currency"}
        aria-haspopup="listbox"
        aria-expanded={openCurrencyDropdown === anchor}
        aria-controls={CURRENCY_DROPDOWN_IDS[anchor]}
      >
        <span>{selectedCurrency}</span>
        <i className="la la-angle-down" aria-hidden="true"></i>
      </button>
      {openCurrencyDropdown === anchor && (
        <div
          className={styles.currencyMenu}
          role="listbox"
          id={CURRENCY_DROPDOWN_IDS[anchor]}
          aria-label="Select salary currency"
        >
          {CURRENCY_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={option === selectedCurrency}
              className={classNames(styles.currencyMenuItem, {
                [styles.currencyMenuItemActive]: option === selectedCurrency,
              })}
              onClick={() => handleSelectCurrency(option)}
            >
              <span>{option}</span>
              {option === selectedCurrency && (
                <i className="la la-check" aria-hidden="true"></i>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const hydrationRef = useRef(false);

  useEffect(() => {
    hydrationRef.current = true;
    return () => {
      hydrationRef.current = false;
    };
  }, []);

  useEffect(() => {
    setProvinceList((locations as any).provinces || []);
  }, []);

  useEffect(() => {
    if (career) {
      hydrateFromCareer({
        career,
        questions: career.questions || createDefaultQuestionGroups(),
      });
      setQuestions(
        career.questions && career.questions.length
          ? career.questions
          : createDefaultQuestionGroups()
      );
    } else if (orgID) {
      loadPersistedDraft({ orgID });
    }
  }, [career, hydrateFromCareer, loadPersistedDraft, orgID]);

  // Initialize questions from draft when component mounts or career changes
  useEffect(() => {
    if (draft.questions && Array.isArray(draft.questions) && draft.questions.length > 0) {
      setQuestions(draft.questions);
    }
  }, []);

  // Sync local questions state to draft when questions change
  // Use a ref to track the previous questions to avoid circular updates
  const questionsSyncRef = useRef<string>("");
  useEffect(() => {
    const questionsStr = JSON.stringify(questions);
    if (questionsStr !== questionsSyncRef.current) {
      questionsSyncRef.current = questionsStr;
      updateDraft({ questions });
    }
  }, [questions, updateDraft]);

  useEffect(() => {
    if (!provinceList.length || !hydrationRef.current) {
      return;
    }

    const selectedProvince = draft.location.province
      ? provinceList.find((item) => item.name === draft.location.province)
      : undefined;

    const derivedCities = selectedProvince
      ? (locations as any).cities.filter(
          (item: any) => item.province === selectedProvince.key
        )
      : [];

    setCityList(derivedCities);

    if (!draft.location.province) {
      if (draft.location.city) {
        updateDraft({
          location: {
            ...draft.location,
            city: "",
          },
        });
      }
      return;
    }

    if (!selectedProvince) {
      updateDraft({
        location: {
          ...draft.location,
          province: "",
          city: "",
        },
      });
      return;
    }

    if (
      draft.location.city &&
      !derivedCities.some((item: any) => item.name === draft.location.city)
    ) {
      updateDraft({
        location: {
          ...draft.location,
          city: "",
        },
      });
    }
  }, [provinceList, draft.location, updateDraft]);

  useEffect(() => {
    if (!orgID) {
      return;
    }

    const fetchMembers = async () => {
      try {
        setIsLoadingMembers(true);
        const response = await axios.post("/api/fetch-members", { orgID });
        setMembers(response.data || []);
      } catch (error) {
        console.error("Failed to fetch members", error);
        errorToast("Unable to load members", 1600);
      } finally {
        setIsLoadingMembers(false);
      }
    };

    fetchMembers();
  }, [orgID]);

  useEffect(() => {
    if (career) {
      return;
    }

    if (!user?.email || !members.length) {
      return;
    }

    const matchingMember = members.find(
      (entry) => entry.email?.toLowerCase() === user.email.toLowerCase()
    );

    if (!matchingMember) {
      return;
    }

    const alreadyInTeam = teamMembers.some(
      (member: any) => member.memberId === matchingMember._id
    );

    if (!alreadyInTeam) {
      updateDraft({
        team: {
          members: [
            ...teamMembers,
            {
              memberId: matchingMember._id,
              name: matchingMember.name || matchingMember.email,
              email: matchingMember.email,
              image: matchingMember.image,
              role: "job_owner",
            },
          ],
        },
      });
    }
  }, [career, members, teamMembers, updateDraft, user?.email]);

  const addMember = (memberId?: string): boolean => {
    const targetMemberId = memberId || selectedMemberId;
    if (!targetMemberId) {
      return false;
    }

    const existing = teamMembers.find(
      (member: any) => member.memberId === targetMemberId
    );
    if (existing) {
      errorToast("Member already added", 1400);
      return false;
    }

    const memberDetails = members.find((item) => item._id === targetMemberId);
    if (!memberDetails) {
      return false;
    }

    updateDraft({
      team: {
        members: [
          ...teamMembers,
          {
            memberId: memberDetails._id,
            name: memberDetails.name || memberDetails.email,
            email: memberDetails.email,
            image: memberDetails.image,
            role: selectedMemberRole,
          },
        ],
      },
    });

    setSelectedMemberId("");
    setSelectedMemberRole(MEMBER_ROLE_OPTIONS[0].value);
    return true;
  };

  const removeMember = (memberId: string) => {
    updateDraft({
      team: {
        members: teamMembers.filter((member: any) => member.memberId !== memberId),
      },
    });
  };

  const updateMemberRole = (memberId: string, role: string) => {
    updateDraft({
      team: {
        members: teamMembers.map((member: any) =>
          member.memberId === memberId ? { ...member, role } : member
        ),
      },
    });
  };

  const handleAddPreScreenQuestion = (
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
        ? template!.options.map((label) => ({ id: guid(), label }))
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
  };

  const handleRemovePreScreenQuestion = (questionId: string) => {
    setOpenPreScreenTypeFor((current) => (current === questionId ? null : current));
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
      targetGroup.questions = targetGroup.questions.filter(
        (item: any) => item?.id !== questionId
      );

      if (targetGroup.questions.length === initialLength) {
        return previous;
      }

      return nextGroups;
    });
  };

  const handleUpdatePreScreenQuestion = (
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
      const nextQuestion = {
        ...currentQuestion,
        ...updates,
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
      } else {
        if (!Array.isArray(nextQuestion.options)) {
          nextQuestion.options = [];
        }
      }

      targetGroup.questions[questionIndex] = nextQuestion;
      return nextGroups;
    });
  };

  const handleReorderPreScreenQuestions = (sourceQuestionId: string, targetQuestionId: string | null) => {
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
  };

  const handlePreScreenDragStart = (event: DragEvent<HTMLDivElement>, questionId: string) => {
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
  };

  const handlePreScreenDragOver = (event: DragEvent<HTMLDivElement>, targetQuestionId: string) => {
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
  };

  const handlePreScreenDrop = (event: DragEvent<HTMLDivElement>, targetQuestionId: string) => {
    event.preventDefault();
    event.stopPropagation();
    const sourceId = draggingQuestionId || event.dataTransfer.getData("text/plain");
    if (sourceId && sourceId !== targetQuestionId) {
      handleReorderPreScreenQuestions(sourceId, targetQuestionId);
    }
    handlePreScreenDragEnd();
  };

  const handlePreScreenDragLeave = (targetQuestionId: string) => {
    if (dragOverQuestionId === targetQuestionId) {
      setDragOverQuestionId(null);
    }
  };

  const handlePreScreenDragEnd = () => {
    setDraggingQuestionId(null);
    setDragOverQuestionId(null);
    setActiveDragQuestionId(null);
    setIsDragOverTail(false);
  };

  const handleUpdatePreScreenRange = (
    questionId: string,
    key: "rangeMin" | "rangeMax",
    value: string
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

      const nextQuestion = targetGroup.questions.find((item: any) => item?.id === questionId);
      if (!nextQuestion || nextQuestion.answerType !== "range") {
        return previous;
      }

      nextQuestion[key] = value;
      return nextGroups;
    });
  };

  const handleAddPreScreenOption = (questionId: string) => {
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
  };

  const handleUpdatePreScreenOption = (
    questionId: string,
    optionId: string,
    label: string
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

      const nextQuestion = targetGroup.questions.find(
        (item: any) => item?.id === questionId
      );

      if (
        !nextQuestion ||
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
  };

  const handleRemovePreScreenOption = (questionId: string, optionId: string) => {
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
  };

  const handleAddCustomPreScreenQuestion = () => {
    const newQuestionId = guid();

    setQuestions((previous) => {
      if (!previous.length) {
        const defaultGroups = createDefaultQuestionGroups();
        defaultGroups[0].questions = [
          {
            id: newQuestionId,
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
        const inputField = document.getElementById(`pre-screen-question-${newQuestionId}`) as HTMLInputElement | null;
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
  };

  const isStepComplete = (step: SegmentedCareerStep) => {
    switch (step) {
      case "career-details":
        return (
          draft.jobTitle.trim().length > 0 &&
          draft.employmentType.trim().length > 0 &&
          draft.workSetup.trim().length > 0 &&
          draft.location.province.trim().length > 0 &&
          draft.location.city.trim().length > 0 &&
          draft.salary.minimum.trim().length > 0 &&
          draft.salary.maximum.trim().length > 0 &&
          isDescriptionPresent(draft.description) &&
          (!teamMembers || teamMembers.length > 0)
        );
      case "cv-screening":
        return (
          isDescriptionPresent(draft.description) &&
          questions.some(
            (group) =>
              Array.isArray(group.questions) &&
              group.questions.some(
                (entry: any) =>
                  typeof entry?.question === "string" && entry.question.trim().length > 0
              )
          )
        );
      case "ai-setup":
        return questions.some((group) => group.questions && group.questions.length > 0);
      case "pipeline":
        return true;
      case "review":
        return false;
      default:
        return false;
    }
  };

  const isFormValid = useMemo(
    () =>
      isStepComplete("career-details") &&
      isStepComplete("cv-screening") &&
      questions.some((group) => group.questions && group.questions.length > 0),
    [questions, draft, teamMembers]
  );

  const currentStepIndex = useMemo(
    () => segmentedSteps.findIndex((step) => step.id === activeStep),
    [activeStep]
  );

  const progressRatio = useMemo(() => {
    const totalSteps = segmentedSteps.length;
    if (totalSteps === 0 || currentStepIndex < 0) {
      return 0;
    }
    if (totalSteps === 1) {
      return 1;
    }
    const segments = totalSteps - 1;
    const completedSegments = Math.max(0, currentStepIndex);
    let ratio = completedSegments / segments;

    if (currentStepIndex < totalSteps - 1) {
      ratio += 0.5 / segments;
    }

    return Math.min(1, ratio);
  }, [currentStepIndex]);

  const goToNextStep = () => {
    if (currentStepIndex === -1 || currentStepIndex === segmentedSteps.length - 1) {
      return;
    }

    if (!isStepComplete(activeStep)) {
      if (activeStep === "career-details") {
        setShowCareerDetailsErrors(true);
      }
      errorToast("Please complete the required fields before continuing", 1600);
      return;
    }

    const nextStep = segmentedSteps[currentStepIndex + 1];
    setActiveStep(nextStep.id);
    persistDraft({}, { orgID, userEmail: user?.email });
  };

  const goToPreviousStep = () => {
    if (currentStepIndex <= 0) {
      return;
    }
    const prevStep = segmentedSteps[currentStepIndex - 1];
    setActiveStep(prevStep.id);
  };

  const canNavigateToStep = (targetStep: SegmentedCareerStep, index: number) => {
    if (index <= currentStepIndex) {
      return true;
    }

    const requiredSteps = segmentedSteps.slice(0, index);
    return requiredSteps.every((step) => isStepComplete(step.id));
  };

  const formatCareerPayload = (status: string) => {
    const minimumSalary = draft.salary.minimum
      ? Number(draft.salary.minimum)
      : null;
    const maximumSalary = draft.salary.maximum
      ? Number(draft.salary.maximum)
      : null;

    return {
      ...(career?._id ? { _id: career._id } : {}),
      jobTitle: draft.jobTitle,
      description: draft.description,
      workSetup: draft.workSetup,
      workSetupRemarks: draft.workSetupRemarks,
  cvSecretPrompt: draft.cvSecretPrompt,
      questions,
      lastEditedBy: career?.lastEditedBy || {
        image: user?.image,
        name: user?.name,
        email: user?.email,
      },
      createdBy: career?.createdBy || {
        image: user?.image,
        name: user?.name,
        email: user?.email,
      },
      screeningSetting: draft.screeningSetting,
      orgID,
      salaryNegotiable: draft.salary.isNegotiable,
      minimumSalary,
      maximumSalary,
  salaryCurrency: selectedCurrency,
      country: draft.location.country,
      province: draft.location.province,
      location: draft.location.city,
      status,
      employmentType: draft.employmentType,
      teamMembers,
      team: {
        members: teamMembers,
      },
    };
  };

  const confirmSaveCareer = (status: string) => {
    if (!status) {
      return;
    }

    if (status === "active") {
      if (!isStepComplete("career-details")) {
        setActiveStep("career-details");
        setShowCareerDetailsErrors(true);
        errorToast("Please complete the required fields before continuing", 1600);
        return;
      }

      if (!isStepComplete("cv-screening")) {
        const alreadyOnScreeningStep = activeStep === "cv-screening";

        setActiveStep("cv-screening");

        if (alreadyOnScreeningStep) {
          errorToast("Please complete the required fields before continuing", 1600);
        }

        return;
      }
    }

    const payload = formatCareerPayload(status);
    if (
      payload.minimumSalary !== null &&
      payload.maximumSalary !== null &&
      payload.minimumSalary > payload.maximumSalary
    ) {
      errorToast("Minimum salary cannot exceed maximum salary", 1800);
      return;
    }

    if (status === "active") {
      goToNextStep();
      return;
    }

    setShowSaveModal(status);
  };

  const saveCareer = async (status: string) => {
    if (!status || savingCareerRef.current) {
      return;
    }

    const payload = formatCareerPayload(status);

    if (
      payload.minimumSalary !== null &&
      payload.maximumSalary !== null &&
      payload.minimumSalary > payload.maximumSalary
    ) {
      errorToast("Minimum salary cannot exceed maximum salary", 1800);
      return;
    }

    try {
      if (!orgID) {
        errorToast("Missing organization context", 1600);
        return;
      }

      setIsSavingCareer(true);
      savingCareerRef.current = true;
      if (formType === "add") {
        await axios.post("/api/add-career", payload);
        persistDraft(
          { status: "draft", context: { lastPersistedAt: new Date().toISOString() } },
          { orgID, userEmail: user?.email }
        );
        candidateActionToast(
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginLeft: 8,
              fontWeight: 700,
            }}
          >
            Career added {status === "active" ? "and published" : ""}
          </div>,
          1300,
          <i className="la la-check-circle" style={{ color: "#039855", fontSize: 32 }}></i>
        );
        resetDraft();
      } else {
        await axios.post("/api/update-career", payload);
        persistDraft(
          { status, context: { lastPersistedAt: new Date().toISOString() } },
          { orgID, userEmail: user?.email }
        );
        candidateActionToast(
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginLeft: 8,
              fontWeight: 700,
            }}
          >
            Career updated
          </div>,
          1300,
          <i className="la la-check-circle" style={{ color: "#039855", fontSize: 32 }}></i>
        );
      }

      setTimeout(() => {
        window.location.href = `/recruiter-dashboard/careers`;
      }, 1300);
    } catch (error) {
      console.error("Failed to save career", error);
      errorToast("Failed to save career", 1600);
    } finally {
      savingCareerRef.current = false;
      setIsSavingCareer(false);
    }
  };

  const lastSavedTimestamp = useMemo(() => {
    if (draft.context?.lastPersistedAt) {
      return formatTimestamp(draft.context.lastPersistedAt);
    }

    if (career?.updatedAt) {
      return formatTimestamp(career.updatedAt);
    }

    return "Not saved yet";
  }, [draft.context?.lastPersistedAt, career?.updatedAt]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.pageHeader}>
        <div className={styles.headerRow}>
          <div className={styles.titleGroup}>
            <h1>{formType === "add" ? "Add new career" : "Edit career"}</h1>
          </div>
          <div className={styles.actions}>
            <button
              className={styles.ghostButton}
              type="button"
              disabled={isSavingCareer}
              onClick={() => confirmSaveCareer("inactive")}
            >
              Save as Unpublished
            </button>
            <button
              className={styles.primaryButton}
              type="button"
              disabled={isSavingCareer}
              onClick={() => confirmSaveCareer("active")}
            >
              Save and Continue
              <i className="la la-arrow-right"></i>
            </button>
          </div>
        </div>
        <div
          className={styles.stepper}
          style={{
            "--progress-percentage": `${progressRatio}`,
          } as CSSProperties}
        >
          {segmentedSteps.map((step, index) => {
            const isActive = step.id === activeStep;
            const isCompleted = index < currentStepIndex && isStepComplete(step.id);
            const canNavigate = canNavigateToStep(step.id, index);
            const stepHasErrors =
              step.id === "career-details" &&
              showCareerDetailsErrors &&
              !isStepComplete("career-details");
            
            let stepProgressWidth = 0;
            if (isCompleted) {
              stepProgressWidth = 100;
            } else if (isActive) {
              const stepHasAnyData = isStepComplete(step.id);
              stepProgressWidth = stepHasAnyData ? 50 : 0;
            }
            
            return (
              <button
                key={step.id}
                type="button"
                className={classNames(styles.step, {
                  [styles.active]: isActive,
                  [styles.done]: isCompleted,
                  [styles.disabled]: !canNavigate,
                })}
                onClick={() => canNavigate && setActiveStep(step.id)}
                disabled={!canNavigate}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%" }}>
                  <span
                    className={classNames(
                      stepHasErrors ? styles.stepErrorIndicator : styles.stepIndicator
                    )}
                  >
                    {stepHasErrors ? (
                      <i className="la la-exclamation-triangle" aria-hidden="true"></i>
                    ) : isCompleted ? (
                      <i className="la la-check" aria-hidden="true"></i>
                    ) : (
                      <span className={styles.stepDot} aria-hidden="true" />
                    )}
                  </span>
                  <div 
                    className={styles.stepProgress}
                    style={{ "--step-progress": `${stepProgressWidth}%`, margin: 0 } as CSSProperties}
                  />
                </div>
                <span
                  className={classNames(styles.stepLabel, {
                    [styles.stepLabelError]: stepHasErrors,
                  })}
                >
                  {step.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.stepContent}>
        <div className={styles.primaryColumn}>
          {activeStep === "career-details" && (
            <>
              <div className={styles.card}>
                <header className={styles.cardHeader}>
                  <span className={styles.icon}>
                    <i className="la la-suitcase"></i>
                  </span>
                  <div className={styles.titleGroup}>
                    <strong>Career information</strong>
                  </div>
                </header>
                <div className={styles.cardInner}>
                  {/* Basic Information */}
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937', marginBottom: '12px' }}>Basic Information</div>
                  <div
                    className={classNames(styles.inlineField, {
                      [styles.errorField]: !draft.jobTitle && showCareerDetailsErrors,
                    })}
                  >
                    <label htmlFor="jobTitle">Job Title</label>
                    <input
                      id="jobTitle"
                      placeholder="Enter job title"
                      value={draft.jobTitle}
                      onChange={(event) => updateDraft({ jobTitle: event.target.value })}
                      className={classNames({
                        [styles.errorInput]: !draft.jobTitle && showCareerDetailsErrors,
                      })}
                    />
                    {!draft.jobTitle && showCareerDetailsErrors && (
                      <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '6px' }}>This is a required field.</div>
                    )}
                  </div>
                  
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
                    {/* Work Setting */}
                    <div style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Work Setting</div>
                    <div className={styles.fieldGrid}>
                      <div
                        className={classNames(styles.inlineField, {
                          [styles.errorField]: !draft.employmentType && showCareerDetailsErrors,
                        })}
                      >
                        <label>Employment Type</label>
                        <CustomDropdown
                          screeningSetting={draft.employmentType}
                          settingList={EMPLOYMENT_TYPE_OPTIONS}
                          placeholder="Choose employment type"
                          onSelectSetting={(value: string) => updateDraft({ employmentType: value })}
                        />
                        {!draft.employmentType && showCareerDetailsErrors && (
                          <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '6px' }}>This is a required field.</div>
                        )}
                      </div>
                      <div
                        className={classNames(styles.inlineField, {
                          [styles.errorField]: !draft.workSetup && showCareerDetailsErrors,
                        })}
                      >
                        <label>Arrangement</label>
                        <CustomDropdown
                          screeningSetting={draft.workSetup}
                          settingList={WORK_SETUP_OPTIONS}
                          placeholder="Choose work arrangement"
                          onSelectSetting={(value: string) => updateDraft({ workSetup: value })}
                        />
                        {!draft.workSetup && showCareerDetailsErrors && (
                          <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '6px' }}>This is a required field.</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Location</div>
                    <div className={styles.fieldGrid}>
                      <div className={styles.inlineField}>
                        <label>Country</label>
                        <CustomDropdown
                          screeningSetting={draft.location.country}
                          placeholder="Select country"
                          settingList={[{ name: "Philippines" }]}
                          onSelectSetting={(value: string) =>
                            updateDraft({
                              location: {
                                ...draft.location,
                                country: value,
                              },
                            })
                          }
                        />
                      </div>
                      <div
                        className={classNames(styles.inlineField, {
                          [styles.errorField]: !draft.location.province && showCareerDetailsErrors,
                        })}
                      >
                        <label>State / Province</label>
                        <CustomDropdown
                          screeningSetting={draft.location.province}
                          placeholder="Choose state / province"
                          settingList={provinceList}
                          onSelectSetting={(value: string) => {
                            const provinceData = provinceList.find((item) => item.name === value);
                            const derivedCities = (locations as any).cities.filter(
                              (city: any) => city.province === provinceData?.key
                            );
                            setCityList(derivedCities);
                            updateDraft({
                              location: {
                                ...draft.location,
                                province: value,
                                city: "",
                              },
                            });
                          }}
                        />
                        {!draft.location.province && showCareerDetailsErrors && (
                          <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '6px' }}>This is a required field.</div>
                        )}
                      </div>
                      <div
                        className={classNames(styles.inlineField, {
                          [styles.errorField]: !draft.location.city && showCareerDetailsErrors,
                        })}
                      >
                        <label>City</label>
                        <CustomDropdown
                          screeningSetting={draft.location.city}
                          placeholder="Choose city"
                          settingList={cityList}
                          onSelectSetting={(value: string) =>
                            updateDraft({
                              location: {
                                ...draft.location,
                                city: value,
                              },
                            })
                          }
                        />
                        {!draft.location.city && showCareerDetailsErrors && (
                          <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '6px' }}>This is a required field.</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
                    {/* Salary with negotiable toggle on the right */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Salary</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px', color: '#6b7280' }}>Negotiable</span>
                        <label className="switch" style={{ margin: 0 }}>
                          <input
                            type="checkbox"
                            checked={draft.salary.isNegotiable}
                            onChange={() =>
                              updateDraft({
                                salary: {
                                  ...draft.salary,
                                  isNegotiable: !draft.salary.isNegotiable,
                                },
                              })
                            }
                          />
                          <span className="slider round"></span>
                        </label>
                      </div>
                    </div>
                    <div className={styles.salaryGroup}>
                      <div
                        className={classNames(styles.inlineField, styles.salaryInput, {
                          [styles.errorField]: !draft.salary.minimum && showCareerDetailsErrors,
                        })}
                      >
                         <label>Minimum Salary</label>
                         <div className={styles.salaryInputControl}>
                           {currencyPrefixLabel && (
                             <span className={styles.currencyPrefix} aria-hidden="true">{currencyPrefixLabel}</span>
                           )}
                           <input
                             type="number"
                             min={0}
                             placeholder="0"
                             value={draft.salary.minimum}
                             onChange={(event) =>
                               updateDraft({
                                 salary: {
                                   ...draft.salary,
                                   minimum: event.target.value,
                                 },
                               })
                             }
                            className={classNames({
                              [styles.errorInput]: !draft.salary.minimum && showCareerDetailsErrors,
                            })}
                           />
                           {renderCurrencyControl("minimum", minimumCurrencyDropdownRef)}
                         </div>
                         {!draft.salary.minimum && showCareerDetailsErrors && (
                           <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '6px' }}>This is a required field.</div>
                         )}
                       </div>
                      <div
                        className={classNames(styles.inlineField, styles.salaryInput, {
                          [styles.errorField]: !draft.salary.maximum && showCareerDetailsErrors,
                        })}
                      >
                         <label>Maximum Salary</label>
                         <div className={styles.salaryInputControl}>
                           {currencyPrefixLabel && (
                             <span className={styles.currencyPrefix} aria-hidden="true">{currencyPrefixLabel}</span>
                           )}
                           <input
                             type="number"
                             min={0}
                             placeholder="0"
                             value={draft.salary.maximum}
                             onChange={(event) =>
                               updateDraft({
                                 salary: {
                                   ...draft.salary,
                                   maximum: event.target.value,
                                 },
                               })
                             }
                            className={classNames({
                              [styles.errorInput]: !draft.salary.maximum && showCareerDetailsErrors,
                            })}
                           />
                           {renderCurrencyControl("maximum", maximumCurrencyDropdownRef)}
                         </div>
                         {!draft.salary.maximum && showCareerDetailsErrors && (
                           <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '6px' }}>This is a required field.</div>
                         )}
                       </div>
                    </div>
                    {draft.salary.minimum &&
                      draft.salary.maximum &&
                      Number(draft.salary.minimum) > Number(draft.salary.maximum) && (
                        <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '6px' }}>
                          Minimum salary cannot be higher than maximum salary.
                        </div>
                      )}
                  </div>
                </div>
              </div>

              <div className={styles.card}>
                <header className={styles.cardHeader}>
                  <span className={styles.icon}>
                    <i className="la la-file-text"></i>
                  </span>
                  <div className={styles.titleGroup}>
                    <strong>Job description</strong>
                  </div>
                </header>
                <div className={styles.cardInner}>
                  <div
                    className={classNames(styles.sectionContainer, {
                      [styles.errorField]: !isDescriptionPresent(draft.description) && showCareerDetailsErrors,
                    })}
                  >
                    <div className={styles.sectionHeading}>2. Job Description</div>
                    <RichTextEditor
                      text={draft.description}
                      setText={(value: string) => updateDraft({ description: value })}
                    />
                    {!isDescriptionPresent(draft.description) && showCareerDetailsErrors && (
                      <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '6px' }}>Job description is required.</div>
                    )}
                  </div>
                </div>
              </div>

              <div className={styles.card}>
                <header className={styles.cardHeader}>
                  <span className={styles.icon}>
                    <i className="la la-users"></i>
                  </span>
                  <div className={styles.titleGroup}>
                    <strong>Team access</strong>
                  </div>
                </header>
                <div className={styles.cardInner}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                    <div>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600, color: '#1f2937' }}>Add more members</h4>
                      <p style={{ margin: '0', fontSize: '14px', color: '#6b7280' }}>
                        You can add other members to collaborate on this career.
                      </p>
                    </div>
                    <div style={{ position: 'relative', minWidth: '320px' }}>
                      <button
                        id="member-picker-button"
                        type="button"
                        onClick={() => setIsMemberPickerOpen((v) => !v)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          backgroundColor: '#fff',
                          cursor: 'pointer',
                          fontSize: '14px',
                          color: '#111827',
                        }}
                      >
                        <span>Add member</span>
                        <i className="la la-angle-down" style={{ color: '#6b7280' }}></i>
                      </button>

                      {isMemberPickerOpen && (
                        <div
                          id="member-picker-panel"
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 8px)',
                            right: 0,
                            width: 420,
                            maxHeight: 380,
                            display: 'flex',
                            flexDirection: 'column',
                            backgroundColor: '#fff',
                            border: '1px solid #e5e7eb',
                            borderRadius: 12,
                            boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
                            zIndex: 60,
                          }}
                        >
                          <div style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              border: '1px solid #e5e7eb',
                              borderRadius: 10,
                              padding: '8px 10px',
                              backgroundColor: '#fff'
                            }}>
                              <i className="la la-search" style={{ color: '#9ca3af' }}></i>
                              <input
                                value={memberSearch}
                                onChange={(e) => setMemberSearch(e.target.value)}
                                placeholder="Search member"
                                style={{
                                  border: 'none',
                                  outline: 'none',
                                  flex: 1,
                                  fontSize: 14,
                                }}
                              />
                            </div>
                          </div>

                          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
                            {availableMembers.length === 0 ? (
                              <div style={{
                                padding: '16px 8px',
                                fontSize: 14,
                                color: '#6b7280',
                                textAlign: 'center',
                              }}>
                                {memberSearch.trim()
                                  ? 'No members match your search.'
                                  : 'All available members are already added.'}
                              </div>
                            ) : (
                              availableMembers.map((m) => (
                                <button
                                  key={m._id}
                                  type="button"
                                  onClick={() => {
                                    const didAdd = addMember(m._id);
                                    if (didAdd) {
                                      setIsMemberPickerOpen(false);
                                      setMemberSearch('');
                                    }
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    width: '100%',
                                    textAlign: 'left',
                                    gap: 12,
                                    padding: '10px 6px',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                  }}
                                >
                                  {m.image ? (
                                    <img src={m.image} alt={m.name || m.email} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                                  ) : (
                                    <span style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', backgroundColor: '#e5e7eb', fontSize: 12, fontWeight: 600, color: '#6b7280', flexShrink: 0 }}>
                                      {(m.name || m.email || '?').charAt(0)}
                                    </span>
                                  )}
                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: 15, color: '#111827', fontWeight: 600, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name || 'Member'}</div>
                                    <div style={{ fontSize: 14, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</div>
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
                    {/* Validation: Job owner required, show above member list */}
                    {!hasJobOwner && teamMembers.length > 0 && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '16px',
                        color: '#dc2626',
                      }}>
                        <i className="la la-exclamation-triangle" style={{ color: '#dc2626', fontSize: '18px', flexShrink: 0 }}></i>
                        <span style={{ fontSize: '12px', fontWeight: 500 }}>Career must have a job owner. Please assign a job owner.</span>
                      </div>
                    )}
                    {isLoadingMembers && (
                      <span className={styles.inlineLink}>
                        <i className="la la-spinner la-spin"></i>
                        Loading members...
                      </span>
                    )}
                    {!isLoadingMembers && teamMembers.length === 0 && (
                      <span className={styles.inlineLink}>
                        <i className="la la-info-circle"></i>
                        Add at least one member to continue.
                      </span>
                    )}
                    {teamMembers.map((member: any) => (
                      <div key={member.memberId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #e5e7eb', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                          {member.image ? (
                            <img
                              src={member.image}
                              alt={member.name}
                              style={{ width: 48, height: 48, objectFit: "cover", borderRadius: '50%', flexShrink: 0 }}
                            />
                          ) : (
                            <span style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', backgroundColor: '#e5e7eb', fontSize: '14px', fontWeight: 600, color: '#6b7280', flexShrink: 0 }}>
                              {(member.name || member.email || "?").charAt(0)}
                            </span>
                          )}
                          <div style={{ minWidth: 0 }}>
                            <strong style={{ display: 'block', fontSize: '14px', color: '#1f2937' }}>
                              {member.name || "Member"} {member.email === user?.email && <span style={{ color: '#6b7280', fontWeight: 'normal' }}>(You)</span>}
                            </strong>
                            <span title={member.email} style={{ fontSize: '12px', color: '#6b7280', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {member.email}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                          <div style={{ position: 'relative' }}>
                            {(() => {
                              const currentRoleLabel =
                                (MEMBER_ROLE_OPTIONS || []).find((o: any) => o.value === member.role)?.label ||
                                'Select role';
                              return (
                                <button
                                  id={`role-button-${member.memberId}`}
                                  type="button"
                                  onClick={() =>
                                    setOpenRoleMenuFor((prev) =>
                                      prev === member.memberId ? null : member.memberId
                                    )
                                  }
                                  style={{
                                    padding: '8px 12px',
                                    border: '2px solid #e5e7eb',
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                    backgroundColor: '#fff',
                                    minWidth: '200px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '12px',
                                  }}
                                >
                                  <span style={{ color: '#111827', fontWeight: 500 }}>{currentRoleLabel}</span>
                                  <i className="la la-angle-down" style={{ color: '#6b7280' }}></i>
                                </button>
                              );
                            })()}
                            {openRoleMenuFor === member.memberId && (
                              <div
                                id={`role-menu-${member.memberId}`}
                                style={{
                                  position: 'absolute',
                                  top: 'calc(100% + 8px)',
                                  right: 0,
                                  width: 360,
                                  backgroundColor: '#fff',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: 12,
                                  boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
                                  padding: 8,
                                  zIndex: 50,
                                }}
                              >
                                {(MEMBER_ROLE_OPTIONS || []).map((option: any) => {
                                  const isSelected = member.role === option.value;
                                  const label: string = option.label;
                                  const desc = ROLE_DESCRIPTIONS[label] || '';
                                  return (
                                    <button
                                      key={option.value}
                                      type="button"
                                      onClick={() => {
                                        updateMemberRole(member.memberId, option.value);
                                        setOpenRoleMenuFor(null);
                                      }}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: 12,
                                        width: '100%',
                                        textAlign: 'left',
                                        padding: '12px 14px',
                                        borderRadius: 10,
                                        border: 'none',
                                        backgroundColor: isSelected ? '#eaf1ff' : 'transparent',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
                                          {label}
                                        </div>
                                        {desc && (
                                          <div style={{ fontSize: 13, lineHeight: '18px', color: '#6b7280' }}>{desc}</div>
                                        )}
                                      </div>
                                      {isSelected && (
                                        <i className="la la-check" style={{ color: '#3b82f6', fontSize: 18 }}></i>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            className={styles.removeButton}
                            onClick={() => removeMember(member.memberId)}
                            style={{ padding: '8px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#d1d5db', flexShrink: 0 }}
                          >
                            <i className="la la-trash" style={{ fontSize: '18px' }}></i>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '16px', marginBottom: '0' }}>
                    *Admins can view all careers regardless of specific access settings.
                  </p>
                </div>
              </div>

            </>
          )}

          {activeStep === "cv-screening" && (
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
                  <div className={styles.inlineField}>
                    <label
                      htmlFor="cvSecretPrompt"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "16px",
                        fontWeight: 700,
                        color: "#111827",
                        marginBottom: "8px",
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "28px",
                          height: "28px",
                          borderRadius: "50%",
                          background: "linear-gradient(135deg, #f9a8d4, #c4b5fd, #93c5fd)",
                          color: "#ffffff",
                          fontSize: "16px",
                        }}
                      >
                        <i className="la la-magic"></i>
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        CV Secret Prompt
                        <span style={{ fontSize: "14px", fontWeight: 500, color: "#6b7280" }}>
                          (optional)
                        </span>
                      </span>
                      <i
                        className="la la-question-circle"
                        aria-hidden="true"
                        style={{ fontSize: "18px", color: "#9ca3af", marginLeft: "auto" }}
                      ></i>
                    </label>
                    <p
                      id="cvSecretPromptDescription"
                      style={{
                        margin: "0 0 12px 0",
                        fontSize: "14px",
                        lineHeight: "20px",
                        color: "#4b5563",
                      }}
                    >
                      Secret prompts give you extra control over Jia's evaluation style, complementing her
                      assessment of requirements from the job description.
                    </p>
                    <textarea
                      id="cvSecretPrompt"
                      aria-describedby="cvSecretPromptDescription"
                      value={draft.cvSecretPrompt || ""}
                      placeholder="Enter a secret prompt (e.g. Give higher fit scores to candidates who participate in hackathons or competitions.)"
                      onChange={(event) =>
                        updateDraft({
                          cvSecretPrompt: event.target.value,
                        })
                      }
                      rows={5}
                    />
                  </div>
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
                        <span style={{ fontSize: "14px", fontWeight: 500, color: "#6b7280" }}>
                          (optional)
                        </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCustomPreScreenQuestion}
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
                          PRE_SCREEN_TYPE_OPTIONS.find(
                            (option) => option.value === resolvedAnswerType
                          ) || PRE_SCREEN_TYPE_OPTIONS[0];

                        const optionList: Array<{ id: string; label: string }> = Array.isArray(
                          item?.options
                        )
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
                            onDragStart={(event) => handlePreScreenDragStart(event, item.id)}
                            onDragEnter={(event) => handlePreScreenDragOver(event, item.id)}
                            onDragOver={(event) => handlePreScreenDragOver(event, item.id)}
                            onDragLeave={() => handlePreScreenDragLeave(item.id)}
                            onDrop={(event) => handlePreScreenDrop(event, item.id)}
                            onDragEnd={handlePreScreenDragEnd}
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
                                    handleUpdatePreScreenQuestion(item.id, {
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
                                    setOpenPreScreenTypeFor((current) =>
                                      current === item.id ? null : item.id
                                    )
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
                                  <i
                                    className="la la-angle-down"
                                    aria-hidden="true"
                                    style={{ fontSize: "18px", color: "#9ca3af" }}
                                  ></i>
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
                                            handleUpdatePreScreenQuestion(item.id, {
                                              answerType: option.value,
                                            });
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
                                          <span style={{ display: "flex", alignItems: "center", gap: "12px", color: "#111827", fontWeight: isSelected ? 700 : 500 }}>
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
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "12px",
                                }}
                              >
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
                                        handleUpdatePreScreenOption(item.id, option.id, event.target.value)
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
                                      onClick={() => handleRemovePreScreenOption(item.id, option.id)}
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
                                  onClick={() => handleAddPreScreenOption(item.id)}
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
                                          handleUpdatePreScreenRange(item.id, "rangeMin", event.target.value)
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
                                          handleUpdatePreScreenRange(item.id, "rangeMax", event.target.value)
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

                            <div
                              style={{
                                display: "flex",
                                justifyContent: "flex-end",
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => handleRemovePreScreenQuestion(item.id)}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  padding: "10px 18px",
                                  borderRadius: "12px",
                                  border: "1px solid #fca5a5",
                                  backgroundColor: "transparent",
                                  color: "#b91c1c",
                                  fontSize: "14px",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                              >
                                <i className="la la-trash" aria-hidden="true"></i>
                                Delete Question
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
                          handleReorderPreScreenQuestions(draggingQuestionId, null);
                          handlePreScreenDragEnd();
                        }}
                        aria-label="Drop to move question to the end"
                      ></div>
                    </div>
                  )}

                  <div style={{ fontSize: "14px", color: "#111827", fontWeight: 600, marginBottom: "12px" }}>
                    Suggested Pre-screening Questions:
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {SUGGESTED_PRE_SCREENING_QUESTIONS.map((suggestion) => {
                      const alreadyAdded = preScreeningQuestions.some(
                        (item: any) =>
                          typeof item?.question === "string" &&
                          item.question.trim().toLowerCase() ===
                            suggestion.prompt.trim().toLowerCase()
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
                              handleAddPreScreenQuestion(suggestion.prompt, {
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
          )}

          {activeStep === "ai-setup" && (
            <div className={styles.card}>
              <header className={styles.cardHeader}>
                <span className={styles.icon}>
                  <i className="la la-robot"></i>
                </span>
                <div className={styles.titleGroup}>
                  <strong>AI interview setup</strong>
                  <span>Review the generated structure</span>
                </div>
              </header>
              <div className={styles.cardInner}>
                <div className={styles.reviewGrid}>
                  <div className={styles.reviewCard}>
                    <h4>Interview categories</h4>
                    <ul className={styles.summaryList}>
                      {questions.map((group) => (
                        <li key={group.id}>
                          <span className={styles.summaryLabel}>{group.category}</span>
                          <span>
                            {group.questions?.length
                              ? `${group.questions.length} question(s)`
                              : "No questions yet"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className={styles.reviewCard}>
                    <h4>Resume requirements</h4>
                    <p className={styles.resumeNotice}>
                      Applicants upload a PDF resume. Jia validates key claims against your
                      job description.
                    </p>
                  </div>
                </div>
                <footer className={styles.stepFooter}>
                  <button className={styles.backButton} onClick={goToPreviousStep}>
                    <i className="la la-arrow-left"></i>
                    Back to CV review
                  </button>
                  <button className={styles.nextButton} onClick={goToNextStep}>
                    Continue to pipeline
                    <i className="la la-arrow-right"></i>
                  </button>
                </footer>
              </div>
            </div>
          )}

          {activeStep === "pipeline" && (
            <div className={styles.card}>
              <header className={styles.cardHeader}>
                <span className={styles.icon}>
                  <i className="la la-project-diagram"></i>
                </span>
                <div className={styles.titleGroup}>
                  <strong>Pipeline stages</strong>
                  <span>Map the journey from application to hire</span>
                </div>
              </header>
              <div className={styles.cardInner}>
                <div className={styles.pipelineCard}>
                  <span className={styles.pipelineIcon}>
                    <i className="la la-tools"></i>
                  </span>
                  <h3>Pipeline builder coming soon</h3>
                  <p>
                    We are preparing a dedicated pipeline builder for recruiters. Save this
                    career now and you can define stages once the feature is released.
                  </p>
                </div>
                <footer className={styles.stepFooter}>
                  <button className={styles.backButton} onClick={goToPreviousStep}>
                    <i className="la la-arrow-left"></i>
                    Back to AI setup
                  </button>
                  <button className={styles.nextButton} onClick={goToNextStep}>
                    Continue to review
                    <i className="la la-arrow-right"></i>
                  </button>
                </footer>
              </div>
            </div>
          )}

          {activeStep === "review" && (
            <div className={styles.card}>
              <header className={styles.cardHeader}>
                <span className={styles.icon}>
                  <i className="la la-clipboard-check"></i>
                </span>
                <div className={styles.titleGroup}>
                  <strong>Review career</strong>
                  <span>Preview the key details before publishing</span>
                </div>
              </header>
              <div className={styles.cardInner}>
                <div className={styles.reviewGrid}>
                  <div className={styles.reviewCard}>
                    <h4>Career summary</h4>
                    <ul className={styles.summaryList}>
                      <li>
                        <span className={styles.summaryLabel}>Job title</span>
                        <span>{draft.jobTitle || "—"}</span>
                      </li>
                      <li>
                        <span className={styles.summaryLabel}>Employment type</span>
                        <span>{draft.employmentType || "—"}</span>
                      </li>
                      <li>
                        <span className={styles.summaryLabel}>Arrangement</span>
                        <span>{draft.workSetup || "—"}</span>
                      </li>
                      <li>
                        <span className={styles.summaryLabel}>Location</span>
                        <span>
                          {[draft.location.city, draft.location.province, draft.location.country]
                            .filter(Boolean)
                            .join(", ") || "—"}
                        </span>
                      </li>
                    </ul>
                  </div>
                  <div className={styles.reviewCard}>
                    <h4>Salary</h4>
                    <ul className={styles.summaryList}>
                      <li>
                        <span className={styles.summaryLabel}>Negotiable</span>
                        <span>{draft.salary.isNegotiable ? "Yes" : "No"}</span>
                      </li>
                      <li>
                        <span className={styles.summaryLabel}>Currency</span>
                        <span>{selectedCurrency}</span>
                      </li>
                      <li>
                        <span className={styles.summaryLabel}>Minimum</span>
                        <span>{formatSalaryValue(draft.salary.minimum)}</span>
                      </li>
                      <li>
                        <span className={styles.summaryLabel}>Maximum</span>
                        <span>{formatSalaryValue(draft.salary.maximum)}</span>
                      </li>
                    </ul>
                  </div>
                  <div className={styles.reviewCard}>
                    <h4>Team access</h4>
                    <ul className={styles.summaryList}>
                      {teamMembers.map((member: any) => (
                        <li key={member.memberId}>
                          <span className={styles.summaryLabel}>{member.name}</span>
                          <span>
                            {MEMBER_ROLE_OPTIONS.find((option) => option.value === member.role)?.label ||
                              member.role}
                          </span>
                        </li>
                      ))}
                      {!teamMembers.length && <span>No team members assigned yet.</span>}
                    </ul>
                  </div>
                </div>
                <div className={styles.sectionHeading}>Description preview</div>
                <div className={styles.descriptionPreview}>
                  {isDescriptionPresent(draft.description)
                    ? draft.description.replace(/<[^>]+>/g, " ").trim()
                    : "No description provided."}
                </div>
                <footer className={styles.stepFooter}>
                  <button className={styles.backButton} onClick={goToPreviousStep}>
                    <i className="la la-arrow-left"></i>
                    Back
                  </button>
                  <div style={{ display: "flex", gap: 12 }}>
                    <button
                      className={styles.nextButton}
                      disabled={!isFormValid}
                      onClick={() => confirmSaveCareer("inactive")}
                    >
                      Save as Unpublished
                    </button>
                    <button
                      className={styles.nextButton}
                      disabled={!isFormValid}
                      onClick={() => confirmSaveCareer("active")}
                    >
                      Save and Publish
                    </button>
                  </div>
                </footer>
              </div>
            </div>
          )}
        </div>

        <aside className={styles.secondaryColumn}>
          <div className={styles.tipsCard}>
            <div className={styles.tipsHeader}>
              <span className={styles.tipsBadge} aria-hidden="true">
                <svg
                  className={styles.tipsIcon}
                  viewBox="0 0 48 48"
                  role="presentation"
                  focusable="false"
                >
                  <defs>
                    <linearGradient
                      id={tipsBulbGradientId}
                      x1="12"
                      y1="8"
                      x2="36"
                      y2="40"
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop offset="0" stopColor="#f9a8d4" />
                      <stop offset="0.5" stopColor="#c4b5fd" />
                      <stop offset="1" stopColor="#93c5fd" />
                    </linearGradient>
                    <linearGradient
                      id={tipsStarGradientId}
                      x1="34"
                      y1="10"
                      x2="42"
                      y2="20"
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop offset="0" stopColor="#c4b5fd" />
                      <stop offset="1" stopColor="#93c5fd" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M24 6C16.82 6 11 11.82 11 19c0 4.82 2.65 8.97 6.57 11.16L18 33h12l-.57-2.84C31.35 27.97 34 23.82 34 19c0-7.18-5.82-13-13-13Z"
                    fill="none"
                    stroke={`url(#${tipsBulbGradientId})`}
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M19 34h10"
                    stroke={`url(#${tipsBulbGradientId})`}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M20.5 38h7"
                    stroke={`url(#${tipsBulbGradientId})`}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M22 42h3.5"
                    stroke={`url(#${tipsBulbGradientId})`}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M36 11.5 37.2 14l2.6.3-1.9 1.8.5 2.4-2.2-1.2-2.1 1.2.4-2.4-1.9-1.8 2.6-.3z"
                    fill={`url(#${tipsStarGradientId})`}
                    fillOpacity="0.9"
                  />
                  <path
                    d="m41 18.2.6 1.3 1.4.1-1 1 .3 1.3-1.2-.7-1.2.7.3-1.3-1-1 1.4-.1z"
                    fill={`url(#${tipsStarGradientId})`}
                    fillOpacity="0.75"
                  />
                </svg>
              </span>
              <span className={styles.tipsTitle}>Tips</span>
            </div>
            <div className={styles.tipsBody}>
              <ul className={styles.tipsList}>
                {tipsContent.map((tip) => (
                  <li key={tip.heading}>
                    <strong>{tip.heading}</strong>
                    <span>{tip.body}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>
      </div>

      {showSaveModal && (
        <CareerActionModal
          action={showSaveModal}
          onAction={(action) => {
            setShowSaveModal("");
            if (action) {
              saveCareer(action);
            }
          }}
        />
      )}

      {isSavingCareer && (
        <FullScreenLoadingAnimation
          title={formType === "add" ? "Saving career..." : "Updating career..."}
          subtext={`Please wait while we are ${
            formType === "add" ? "saving" : "updating"
          } the career`}
        />
      )}
    </div>
  );
}