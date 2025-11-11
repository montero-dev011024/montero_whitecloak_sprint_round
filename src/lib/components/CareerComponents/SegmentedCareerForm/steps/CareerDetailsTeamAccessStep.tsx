"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import axios from "axios";
import classNames from "classnames";

import CustomDropdown from "@/lib/components/CareerComponents/CustomDropdown";
import { errorToast } from "@/lib/Utils";
import styles from "@/lib/styles/segmentedCareerForm.module.scss";
import locations from "../../../../../../public/philippines-locations.json";
import type {
  CareerFormDraft,
  CareerTeamMember,
} from "@/lib/hooks/useSegmentedCareerFormState";
import {
  CURRENCY_DROPDOWN_IDS,
  CURRENCY_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  MEMBER_ROLE_OPTIONS,
  WORK_SETUP_OPTIONS,
} from "../constants";

interface MemberRecord {
  _id: string;
  name?: string;
  email: string;
  image?: string;
  role?: string;
}

interface CareerDetailsTeamAccessStepProps {
  draft: CareerFormDraft;
  updateDraft: (update: Partial<CareerFormDraft>) => void;
  teamMembers: CareerTeamMember[];
  showErrors: boolean;
  user: any;
  orgID?: string;
  career?: any;
  selectedCurrency: string;
  currencySymbol: string;
  RichTextEditorComponent: ComponentType<{ text: string; setText: (value: string) => void }>;
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  "Job Owner":
    "Leads the hiring process for assigned jobs. Has access with all career settings.",
  Collaborator:
    "Helps evaluate candidates and assist with hiring tasks. Can move candidates through the pipeline, but cannot change any career settings.",
  Viewer:
    "Reviews candidates and provides feedback. Can only view candidate profiles and comment.",
  Contributor:
    "Helps evaluate candidates and assist with hiring tasks. Can move candidates through the pipeline, but cannot change any career settings.",
  Reviewer:
    "Reviews candidates and provides feedback. Can only view candidate profiles and comment.",
};

const isDescriptionPresent = (value?: string) => {
  if (!value) return false;
  const plain = value.replace(/<[^>]+>/g, "").trim();
  return plain.length > 0;
};

