"use client";

import { useEffect, useState } from "react";

const usePreScreenMenu = () => {
  const [openPreScreenTypeFor, setOpenPreScreenTypeFor] = useState<string | null>(null);

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

  return {
    openPreScreenTypeFor,
    setOpenPreScreenTypeFor,
  };
};

export default usePreScreenMenu;

