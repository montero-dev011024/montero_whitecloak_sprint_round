import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";

export async function POST(request: Request) {
  try {
    let requestData = await request.json();
    const { _id } = requestData;

    // Validate required fields
    if (!_id) {
      return NextResponse.json(
        { error: "Job Object ID is required" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    let dataUpdates = { ...requestData };

    delete dataUpdates._id;

    const career: Record<string, any> = { ...dataUpdates };

    if (typeof dataUpdates.salaryCurrency === "string") {
      career.salaryCurrency = dataUpdates.salaryCurrency.toUpperCase();
    }

    if (Object.prototype.hasOwnProperty.call(dataUpdates, "teamMembers")) {
      const normalizedMembers = Array.isArray(dataUpdates.teamMembers)
        ? dataUpdates.teamMembers
        : [];
      career.teamMembers = normalizedMembers;
      career.team = { members: normalizedMembers };
    }

    if (
      !Object.prototype.hasOwnProperty.call(career, "teamMembers") &&
      Object.prototype.hasOwnProperty.call(dataUpdates, "team") &&
      Array.isArray(dataUpdates.team?.members)
    ) {
      career.teamMembers = dataUpdates.team.members;
      career.team = { members: dataUpdates.team.members };
    }

    await db
      .collection("careers")
      .updateOne({ _id: new ObjectId(_id) }, { $set: career });

    return NextResponse.json({
      message: "Career updated successfully",
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
