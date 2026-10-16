import { useEffect, useState } from "react";
import { currentSystemDate, EMPTY_PERIOD, type PeriodSelection } from "@/lib/period";

export function useInitialTodayPeriod() {
  const [period, setPeriod] = useState<PeriodSelection>({ ...EMPTY_PERIOD, kind: "day" });

  useEffect(() => {
    setPeriod({ ...EMPTY_PERIOD, kind: "day", date: currentSystemDate() });
  }, []);

  return [period, setPeriod] as const;
}