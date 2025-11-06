const path = require("path");
const { MongoClient } = require("mongodb");

require("dotenv").config({ path: path.resolve(process.cwd(), ".env.local") });

const {
  MONGODB_URI,
  MONGODB_DB,
  SEED_ADMIN_EMAIL="nalmontero.dev@gmail.com",
  SEED_ADMIN_NAME = "Admin User",
  SEED_ADMIN_FIREBASE_UID,
  SEED_ADMIN_IMAGE,
  SEED_ORG_NAME = "Seeded Demo Organization",
  SEED_ORG_DESCRIPTION,
  SEED_ORG_TIER = "enterprise",
  SEED_ORG_COUNTRY = "Philippines",
  SEED_ORG_PROVINCE = "Metro Manila",
  SEED_ORG_CITY = "Taguig",
  SEED_ORG_ADDRESS = "Bonifacio Global City, Taguig",
  SEED_PLAN_NAME = "seed-demo-plan",
  SEED_PLAN_JOB_LIMIT,
} = process.env;

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI is not defined. Please add it to your .env.local file.");
  process.exit(1);
}

if (!SEED_ADMIN_FIREBASE_UID) {
  console.error(
    "❌ SEED_ADMIN_FIREBASE_UID is not defined. Add the Firebase UID of your admin account to .env.local before running this script."
  );
  process.exit(1);
}

const DEFAULT_DB_NAME = "jia-db";

function extractDbName(uri) {
  try {
    const match = uri.match(/\/([^/?]+)(?:\?|$)/);
    return match && match[1] ? match[1] : null;
  } catch (error) {
    return null;
  }
}

const dbName = MONGODB_DB || extractDbName(MONGODB_URI) || DEFAULT_DB_NAME;

const adminProfile = {
  email: SEED_ADMIN_EMAIL.toLowerCase(),
  name: SEED_ADMIN_NAME,
  firebaseUID: SEED_ADMIN_FIREBASE_UID,
};

adminProfile.image =
  SEED_ADMIN_IMAGE ||
  `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(adminProfile.name || "Admin User")}`;

const organizationAssets = {
  image: `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(
    SEED_ORG_NAME
  )}`,
  coverImage: "",
};

const parsedJobLimit = Number(SEED_PLAN_JOB_LIMIT);
const planJobLimit = Number.isFinite(parsedJobLimit) && parsedJobLimit > 0 ? parsedJobLimit : 10;

