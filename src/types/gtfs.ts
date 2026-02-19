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
export function routeTypeColor(
  routeType: RouteType,
  route: number = 0,
): {
  bg: string;
  text: string;
} {
  if (routeType === RouteType.Bus) {
    return { bg: "#444455", text: "#FFFFFF" };
  } else if (routeType === RouteType.Train) {
    return { bg: "#F266A6", text: "#FFFFFF" };
  } else if (routeType === RouteType.Metro) {
    if (route === 10 || route === 11) {
      return { bg: "#0089CA", text: "#FFFFFF" };
    } else if (route === 13 || route === 14) {
      return { bg: "#D71D24", text: "#FFFFFF" };
    }
    return { bg: "#17944D", text: "#FFFFFF" };
  } else if (routeType === RouteType.Tram) {
    if (route === 7) {
      return { bg: "#878A83", text: "#FFFFFF" };
    } else if (route === 12) {
      return { bg: "#C0C0C0", text: "#FFFFFF" };
    } else if (route === 21) {
      return { bg: "#B4792B", text: "#FFFFFF" };
    } else if (route === 30 || route === 31) {
      return { bg: "#985141", text: "#FFFFFF" };
    } else if (route === 25 || route === 26) {
      return { bg: "#008F93", text: "#FFFFFF" };
    } else if (route >= 27 && route <= 29) {
      return { bg: "#9F599A", text: "#FFFFFF" };
    }
    return { bg: "#985141", text: "#FFFFFF" };
  } else if (routeType === RouteType.Ferry) {
    return { bg: "#0891B2", text: "#FFFFFF" };
  } else if (routeType === RouteType.Taxi) {
    return { bg: "#F59E0B", text: "#000000" };
  }

  return { bg: "#6B7280", text: "#FFFFFF" };
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
