"use client";

import { cn } from "@/lib/utils";
import {
  formatTime,
  secondsUntil,
  formatTimeRemaining,
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
  const delayMinutes = predictedTime
    ? Math.round((predictedTime.getTime() - scheduledTime.getTime()) / 60000)
    : 0;

  if (isCancelled) {
    return (
      <div className="text-right">
        <span className="text-destructive font-medium line-through">
          {formatTime(scheduledTime)}
        </span>
        <span className="block text-xs text-destructive font-medium">
          Inställd
        </span>
      </div>
    );
  }

  // Show relative time for departures within 10 minutes
  if (secondsRemaining <= 600 && secondsRemaining >= 0) {
    return (
      <div className="text-right">
        <span
          className={cn(
            "font-semibold text-lg",
            isRealtime ? "text-green-600 dark:text-green-400" : "",
          )}
        >
          {formatTimeRemaining(secondsRemaining)}
        </span>
        {delayMinutes !== 0 && (
          <span
            className={cn(
              "block text-xs",
              delayMinutes > 0
                ? "text-orange-600 dark:text-orange-400"
                : "text-green-600 dark:text-green-400",
            )}
          >
            {delayMinutes > 0 ? `+${delayMinutes}` : delayMinutes} min
          </span>
        )}
      </div>
    );
  }

  // Show absolute time for later departures
  return (
    <div className="text-right">
      <span
        className={cn(
          "font-medium",
          isRealtime ? "text-green-600 dark:text-green-400" : "",
        )}
      >
        {formatTime(displayTime)}
      </span>
      {delayMinutes !== 0 && (
        <span
          className={cn(
            "block text-xs",
            delayMinutes > 0
              ? "text-orange-600 dark:text-orange-400"
              : "text-green-600 dark:text-green-400",
          )}
        >
          {delayMinutes > 0 ? `+${delayMinutes}` : delayMinutes} min
        </span>
      )}
    </div>
  );
}
