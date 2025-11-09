"use strict";

const path = require("path");
const { MongoClient, ObjectId } = require("mongodb");

require("dotenv").config({ path: path.resolve(process.cwd(), ".env.local") });

const {
  MONGODB_URI,
  MONGODB_DB,
  SEED_ORG_NAME = "Seeded Demo Organization",
} = process.env;

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI is not defined. Please add it to your .env.local file.");
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

const MEMBER_SEED_DATA = [
  {
    name: "Avery Ruiz",
    email: "avery.ruiz@example.com",
    role: "job_owner",
    status: "joined",
    image: "https://i.pravatar.cc/300?img=12",
  },
  {
    name: "Noah Santiago",
    email: "noah.santiago@example.com",
    role: "collaborator",
    status: "joined",
    image: "https://i.pravatar.cc/300?img=22",
  },
  {
    name: "Isla Ramos",
    email: "isla.ramos@example.com",
    role: "viewer",
    status: "joined",
    image: "https://i.pravatar.cc/300?img=32",
  },
  {
    name: "Theo Cruz",
    email: "theo.cruz@example.com",
    role: "collaborator",
    status: "invited",
    image: "https://i.pravatar.cc/300?img=42",
  },
  {
    name: "Maya Dizon",
    email: "maya.dizon@example.com",
    role: "viewer",
    status: "joined",
    image: "https://i.pravatar.cc/300?img=52",
  },
];

function buildMemberDocument(seed, orgId, timestamp) {
  return {
    _id: new ObjectId(),
    orgID: orgId,
    email: seed.email.toLowerCase(),
    name: seed.name,
    image:
      seed.image ||
      `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(seed.name || seed.email)}`,
    role: seed.role,
    status: seed.status,
    careers: [],
    addedAt: timestamp,
    lastLogin: seed.status === "joined" ? timestamp : null,
    updatedAt: timestamp,
  };
}

async function seedMembers() {
  const client = new MongoClient(MONGODB_URI);

  try {
    console.log(`📦 Connecting to MongoDB database "${dbName}"...`);
    await client.connect();
    const db = client.db(dbName);

    const organizations = db.collection("organizations");
    const members = db.collection("members");

    const organization = await organizations.findOne({ name: SEED_ORG_NAME });

    if (!organization) {
      throw new Error(
        `Organization "${SEED_ORG_NAME}" not found. Run scripts/seed-admin.js first or update SEED_ORG_NAME.`
      );
    }

    const orgId = organization._id.toString();
    const timestamp = new Date();
    const targetEmails = MEMBER_SEED_DATA.map((member) => member.email.toLowerCase());

    const existingMembers = await members
      .find({ orgID: orgId, email: { $in: targetEmails } })
      .toArray();

    const existingByEmail = new Map(existingMembers.map((doc) => [doc.email, doc]));

    let insertedCount = 0;
    let updatedCount = 0;

    for (const seed of MEMBER_SEED_DATA) {
      const email = seed.email.toLowerCase();
      const existing = existingByEmail.get(email);

      if (existing) {
        await members.updateOne(
          { _id: existing._id },
          {
            $set: {
              name: seed.name,
              role: seed.role,
              status: seed.status,
              image:
                seed.image ||
                existing.image ||
                `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(seed.name || email)}`,
              updatedAt: timestamp,
              lastLogin: seed.status === "joined" ? existing.lastLogin || timestamp : existing.lastLogin,
            },
            $setOnInsert: {
              orgID: orgId,
              careers: [],
              addedAt: timestamp,
            },
          },
          { upsert: true }
        );
        updatedCount += 1;
        continue;
      }

      const doc = buildMemberDocument(seed, orgId, timestamp);
      await members.insertOne(doc);
      insertedCount += 1;
    }

    console.log(
      `🎯 Seeded members for organization "${SEED_ORG_NAME}" (orgID: ${orgId}). Inserted: ${insertedCount}, Updated: ${updatedCount}`
    );
  } catch (error) {
    console.error("❌ Failed to seed members:", error);
    process.exitCode = 1;
  } finally {
    await client.close();
    console.log("🔌 MongoDB connection closed.");
  }
}

seedMembers();
