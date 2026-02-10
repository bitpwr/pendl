// GTFS Static Data Types

export interface Agency {
  agencyId: string;
  agencyName: string;
  agencyUrl?: string;
  agencyTimezone: string;
  agencyLang?: string;
  agencyPhone?: string;
}

export interface Stop {
  stopId: string;
  stopName: string;
  stopLat: number;
  stopLon: number;
  locationType: number;
  parentStation?: string;
  platformCode?: string;
}

export interface Route {
  routeId: string;
  agencyId?: string;
  routeShortName?: string;
  routeLongName?: string;
  routeDesc?: string;
  routeType: RouteType;
}

export enum RouteType {
  Tram = 0,
  Metro = 1,
  Train = 2,
  Bus = 3,
  Ferry = 4,
  Taxi = 5,
}

/**
 * Get the display colors for a route type
 * Returns background and text colors for consistent styling
 */
export function routeTypeColor(routeType: RouteType): {
  bg: string;
  text: string;
} {
  const colors: Record<RouteType, { bg: string; text: string }> = {
    [RouteType.Tram]: { bg: "#6B7280", text: "#FFFFFF" },
    [RouteType.Metro]: { bg: "#1F2937", text: "#FFFFFF" },
    [RouteType.Train]: { bg: "#7C3AED", text: "#FFFFFF" },
    [RouteType.Bus]: { bg: "#2563EB", text: "#FFFFFF" },
    [RouteType.Ferry]: { bg: "#0891B2", text: "#FFFFFF" },
    [RouteType.Taxi]: { bg: "#F59E0B", text: "#000000" },
  };
  return colors[routeType] ?? { bg: "#6B7280", text: "#FFFFFF" };
}

export function routeTypeName(routeType: RouteType): string {
  switch (routeType) {
    case RouteType.Tram:
      return "Spårvagn";
    case RouteType.Metro:
      return "Tunnelbana";
    case RouteType.Train:
      return "Pendeltåg";
    case RouteType.Bus:
      return "Buss";
    case RouteType.Ferry:
      return "Båt";
    case RouteType.Taxi:
      return "Taxi";
    default:
      return "Okänd";
  }
}

/**
 * Convert numeric route type from database to RouteType enum
 * Maps SL-specific codes to standardized types
 */
export function toRouteType(value: number): RouteType {
  // Train types (100-110)
  if (value >= 100 && value <= 110) {
    return RouteType.Train;
  }

  switch (value) {
    case 0: // Standard GTFS Tram
    case 900: // SL Tram
      return RouteType.Tram;

    case 1: // Standard GTFS Subway
    case 401: // SL Metro
      return RouteType.Metro;

    case 2: // Standard GTFS Rail
      return RouteType.Train;

    case 3: // Standard GTFS Bus
    case 700: // SL Bus
    case 714: // SL Bus
      return RouteType.Bus;

    case 4: // Standard GTFS Ferry
    case 1000: // SL Ferry
      return RouteType.Ferry;

    case 1501: // SL Taxi
      return RouteType.Taxi;

    default:
      return RouteType.Bus; // Default fallback
  }
}

export interface Calendar {
  serviceId: string;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  startDate: Date;
  endDate: Date;
}

export interface CalendarDate {
  serviceId: string;
  date: Date;
  exceptionType: 1 | 2; // 1 = added, 2 = removed
}

export interface Trip {
  tripId: string;
  routeId: string;
  serviceId: string;
  tripHeadsign?: string;
  tripShortName?: string;
  directionId?: number;
  blockId?: string;
  shapeId?: string;
  wheelchairAccessible?: number;
  bikesAllowed?: number;
}

export interface StopTime {
  tripId: string;
  arrivalTime: string; // HH:MM:SS format (can exceed 24:00:00)
  departureTime: string;
  stopId: string;
  stopSequence: number;
  stopHeadsign?: string;
  pickupType?: number;
  dropOffType?: number;
  timepoint?: number;
}

export interface Shape {
  shapeId: string;
  shapePtLat: number;
  shapePtLon: number;
  shapePtSequence: number;
  shapeDistTraveled?: number;
}
