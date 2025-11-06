"use client";

import React from "react";
import HeaderBar from "@/lib/PageComponent/HeaderBar";
import SegmentedCareerForm from "@/lib/components/CareerComponents/SegmentedCareerForm";

export default function NewCareerPage() {
  return (
    <>
      <HeaderBar
        activeLink="Careers"
        currentPage="Add new career"
        icon="la la-suitcase"
      />
      <div className="container-fluid mt--7" style={{ paddingTop: "6rem" }}>
        <SegmentedCareerForm formType="add" />
      </div>
    </>
  );
}
