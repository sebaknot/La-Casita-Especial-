"use client";

import { createContext, useContext, useMemo } from "react";
import type { Person } from "@/lib/types";

interface HouseholdValue {
  people: Person[];
  personById: (id: string | null | undefined) => Person | null;
  today: string;
  timezone: string;
}

const HouseholdContext = createContext<HouseholdValue>({
  people: [],
  personById: () => null,
  today: "",
  timezone: "America/New_York",
});

export function HouseholdProvider({
  people,
  today,
  timezone,
  children,
}: {
  people: Person[];
  today: string;
  timezone: string;
  children: React.ReactNode;
}) {
  const value = useMemo(() => {
    const map = new Map(people.map((person) => [person.id, person]));
    return { people, personById: (id: string | null | undefined) => (id ? (map.get(id) ?? null) : null), today, timezone };
  }, [people, today, timezone]);
  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}

export function useHousehold(): HouseholdValue {
  return useContext(HouseholdContext);
}