const CareerDetailsTeamAccessStep = ({
  draft,
  updateDraft,
  teamMembers,
  showErrors,
  user,
  orgID,
  career,
  selectedCurrency,
  currencySymbol,
  RichTextEditorComponent,
}: CareerDetailsTeamAccessStepProps) => {
  const [provinceList, setProvinceList] = useState<Array<any>>([]);
  const [cityList, setCityList] = useState<Array<any>>([]);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [openRoleMenuFor, setOpenRoleMenuFor] = useState<string | null>(null);
  const [isMemberPickerOpen, setIsMemberPickerOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [openCurrencyDropdown, setOpenCurrencyDropdown] = useState<"minimum" | "maximum" | null>(
    null
  );
  const minimumCurrencyDropdownRef = useRef<HTMLDivElement | null>(null);
  const maximumCurrencyDropdownRef = useRef<HTMLDivElement | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [selectedMemberRole, setSelectedMemberRole] = useState<string>(
    MEMBER_ROLE_OPTIONS[0].value
  );
  const hydrationRef = useRef(false);

  const currencyPrefixLabel = currencySymbol || selectedCurrency;

  const hasJobOwner = useMemo(
    () => teamMembers.some((member) => member.role === "job_owner"),
    [teamMembers]
  );

  const availableMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    const taken = new Set(teamMembers.map((member) => member.memberId));

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

  const toggleCurrencyDropdown = (anchor: "minimum" | "maximum") => {
    setOpenCurrencyDropdown((current) => (current === anchor ? null : anchor));
  };

  const handleSelectCurrency = (currency: string) => {
    updateDraft({
      salary: {
        ...draft.salary,
        currency: currency.toUpperCase(),
      },
    });
    setOpenCurrencyDropdown(null);
  };

  const renderCurrencyControl = (
    anchor: "minimum" | "maximum",
    ref: React.MutableRefObject<HTMLDivElement | null>
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
        aria-label={
          anchor === "minimum"
            ? "Select minimum salary currency"
            : "Select maximum salary currency"
        }
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

  const addMember = (memberId?: string): boolean => {
    const targetMemberId = memberId || selectedMemberId;
    if (!targetMemberId) {
      return false;
    }

    const existing = teamMembers.find((member) => member.memberId === targetMemberId);
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
        members: teamMembers.filter((member) => member.memberId !== memberId),
      },
    });
  };

  const updateMemberRole = (memberId: string, role: string) => {
    updateDraft({
      team: {
        members: teamMembers.map((member) =>
          member.memberId === memberId ? { ...member, role } : member
        ),
      },
    });
  };

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
    if (!openRoleMenuFor) return;

    const handler = (event: MouseEvent) => {
      const menu = document.getElementById(`role-menu-${openRoleMenuFor}`);
      const btn = document.getElementById(`role-button-${openRoleMenuFor}`);
      if (menu && btn) {
        if (!menu.contains(event.target as Node) && !btn.contains(event.target as Node)) {
          setOpenRoleMenuFor(null);
        }
      } else {
        setOpenRoleMenuFor(null);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openRoleMenuFor]);

  useEffect(() => {
    if (!isMemberPickerOpen) return;

    const handler = (event: MouseEvent) => {
      const panel = document.getElementById("member-picker-panel");
      const btn = document.getElementById("member-picker-button");
      if (panel && btn) {
        if (!panel.contains(event.target as Node) && !btn.contains(event.target as Node)) {
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

  useEffect(() => {
    if (!provinceList.length || !hydrationRef.current) {
      return;
    }

    const selectedProvince = draft.location.province
      ? provinceList.find((item) => item.name === draft.location.province)
      : undefined;

    const derivedCities = selectedProvince
      ? (locations as any).cities.filter((item: any) => item.province === selectedProvince.key)
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

    let isMounted = true;

    const fetchMembers = async () => {
      try {
        setIsLoadingMembers(true);
        const response = await axios.post("/api/fetch-members", { orgID });
        if (isMounted) {
          setMembers(response.data || []);
        }
      } catch (error) {
        console.error("Failed to fetch members", error);
        if (isMounted) {
          errorToast("Unable to load members", 1600);
        }
      } finally {
        if (isMounted) {
          setIsLoadingMembers(false);
        }
      }
    };

    fetchMembers();

    return () => {
      isMounted = false;
    };
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
      (member) => member.memberId === matchingMember._id
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

  const handleProvinceSelect = (value: string) => {
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
  };

  const handleCitySelect = (value: string) => {
    updateDraft({
      location: {
        ...draft.location,
        city: value,
      },
    });
  };

  return (
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
          <div
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "#1f2937",
              marginBottom: "12px",
            }}
          >
            Basic Information
          </div>
          <div
            className={classNames(styles.inlineField, {
              [styles.errorField]: !draft.jobTitle && showErrors,
            })}
          >
            <label htmlFor="jobTitle">Job Title</label>
            <input
              id="jobTitle"
              placeholder="Enter job title"
              value={draft.jobTitle}
              onChange={(event) => updateDraft({ jobTitle: event.target.value })}
              className={classNames({
                [styles.errorInput]: !draft.jobTitle && showErrors,
              })}
            />
            {!draft.jobTitle && showErrors && (
              <div style={{ color: "#dc2626", fontSize: "12px", marginTop: "6px" }}>
                This is a required field.
              </div>
            )}
          </div>

          <div
            style={{
              marginTop: "16px",
              paddingTop: "16px",
              borderTop: "1px solid #e5e7eb",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                fontWeight: 500,
                color: "#6b7280",
                marginBottom: "12px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Work Setting
            </div>
            <div className={styles.fieldGrid}>
              <div
                className={classNames(styles.inlineField, {
                  [styles.errorField]: !draft.employmentType && showErrors,
                })}
              >
                <label>Employment Type</label>
                <CustomDropdown
                  screeningSetting={draft.employmentType}
                  settingList={EMPLOYMENT_TYPE_OPTIONS}
                  placeholder="Choose employment type"
                  onSelectSetting={(value: string) => updateDraft({ employmentType: value })}
                />
                {!draft.employmentType && showErrors && (
                  <div style={{ color: "#dc2626", fontSize: "12px", marginTop: "6px" }}>
                    This is a required field.
                  </div>
                )}
              </div>
              <div
                className={classNames(styles.inlineField, {
                  [styles.errorField]: !draft.workSetup && showErrors,
                })}
              >
                <label>Arrangement</label>
                <CustomDropdown
                  screeningSetting={draft.workSetup}
                  settingList={WORK_SETUP_OPTIONS}
                  placeholder="Choose work arrangement"
                  onSelectSetting={(value: string) => updateDraft({ workSetup: value })}
                />
                {!draft.workSetup && showErrors && (
                  <div style={{ color: "#dc2626", fontSize: "12px", marginTop: "6px" }}>
                    This is a required field.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: "16px",
              paddingTop: "16px",
              borderTop: "1px solid #e5e7eb",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                fontWeight: 500,
                color: "#6b7280",
                marginBottom: "12px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Location
            </div>
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
                  [styles.errorField]: !draft.location.province && showErrors,
                })}
              >
                <label>State / Province</label>
                <CustomDropdown
                  screeningSetting={draft.location.province}
                  placeholder="Choose state / province"
                  settingList={provinceList}
                  onSelectSetting={handleProvinceSelect}
                />
                {!draft.location.province && showErrors && (
                  <div style={{ color: "#dc2626", fontSize: "12px", marginTop: "6px" }}>
                    This is a required field.
                  </div>
                )}
              </div>
              <div
                className={classNames(styles.inlineField, {
                  [styles.errorField]: !draft.location.city && showErrors,
                })}
              >
                <label>City</label>
                <CustomDropdown
                  screeningSetting={draft.location.city}
                  placeholder="Choose city"
                  settingList={cityList}
                  onSelectSetting={handleCitySelect}
                />
                {!draft.location.city && showErrors && (
                  <div style={{ color: "#dc2626", fontSize: "12px", marginTop: "6px" }}>
                    This is a required field.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: "16px",
              paddingTop: "16px",
              borderTop: "1px solid #e5e7eb",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "#6b7280",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Salary
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "14px", color: "#6b7280" }}>Negotiable</span>
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
                  [styles.errorField]: !draft.salary.minimum && showErrors,
                })}
              >
                <label>Minimum Salary</label>
                <div className={styles.salaryInputControl}>
                  {currencyPrefixLabel && (
                    <span className={styles.currencyPrefix} aria-hidden="true">
                      {currencyPrefixLabel}
                    </span>
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
                      [styles.errorInput]: !draft.salary.minimum && showErrors,
                    })}
                  />
                  {renderCurrencyControl("minimum", minimumCurrencyDropdownRef)}
                </div>
                {!draft.salary.minimum && showErrors && (
                  <div style={{ color: "#dc2626", fontSize: "12px", marginTop: "6px" }}>
                    This is a required field.
                  </div>
                )}
              </div>
              <div
                className={classNames(styles.inlineField, styles.salaryInput, {
                  [styles.errorField]: !draft.salary.maximum && showErrors,
                })}
              >
                <label>Maximum Salary</label>
                <div className={styles.salaryInputControl}>
                  {currencyPrefixLabel && (
                    <span className={styles.currencyPrefix} aria-hidden="true">
                      {currencyPrefixLabel}
                    </span>
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
                      [styles.errorInput]: !draft.salary.maximum && showErrors,
                    })}
                  />
                  {renderCurrencyControl("maximum", maximumCurrencyDropdownRef)}
                </div>
                {!draft.salary.maximum && showErrors && (
                  <div style={{ color: "#dc2626", fontSize: "12px", marginTop: "6px" }}>
                    This is a required field.
                  </div>
                )}
              </div>
            </div>
            {draft.salary.minimum &&
              draft.salary.maximum &&
              Number(draft.salary.minimum) > Number(draft.salary.maximum) && (
                <div style={{ color: "#dc2626", fontSize: "12px", marginTop: "6px" }}>
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
              [styles.errorField]: showErrors && !isDescriptionPresent(draft.description),
            })}
          >
            <div className={styles.sectionHeading}>2. Job Description</div>
            <RichTextEditorComponent
              text={draft.description}
              setText={(value: string) => updateDraft({ description: value })}
            />
            {!isDescriptionPresent(draft.description) && showErrors && (
              <div style={{ color: "#dc2626", fontSize: "12px", marginTop: "6px" }}>
                Job description is required.
              </div>
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
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: "20px",
            }}
          >
            <div>
              <h4
                style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: 600, color: "#1f2937" }}
              >
                Add more members
              </h4>
              <p style={{ margin: "0", fontSize: "14px", color: "#6b7280" }}>
                You can add other members to collaborate on this career.
              </p>
            </div>
            <div style={{ position: "relative", minWidth: "320px" }}>
              <button
                id="member-picker-button"
                type="button"
                onClick={() => setIsMemberPickerOpen((value) => !value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: "#fff",
                  cursor: "pointer",
                  fontSize: "14px",
                  color: "#111827",
                }}
              >
                <span>Add member</span>
                <i className="la la-angle-down" style={{ color: "#6b7280" }}></i>
              </button>

              {isMemberPickerOpen && (
                <div
                  id="member-picker-panel"
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    right: 0,
                    width: 420,
                    maxHeight: 380,
                    display: "flex",
                    flexDirection: "column",
                    backgroundColor: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
                    zIndex: 60,
                  }}
                >
                  <div
                    style={{
                      padding: "12px",
                      borderBottom: "1px solid #e5e7eb",
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        border: "1px solid #e5e7eb",
                        borderRadius: 10,
                        padding: "8px 10px",
                        backgroundColor: "#fff",
                      }}
                    >
                      <i className="la la-search" style={{ color: "#9ca3af" }}></i>
                      <input
                        value={memberSearch}
                        onChange={(event) => setMemberSearch(event.target.value)}
                        placeholder="Search member"
                        style={{
                          border: "none",
                          outline: "none",
                          flex: 1,
                          fontSize: 14,
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
                    {availableMembers.length === 0 ? (
                      <div
                        style={{
                          padding: "16px 8px",
                          fontSize: 14,
                          color: "#6b7280",
                          textAlign: "center",
                        }}
                      >
                        {memberSearch.trim()
                          ? "No members match your search."
                          : "All available members are already added."}
                      </div>
                    ) : (
                      availableMembers.map((member) => (
                        <button
                          key={member._id}
                          type="button"
                          onClick={() => {
                            const didAdd = addMember(member._id);
                            if (didAdd) {
                              setIsMemberPickerOpen(false);
                              setMemberSearch("");
                            }
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            width: "100%",
                            textAlign: "left",
                            gap: 12,
                            padding: "10px 6px",
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          {member.image ? (
                            <img
                              src={member.image}
                              alt={member.name || member.email}
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: "50%",
                                objectFit: "cover",
                                flexShrink: 0,
                              }}
                            />
                          ) : (
                            <span
                              style={{
                                width: 36,
                                height: 36,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: "50%",
                                backgroundColor: "#e5e7eb",
                                fontSize: 12,
                                fontWeight: 600,
                                color: "#6b7280",
                                flexShrink: 0,
                              }}
                            >
                              {(member.name || member.email || "?").charAt(0)}
                            </span>
                          )}
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 15,
                                color: "#111827",
                                fontWeight: 600,
                                marginBottom: 2,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {member.name || "Member"}
                            </div>
                            <div
                              style={{
                                fontSize: 14,
                                color: "#6b7280",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {member.email}
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "16px" }}>
            {!hasJobOwner && teamMembers.length > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "16px",
                  color: "#dc2626",
                }}
              >
                <i className="la la-exclamation-triangle" style={{ color: "#dc2626", fontSize: "18px", flexShrink: 0 }}></i>
                <span style={{ fontSize: "12px", fontWeight: 500 }}>
                  Career must have a job owner. Please assign a job owner.
                </span>
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
            {teamMembers.map((member) => {
              const currentRoleLabel =
                MEMBER_ROLE_OPTIONS.find((option) => option.value === member.role)?.label ||
                "Select role";

              return (
                <div
                  key={member.memberId}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 0",
                    borderBottom: "1px solid #e5e7eb",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 }}
                  >
                    {member.image ? (
                      <img
                        src={member.image}
                        alt={member.name}
                        style={{ width: 48, height: 48, objectFit: "cover", borderRadius: "50%", flexShrink: 0 }}
                      />
                    ) : (
                      <span
                        style={{
                          width: 48,
                          height: 48,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: "50%",
                          backgroundColor: "#e5e7eb",
                          fontSize: "14px",
                          fontWeight: 600,
                          color: "#6b7280",
                          flexShrink: 0,
                        }}
                      >
                        {(member.name || member.email || "?").charAt(0)}
                      </span>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ display: "block", fontSize: "14px", color: "#1f2937" }}>
                        {member.name || "Member"}{" "}
                        {member.email === user?.email && (
                          <span style={{ color: "#6b7280", fontWeight: "normal" }}>(You)</span>
                        )}
                      </strong>
                      <span
                        title={member.email}
                        style={{
                          fontSize: "12px",
                          color: "#6b7280",
                          display: "block",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {member.email}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
                    <div style={{ position: "relative" }}>
                      <button
                        id={`role-button-${member.memberId}`}
                        type="button"
                        onClick={() =>
                          setOpenRoleMenuFor((prev) => (prev === member.memberId ? null : member.memberId))
                        }
                        style={{
                          padding: "8px 12px",
                          border: "2px solid #e5e7eb",
                          borderRadius: "6px",
                          fontSize: "14px",
                          backgroundColor: "#fff",
                          minWidth: "200px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "12px",
                        }}
                      >
                        <span style={{ color: "#111827", fontWeight: 500 }}>{currentRoleLabel}</span>
                        <i className="la la-angle-down" style={{ color: "#6b7280" }}></i>
                      </button>
                      {openRoleMenuFor === member.memberId && (
                        <div
                          id={`role-menu-${member.memberId}`}
                          style={{
                            position: "absolute",
                            top: "calc(100% + 8px)",
                            right: 0,
                            width: 360,
                            backgroundColor: "#fff",
                            border: "1px solid #e5e7eb",
                            borderRadius: 12,
                            boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
                            padding: 8,
                            zIndex: 50,
                          }}
                        >
                          {MEMBER_ROLE_OPTIONS.map((option) => {
                            const isSelected = member.role === option.value;
                            const label = option.label;
                            const description = ROLE_DESCRIPTIONS[label] || "";

                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                  updateMemberRole(member.memberId, option.value);
                                  setOpenRoleMenuFor(null);
                                }}
                                style={{
                                  display: "flex",
                                  alignItems: "flex-start",
                                  gap: 12,
                                  width: "100%",
                                  textAlign: "left",
                                  padding: "12px 14px",
                                  borderRadius: 10,
                                  border: "none",
                                  backgroundColor: isSelected ? "#eaf1ff" : "transparent",
                                  cursor: "pointer",
                                }}
                              >
                                <div style={{ flex: 1 }}>
                                  <div
                                    style={{
                                      fontSize: 14,
                                      fontWeight: 700,
                                      color: "#111827",
                                      marginBottom: 4,
                                    }}
                                  >
                                    {label}
                                  </div>
                                  {description && (
                                    <div style={{ fontSize: 13, lineHeight: "18px", color: "#6b7280" }}>
                                      {description}
                                    </div>
                                  )}
                                </div>
                                {isSelected && (
                                  <i className="la la-check" style={{ color: "#3b82f6", fontSize: 18 }}></i>
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
                      style={{
                        padding: "8px",
                        border: "none",
                        backgroundColor: "transparent",
                        cursor: "pointer",
                        color: "#d1d5db",
                        flexShrink: 0,
                      }}
                    >
                      <i className="la la-trash" style={{ fontSize: "18px" }}></i>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <p
            style={{
              fontSize: "12px",
              color: "#6b7280",
              marginTop: "16px",
              marginBottom: 0,
            }}
          >
            *Admins can view all careers regardless of specific access settings.
          </p>
        </div>
      </div>
    </>
  );
};

export default CareerDetailsTeamAccessStep;
