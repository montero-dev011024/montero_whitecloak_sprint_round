"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import classNames from "classnames";
import axios from "axios";
import dynamic from "next/dynamic";
import styles from "@/lib/styles/segmentedCareerForm.module.scss";
import { candidateActionToast, errorToast } from "@/lib/Utils";
import { useAppContext } from "@/lib/context/AppContext";
import CustomDropdown from "@/lib/components/CareerComponents/CustomDropdown";
import locations from "../../../../public/philippines-locations.json";
import CareerActionModal from "@/lib/components/CareerComponents/CareerActionModal";
import FullScreenLoadingAnimation from "@/lib/components/CareerComponents/FullScreenLoadingAnimation";
import InterviewQuestionGeneratorV2 from "@/lib/components/CareerComponents/InterviewQuestionGeneratorV2";
import useSegmentedFormState, {
  SegmentedCareerStep,
  segmentedSteps,
  createDefaultQuestionGroups,
  QuestionGroup,
} from "@/lib/hooks/useSegmentedCareerFormState";

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
  const [provinceList, setProvinceList] = useState<Array<any>>([]);
  const [cityList, setCityList] = useState<Array<any>>([]);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [selectedMemberRole, setSelectedMemberRole] = useState<string>(
    MEMBER_ROLE_OPTIONS[0].value
  );
  const [showSaveModal, setShowSaveModal] = useState<string>("");
  const [isSavingCareer, setIsSavingCareer] = useState(false);
  const savingCareerRef = useRef(false);
  const teamMembers = useMemo(
    () => draft.team?.members || [],
    [draft.team?.members]
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

    const desiredProvince =
      provinceList.find((item) => item.name === draft.location.province) ||
      provinceList[0];

    const derivedCities = (locations as any).cities.filter(
      (item: any) => item.province === desiredProvince?.key
    );
    setCityList(derivedCities);

    if (!draft.location.province && desiredProvince) {
      updateDraft({
        location: {
          ...draft.location,
          province: desiredProvince.name,
          city: derivedCities[0]?.name || "",
        },
      });
      return;
    }

    if (
      draft.location.province === desiredProvince?.name &&
      draft.location.city &&
      derivedCities.some((item: any) => item.name === draft.location.city)
    ) {
      return;
    }

    if (derivedCities.length) {
      updateDraft({
        location: {
          ...draft.location,
          province: desiredProvince?.name || draft.location.province,
          city: derivedCities[0].name,
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

  const addMember = () => {
    if (!selectedMemberId) {
      return;
    }

    const existing = teamMembers.find(
      (member: any) => member.memberId === selectedMemberId
    );
    if (existing) {
      errorToast("Member already added", 1400);
      return;
    }

    const memberDetails = members.find((item) => item._id === selectedMemberId);
    if (!memberDetails) {
      return;
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

  const isStepComplete = (step: SegmentedCareerStep) => {
    switch (step) {
      case "career-details":
        return (
          draft.jobTitle.trim().length > 0 &&
          draft.employmentType.trim().length > 0 &&
          draft.workSetup.trim().length > 0 &&
          (!teamMembers || teamMembers.length > 0)
        );
      case "cv-screening":
        return (
          isDescriptionPresent(draft.description) &&
          questions.some((group) => group.questions && group.questions.length > 0)
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

  const goToNextStep = () => {
    if (currentStepIndex === -1 || currentStepIndex === segmentedSteps.length - 1) {
      return;
    }

    if (!isStepComplete(activeStep)) {
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
      requireVideo: draft.requireVideo,
      salaryNegotiable: draft.salary.isNegotiable,
      minimumSalary,
      maximumSalary,
      country: draft.location.country,
      province: draft.location.province,
      location: draft.location.city,
      status,
      employmentType: draft.employmentType,
      teamMembers,
    };
  };

  const confirmSaveCareer = (status: string) => {
    if (!status) {
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
            <span>Complete each segment to launch your listing</span>
          </div>
          <div className={styles.actions}>
            {formType === "edit" && (
              <button
                className={styles.ghostButton}
                type="button"
                onClick={() => setShowEditModal?.(false)}
              >
                Cancel
              </button>
            )}
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
              disabled={!isFormValid || isSavingCareer}
              onClick={() => confirmSaveCareer("active")}
            >
              <i className="la la-check-circle"></i>
              Save and Continue
            </button>
          </div>
        </div>
        <div className={styles.timestamp}>
          <span className={styles.badgeClock}>
            <i className="la la-clock"></i>
          </span>
          <span>Last saved: {lastSavedTimestamp}</span>
        </div>
        <div className={styles.stepper}>
          {segmentedSteps.map((step, index) => {
            const isActive = step.id === activeStep;
            const isCompleted = index < currentStepIndex && isStepComplete(step.id);
            const canNavigate = canNavigateToStep(step.id, index);
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
                <span className={styles.stepIndicator}>{`0${index + 1}`}</span>
                <span className={styles.stepLabel}>
                  <span>{step.subtitle}</span>
                  <strong>{step.title}</strong>
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
                    <span>Define the essentials of the role</span>
                  </div>
                </header>
                <div className={styles.sectionHeading}>1. Career Information</div>
                <div className={styles.inlineField}>
                  <label htmlFor="jobTitle">Job Title</label>
                  <input
                    id="jobTitle"
                    placeholder="Enter job title"
                    value={draft.jobTitle}
                    onChange={(event) => updateDraft({ jobTitle: event.target.value })}
                  />
                </div>
                <div className={styles.fieldGrid}>
                  <div className={styles.inlineField}>
                    <label>Employment Type</label>
                    <CustomDropdown
                      screeningSetting={draft.employmentType}
                      settingList={EMPLOYMENT_TYPE_OPTIONS}
                      placeholder="Choose employment type"
                      onSelectSetting={(value: string) => updateDraft({ employmentType: value })}
                    />
                  </div>
                  <div className={styles.inlineField}>
                    <label>Arrangement</label>
                    <CustomDropdown
                      screeningSetting={draft.workSetup}
                      settingList={WORK_SETUP_OPTIONS}
                      placeholder="Choose work arrangement"
                      onSelectSetting={(value: string) => updateDraft({ workSetup: value })}
                    />
                  </div>
                </div>
                <div className={styles.inlineField}>
                  <label>Work Setup Remarks</label>
                  <input
                    placeholder="Additional notes about the setup (optional)"
                    value={draft.workSetupRemarks}
                    onChange={(event) => updateDraft({ workSetupRemarks: event.target.value })}
                  />
                </div>
                <div className={styles.sectionHeading}>Location</div>
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
                  <div className={styles.inlineField}>
                    <label>State / Province</label>
                    <CustomDropdown
                      screeningSetting={draft.location.province}
                      placeholder="Select province"
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
                            city: derivedCities[0]?.name || "",
                          },
                        });
                      }}
                    />
                  </div>
                  <div className={styles.inlineField}>
                    <label>City</label>
                    <CustomDropdown
                      screeningSetting={draft.location.city}
                      placeholder="Select city"
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
                  </div>
                </div>
                <div className={styles.sectionHeading}>Salary</div>
                <div className={styles.toggleRow}>
                  <div className={styles.toggleLabel}>
                    <i className="la la-money"></i>
                    <span>Salary negotiable</span>
                  </div>
                  <div className={styles.toggleValue}>
                    {draft.salary.isNegotiable ? "Negotiable" : "Fixed"}
                  </div>
                  <label className="switch">
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
                <div className={styles.salaryGroup}>
                  <div className={classNames(styles.inlineField, styles.salaryInput)}>
                    <label>Minimum Salary</label>
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
                    />
                    <span className={styles.currencyPrefix}>₱</span>
                    <span className={styles.currencySuffix}>PHP</span>
                  </div>
                  <div className={classNames(styles.inlineField, styles.salaryInput)}>
                    <label>Maximum Salary</label>
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
                    />
                    <span className={styles.currencyPrefix}>₱</span>
                    <span className={styles.currencySuffix}>PHP</span>
                  </div>
                </div>
                {draft.salary.minimum &&
                  draft.salary.maximum &&
                  Number(draft.salary.minimum) > Number(draft.salary.maximum) && (
                    <span className={styles.salaryError}>
                      Minimum salary cannot be higher than maximum salary.
                    </span>
                  )}
              </div>

              <div className={styles.card}>
                <header className={styles.cardHeader}>
                  <span className={styles.icon}>
                    <i className="la la-file-text"></i>
                  </span>
                  <div className={styles.titleGroup}>
                    <strong>Job description</strong>
                    <span>Highlight responsibilities and success metrics</span>
                  </div>
                </header>
                <div className={styles.sectionHeading}>2. Job Description</div>
                <RichTextEditor
                  text={draft.description}
                  setText={(value: string) => updateDraft({ description: value })}
                />
                {!isDescriptionPresent(draft.description) && (
                  <span className={styles.salaryError}>Job description is required.</span>
                )}
              </div>

              <div className={styles.card}>
                <header className={styles.cardHeader}>
                  <span className={styles.icon}>
                    <i className="la la-users"></i>
                  </span>
                  <div className={styles.titleGroup}>
                    <strong>Team access</strong>
                    <span>Invite collaborators who can manage this career</span>
                  </div>
                </header>
                <div className={styles.teamAccessHeader}>
                  <div>
                    <h4>Assign collaborators</h4>
                    <p>
                      Add teammates who should collaborate on this opening. Admins can
                      still view all careers even if they are not assigned here.
                    </p>
                  </div>
                  <div className={styles.teamActions}>
                    <select
                      className={styles.memberSelect}
                      value={selectedMemberId}
                      onChange={(event) => setSelectedMemberId(event.target.value)}
                    >
                      <option value="">Select member</option>
                      {members.map((member) => (
                        <option key={member._id} value={member._id}>
                          {member.name || member.email}
                        </option>
                      ))}
                    </select>
                    <select
                      className={styles.memberSelect}
                      value={selectedMemberRole}
                      onChange={(event) => setSelectedMemberRole(event.target.value)}
                    >
                      {MEMBER_ROLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className={styles.addMemberButton}
                      onClick={addMember}
                      disabled={!selectedMemberId}
                    >
                      <i className="la la-plus"></i>
                      Add member
                    </button>
                  </div>
                </div>
                <div className={styles.teamList}>
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
                    <div key={member.memberId} className={styles.teamRow}>
                      <div className={styles.teamIdentity}>
                        {member.image ? (
                          <img
                            src={member.image}
                            alt={member.name}
                            className="avatar avatar-md rounded-circle"
                            style={{ width: 40, height: 40, objectFit: "cover" }}
                          />
                        ) : (
                          <span className={styles.avatarFallback}>
                            {(member.name || member.email || "?").charAt(0)}
                          </span>
                        )}
                        <div className={styles.identityInfo}>
                          <strong>{member.name || "Member"}</strong>
                          <span title={member.email}>{member.email}</span>
                        </div>
                      </div>
                      <select
                        className={styles.roleSelect}
                        value={member.role}
                        onChange={(event) =>
                          updateMemberRole(member.memberId, event.target.value)
                        }
                      >
                        {MEMBER_ROLE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className={styles.removeButton}
                        onClick={() => removeMember(member.memberId)}
                      >
                        <i className="la la-trash"></i>
                      </button>
                    </div>
                  ))}
                </div>
                <footer className={styles.stepFooter}>
                  <button
                    className={styles.nextButton}
                    onClick={goToNextStep}
                    disabled={!isStepComplete("career-details")}
                  >
                    Continue to CV review
                    <i className="la la-arrow-right"></i>
                  </button>
                </footer>
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
                    <strong>CV review & pre-screening</strong>
                    <span>Control how Jia endorses candidates</span>
                  </div>
                </header>
                <div className={styles.inlineField}>
                  <label>Screening Setting</label>
                  <CustomDropdown
                    screeningSetting={draft.screeningSetting}
                    settingList={SCREENING_SETTING_OPTIONS}
                    placeholder="Select screening setting"
                    onSelectSetting={(value: string) => updateDraft({ screeningSetting: value })}
                  />
                  <span className={styles.inlineLink}>
                    <i className="la la-lightbulb"></i>
                    Jia promotes candidates who hit this threshold automatically.
                  </span>
                </div>
                <div className={styles.toggleRow}>
                  <div className={styles.toggleLabel}>
                    <i className="la la-video"></i>
                    <span>Require AI interview</span>
                  </div>
                  <div className={styles.toggleValue}>
                    {draft.requireVideo ? "Enabled" : "Disabled"}
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={draft.requireVideo}
                      onChange={() => updateDraft({ requireVideo: !draft.requireVideo })}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
              </div>

              <div className={styles.card}>
                <header className={styles.cardHeader}>
                  <span className={styles.icon}>
                    <i className="la la-comments"></i>
                  </span>
                  <div className={styles.titleGroup}>
                    <strong>Question bank</strong>
                    <span>Create the prompts Jia will ask</span>
                  </div>
                </header>
                <InterviewQuestionGeneratorV2
                  questions={questions}
                  setQuestions={setQuestions}
                  jobTitle={draft.jobTitle}
                  description={draft.description}
                />
                <footer className={styles.stepFooter}>
                  <button className={styles.backButton} onClick={goToPreviousStep}>
                    <i className="la la-arrow-left"></i>
                    Back to career details
                  </button>
                  <button
                    className={styles.nextButton}
                    onClick={goToNextStep}
                    disabled={!isStepComplete("cv-screening")}
                  >
                    Continue to AI setup
                    <i className="la la-arrow-right"></i>
                  </button>
                </footer>
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
                      <span className={styles.summaryLabel}>Minimum</span>
                      <span>
                        {draft.salary.minimum
                          ? `₱${Number(draft.salary.minimum).toLocaleString()}`
                          : "—"}
                      </span>
                    </li>
                    <li>
                      <span className={styles.summaryLabel}>Maximum</span>
                      <span>
                        {draft.salary.maximum
                          ? `₱${Number(draft.salary.maximum).toLocaleString()}`
                          : "—"}
                      </span>
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
                          {
                            MEMBER_ROLE_OPTIONS.find((option) => option.value === member.role)?.label ||
                            member.role
                          }
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
          )}
        </div>

        <aside className={styles.secondaryColumn}>
          <div className={styles.tipsCard}>
            <h3>Tips for better listings</h3>
            <ul className={styles.tipsList}>
              <li>Use clear, searchable job titles such as “Software Engineer”.</li>
              <li>Avoid internal role codes or abbreviations—candidates may not understand them.</li>
              <li>Keep titles concise (2–4 words) to improve scanning and discoverability.</li>
              <li>State key responsibilities and success metrics in the first few sentences.</li>
            </ul>
          </div>
          {formType === "add" && (
            <div className={classNames(styles.card, styles.pipelineCard)}>
              <span className={styles.pipelineIcon}>
                <i className="la la-hourglass-half"></i>
              </span>
              <h3>Save progress anytime</h3>
              <p>
                Your draft is stored locally, so you can return later and resume from the
                last step you completed.
              </p>
            </div>
          )}
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

