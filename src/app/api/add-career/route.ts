import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { guid } from "@/lib/Utils";
import { ObjectId } from "mongodb";
import {
  sanitizeCurrencyCode,
  sanitizeNumericInput,
  sanitizePlainText,
  sanitizeQuestionGroupsInput,
  sanitizeRichText,
  sanitizeTeamMembersInput,
  sanitizeUserReference,
} from "@/lib/utils/sanitize";

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    if (!payload || typeof payload !== "object") {
      return NextResponse.json(
        { error: "Invalid request payload" },
        { status: 400 }
      );
    }

    const jobTitle = sanitizePlainText((payload as Record<string, unknown>).jobTitle, {
      maxLength: 180,
    });
    const descriptionHtml = sanitizeRichText(
      (payload as Record<string, unknown>).description,
      { maxLength: 20000 }
    );
    const questions = sanitizeQuestionGroupsInput(
      (payload as Record<string, unknown>).questions
    );
    const location = sanitizePlainText(
      (payload as Record<string, unknown>).location,
      { maxLength: 180 }
    );
    const workSetup = sanitizePlainText(
      (payload as Record<string, unknown>).workSetup,
      { maxLength: 120 }
    );
    const orgID = sanitizePlainText((payload as Record<string, unknown>).orgID, {
      maxLength: 48,
    });

    if (!jobTitle || !descriptionHtml || !location || !workSetup) {
      return NextResponse.json(
        {
          error:
            "Job title, description, location and work setup are required",
        },
        { status: 400 }
      );
    }

    if (!Array.isArray((payload as Record<string, unknown>).questions)) {
      return NextResponse.json(
        { error: "Questions payload is invalid" },
        { status: 400 }
      );
    }

    if (!orgID || !ObjectId.isValid(orgID)) {
      return NextResponse.json(
        { error: "A valid organization id is required" },
        { status: 400 }
      );
    }

    const descriptionText = sanitizePlainText(descriptionHtml, {
      maxLength: 20000,
      allowEmpty: true,
      preserveLineBreaks: true,
    });

    if (!descriptionText) {
      return NextResponse.json(
        { error: "Description cannot be empty after sanitization" },
        { status: 400 }
      );
    }

    const workSetupRemarks = sanitizePlainText(
      (payload as Record<string, unknown>).workSetupRemarks,
      { maxLength: 2000, allowEmpty: true, preserveLineBreaks: true }
    );
    const screeningSetting = sanitizePlainText(
      (payload as Record<string, unknown>).screeningSetting,
      { maxLength: 120, allowEmpty: true }
    );
    const country = sanitizePlainText(
      (payload as Record<string, unknown>).country,
      { maxLength: 120, allowEmpty: true }
    );
    const province = sanitizePlainText(
      (payload as Record<string, unknown>).province,
      { maxLength: 120, allowEmpty: true }
    );
    const employmentType = sanitizePlainText(
      (payload as Record<string, unknown>).employmentType,
      { maxLength: 120, allowEmpty: true }
    );
    const cvSecretPrompt = sanitizePlainText(
      (payload as Record<string, unknown>).cvSecretPrompt,
      { maxLength: 5000, allowEmpty: true, preserveLineBreaks: true }
    );
    const aiInterviewSecretPrompt = sanitizePlainText(
      (payload as Record<string, unknown>).aiInterviewSecretPrompt,
      { maxLength: 5000, allowEmpty: true, preserveLineBreaks: true }
    );

    const lastEditedBy = sanitizeUserReference(
      (payload as Record<string, unknown>).lastEditedBy
    ) || undefined;
    const createdBy = sanitizeUserReference(
      (payload as Record<string, unknown>).createdBy
    ) || undefined;
    const teamMembers = sanitizeTeamMembersInput(
      (payload as Record<string, unknown>).teamMembers
    );

    const salaryNegotiableRaw = (payload as Record<string, unknown>).salaryNegotiable;
    const salaryNegotiable =
      typeof salaryNegotiableRaw === "boolean"
        ? salaryNegotiableRaw
        : String(salaryNegotiableRaw).toLowerCase() === "true";

    const minimumSalary = sanitizeNumericInput(
      (payload as Record<string, unknown>).minimumSalary,
      { min: 0 }
    );
    const maximumSalary = sanitizeNumericInput(
      (payload as Record<string, unknown>).maximumSalary,
      { min: 0 }
    );

    if (
      minimumSalary !== null &&
      maximumSalary !== null &&
      maximumSalary < minimumSalary
    ) {
      return NextResponse.json(
        { error: "Maximum salary cannot be less than minimum salary" },
        { status: 400 }
      );
    }

    const salaryCurrency = sanitizeCurrencyCode(
      (payload as Record<string, unknown>).salaryCurrency
    );

    const rawStatus = sanitizePlainText(
      (payload as Record<string, unknown>).status,
      { maxLength: 16, allowEmpty: true }
    ).toLowerCase();
    const allowedStatuses = new Set(["active", "inactive", "draft"]);
    const status = allowedStatuses.has(rawStatus) ? rawStatus : "active";

    const requireVideoRaw = (payload as Record<string, unknown>).requireVideo;
    const requireVideo =
      typeof requireVideoRaw === "boolean"
        ? requireVideoRaw
        : String(requireVideoRaw).toLowerCase() === "true";

    const { db } = await connectMongoDB();

    const orgDetails = await db.collection("organizations").aggregate([
      {
        $match: {
          _id: new ObjectId(orgID)
        }
      },
      {
        $lookup: {
            from: "organization-plans",
            let: { planId: "$planId" },
            pipeline: [
                {
                    $addFields: {
                        _id: { $toString: "$_id" }
                    }
                },
                {
                    $match: {
                        $expr: { $eq: ["$_id", "$$planId"] }
                    }
                }
            ],
            as: "plan"
        }
      },
      {
        $unwind: "$plan"
      },
    ]).toArray();

    if (!orgDetails || orgDetails.length === 0) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const totalActiveCareers = await db.collection("careers").countDocuments({ orgID, status: "active" });

    if (totalActiveCareers >= (orgDetails[0].plan.jobLimit + (orgDetails[0].extraJobSlots || 0))) {
      return NextResponse.json({ error: "You have reached the maximum number of jobs for your plan" }, { status: 400 });
    }

    const career = {
      id: guid(),
      jobTitle,
      description: descriptionHtml,
      questions,
      location,
      workSetup,
      workSetupRemarks,
      cvSecretPrompt,
      aiInterviewSecretPrompt,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastEditedBy,
      createdBy,
      status,
      screeningSetting,
      orgID,
      lastActivityAt: new Date(),
      salaryNegotiable,
      minimumSalary,
      maximumSalary,
      country,
      province,
      employmentType,
      salaryCurrency,
      teamMembers,
      team: {
        members: teamMembers,
      },
    };

    if (typeof requireVideoRaw !== "undefined") {
      (career as Record<string, unknown>).requireVideo = requireVideo;
    }

    await db.collection("careers").insertOne(career);

    return NextResponse.json({
      message: "Career added successfully",
      career,
    });
  } catch (error) {
    console.error("Error adding career:", error);
    return NextResponse.json(
      { error: "Failed to add career" },
      { status: 500 }
    );
  }
}
