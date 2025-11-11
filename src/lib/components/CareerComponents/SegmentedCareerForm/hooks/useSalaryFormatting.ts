"use client";

import { useCallback, useMemo } from "react";

import { CURRENCY_SYMBOLS } from "../constants";
import type { CareerFormDraft } from "@/lib/hooks/useSegmentedCareerFormState";

const useSalaryFormatting = (salary: CareerFormDraft["salary"]) => {
  const selectedCurrency = useMemo(() => {
    const currency = salary?.currency;
    if (currency && currency.trim().length > 0) {
      return currency;
    }
    return "PHP";
  }, [salary?.currency]);

  const currencySymbol = useMemo(() => {
    return CURRENCY_SYMBOLS[selectedCurrency] || "";
  }, [selectedCurrency]);

  const currencyPrefixLabel = currencySymbol || selectedCurrency;

  const formatSalaryValue = useCallback(
    (value: string) => {
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
    },
    [currencySymbol, selectedCurrency]
  );

  const minimumSalaryDisplay = salary.isNegotiable
    ? "Negotiable"
    : formatSalaryValue(salary.minimum);
  const maximumSalaryDisplay = salary.isNegotiable
    ? "Negotiable"
    : formatSalaryValue(salary.maximum);

  return {
    selectedCurrency,
    currencySymbol,
    currencyPrefixLabel,
    formatSalaryValue,
    minimumSalaryDisplay,
    maximumSalaryDisplay,
  };
};

export default useSalaryFormatting;