async function ensurePlan(db, timestamp) {
  const collection = db.collection("organization-plans");
  const existingPlan = await collection.findOne({ name: SEED_PLAN_NAME });

  if (existingPlan) {
    if ((existingPlan.jobLimit || 0) !== planJobLimit) {
      await collection.updateOne(
        { _id: existingPlan._id },
        {
          $set: {
            jobLimit: planJobLimit,
            updatedAt: timestamp,
          },
        }
      );
    }

    return { planId: existingPlan._id.toString(), created: false };
  }

  const { insertedId } = await collection.insertOne({
    name: SEED_PLAN_NAME,
    description: "Seeded plan for local development",
    jobLimit: planJobLimit,
    monthlyPrice: 0,
    currency: "PHP",
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return { planId: insertedId.toString(), created: true };
}

async function ensureOrganization(db, planId, timestamp) {
  const organizations = db.collection("organizations");
  const baseUser = {
    email: adminProfile.email,
    name: adminProfile.name,
    image: adminProfile.image,
  };

  const existingOrg = await organizations.findOne({ name: SEED_ORG_NAME });
  const isCreating = !existingOrg;

  const updateData = {
    $set: {
      description:
        SEED_ORG_DESCRIPTION ||
        "Seeded organization for local development. Update details from the admin portal.",
      status: "active",
      tier: SEED_ORG_TIER,
      planId,
      extraJobSlots: 0,
      country: SEED_ORG_COUNTRY,
      province: SEED_ORG_PROVINCE,
      city: SEED_ORG_CITY,
      address: SEED_ORG_ADDRESS,
      updatedAt: timestamp,
      image: organizationAssets.image,
      coverImage: organizationAssets.coverImage,
      documents: [],
      lastEditedBy: baseUser,
    },
  };

  if (isCreating) {
    updateData.$set.creator = adminProfile.email;
    updateData.$set.name = SEED_ORG_NAME;
    updateData.$set.createdAt = timestamp;
    updateData.$set.createdBy = baseUser;
  }

  const updateResult = await organizations.updateOne(
    { name: SEED_ORG_NAME },
    updateData,
    { upsert: true }
  );

  if (!updateResult.acknowledged) {
    throw new Error("Failed to create or update the organization document.");
  }

  const org = await organizations.findOne({ name: SEED_ORG_NAME });
  if (!org) {
    throw new Error("Failed to retrieve organization after upsert.");
  }

  return {
    orgId: org._id.toString(),
    created: isCreating,
  };
}

async function ensureAdmin(db, orgId, timestamp) {
  const admins = db.collection("admins");

  await admins.updateOne(
    { email: adminProfile.email },
    {
      $set: {
        name: adminProfile.name,
        firebaseUID: adminProfile.firebaseUID,
        role: "super_admin",
        status: "active",
        image: adminProfile.image,
        lastSeen: timestamp,
        updatedAt: timestamp,
      },
      $setOnInsert: {
        createdAt: timestamp,
      },
      $addToSet: {
        organizations: orgId,
      },
    },
    { upsert: true }
  );
}

async function ensureMember(db, orgId, timestamp) {
  const members = db.collection("members");

  await members.updateOne(
    { email: adminProfile.email, orgID: orgId },
    {
      $set: {
        image: adminProfile.image,
        name: adminProfile.name,
        role: "super_admin",
        lastLogin: timestamp,
        status: "joined",
      },
      $setOnInsert: {
        orgID: orgId,
        careers: [],
        addedAt: timestamp,
      },
    },
    { upsert: true }
  );
}

async function removeApplicantRecord(db) {
  const collections = await db
    .listCollections({ name: "applicants" }, { nameOnly: true })
    .toArray();

  if (!collections.length) {
    return;
  }

  await db.collection("applicants").deleteMany({ email: adminProfile.email });
}

async function seedAdmin() {
  const client = new MongoClient(MONGODB_URI);

  try {
    console.log(`📦 Connecting to MongoDB database "${dbName}"...`);
    await client.connect();

    const db = client.db(dbName);
    const timestamp = new Date();

    const { planId, created: planCreated } = await ensurePlan(db, timestamp);
    console.log(
      planCreated
        ? `✅ Organization plan "${SEED_PLAN_NAME}" created with job limit ${planJobLimit}.`
        : `ℹ️ Organization plan "${SEED_PLAN_NAME}" already exists.`
    );

    const { orgId, created: orgCreated } = await ensureOrganization(db, planId, timestamp);
    console.log(
      orgCreated
        ? `✅ Organization "${SEED_ORG_NAME}" created.`
        : `ℹ️ Organization "${SEED_ORG_NAME}" upserted.`
    );

    await ensureAdmin(db, orgId, timestamp);
    console.log(`✅ Admin document ensured for ${adminProfile.email}.`);

    await ensureMember(db, orgId, timestamp);
    console.log(`✅ Membership ensured for ${adminProfile.email} in organization ${orgId}.`);

    await removeApplicantRecord(db);
    console.log(`🧹 Removed applicant record(s) for ${adminProfile.email} to avoid role conflicts.`);

    console.log("🎉 Admin seed complete. You can now sign in with Google using the seeded account.");
  } catch (error) {
    console.error("❌ Failed to seed admin:", error);
    process.exitCode = 1;
  } finally {
    await client.close();
    console.log("🔌 MongoDB connection closed.");
  }
}

seedAdmin();
