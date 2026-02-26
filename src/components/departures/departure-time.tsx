"use client";

import { cn } from "@/lib/utils";
import {
  formatTime,
  secondsUntil,
  formatTimeRemaining,
  formatDelay,
} from "@/lib/gtfs/time-utils";

interface DepartureTimeProps {
  scheduledTime: Date;
  predictedTime?: Date;
  isRealtime: boolean;
  isCancelled?: boolean;
}

export function DepartureTime({
  scheduledTime,
  predictedTime,
  isRealtime,
  isCancelled,
}: DepartureTimeProps) {
  const displayTime = predictedTime || scheduledTime;
  const secondsRemaining = secondsUntil(displayTime);
  const delaySeconds = predictedTime
    ? Math.round((predictedTime.getTime() - scheduledTime.getTime()) / 1000)
    : 0;

  if (isCancelled) {
    return (
      <div className="text-right tabular-nums">
        <span className="text-destructive font-semibold line-through">
          {formatTime(scheduledTime)}
        </span>
        <span className="mt-0.5 block text-xs text-destructive font-semibold">
          Inställd
        </span>
      </div>
    );
  }

  // Show relative time for departures within 10 minutes
  const isSoon = secondsRemaining <= 600 && secondsRemaining >= 0;
  const timeClassName = isSoon
    ? "text-xl font-bold leading-none"
    : "text-base font-semibold";
  const timeLabel = isSoon
    ? formatTimeRemaining(secondsRemaining)
    : formatTime(displayTime);

  return (
    <div className="text-right tabular-nums">
      <span
        className={cn(
          timeClassName,
          isRealtime ? "text-green-600 dark:text-green-400" : "",
        )}
      >
        {timeLabel}
      </span>
      {(delaySeconds > 20 || delaySeconds < -20) && (
        <span
          className={cn(
            "mt-0.5 block text-xs font-medium",
            delaySeconds > 0
              ? "text-orange-600 dark:text-orange-400"
              : "text-green-600 dark:text-green-400",
          )}
        >
          {formatDelay(delaySeconds)}
        </span>
      )}
    </div>
  );
}
