"use client";

import { useEffect, useState, useMemo, useCallback, memo, useRef } from "react";
import * as L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  CircleMarker,
  Polyline,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Locate } from "lucide-react";
import type { Marker as LeafletMarker } from "leaflet";
import type { Vehicle } from "@/types/api";
import { routeTypeColor, routeTypeName, RouteType } from "@/types/gtfs";
import { createVehicleLeafletIcon } from "./vehicle-arrow-icon";
import { getAgencyMapConfig, getAgencyRouteTypes } from "@/lib/config/agencies";
import { filterToViewport, type MapViewport } from "./viewport";
import {
  MAX_ANIMATED_DEGREES,
  POSITION_ANIMATION_MS,
  interpolate,
  prefersReducedMotion,
  samePosition,
  shouldSnap,
  type Position,
} from "./marker-animation";

export interface VehicleMapInnerProps {
  center?: [number, number];
  zoom?: number;
  height?: string;
  agencyId?: string;
}

function vehicleType(routeType: RouteType | null): string {
  switch (routeType) {
    case RouteType.Metro:
    case RouteType.Train:
      return "tåg";
    case RouteType.Bus:
      return "bussar";
    case RouteType.Tram:
      return "spårvagnar";
    case RouteType.Ferry:
      return "båtar";
    default:
      return "fordon";
  }
}

function vehicleTitle(vehicle: Vehicle): string {
  if (vehicle.routeName !== vehicle.headsign) {
    return vehicle.headsign;
  }

  return `${routeTypeName(vehicle.routeType)} ${vehicle.routeName}`;
}

const LIGHTWEIGHT_VISIBLE_MARKERS_THRESHOLD = 200;
const POLL_INTERVAL_MS = 2000;

export default function VehicleMapInner({
  center,
  zoom,
  height = "400px",
  agencyId,
}: VehicleMapInnerProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>();
  const [mapCenter, setMapCenter] = useState<[number, number]>(() => {
    const config = getAgencyMapConfig(agencyId);
    return center ?? config.center;
  });
  const [agencyZoom, setAgencyZoom] = useState(() => {
    const config = getAgencyMapConfig(agencyId);
    return zoom ?? config.zoom;
  });
  const [agencyChangeKey, setAgencyChangeKey] = useState(0);
  const [selectedRouteType, setSelectedRouteType] = useState<RouteType | null>(
    null,
  );
  const [locateKey, setLocateKey] = useState(0);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null,
  );
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(
    null,
  );
  const [tripShape, setTripShape] = useState<{
    vehicleId: string;
    coordinates: [number, number][];
  } | null>(null);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [mapViewport, setMapViewport] = useState<MapViewport | null>(null);
  const isMapInteractingRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mobileMediaQuery = window.matchMedia("(max-width: 1024px)");

    const detectMobileDevice = () => {
      const userAgentDataMobile =
        typeof navigator !== "undefined" && "userAgentData" in navigator
          ? (
              navigator as Navigator & {
                userAgentData?: { mobile?: boolean };
              }
            ).userAgentData?.mobile === true
          : false;

      const userAgentMobile =
        typeof navigator !== "undefined" &&
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent,
        );

      const touchDevice =
        typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;

      const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
      const noHover = window.matchMedia("(hover: none)").matches;
      const mobileViewport = mobileMediaQuery.matches;

      const isMobileLike =
        userAgentDataMobile ||
        userAgentMobile ||
        ((touchDevice || coarsePointer || noHover) && mobileViewport);

      setIsMobileDevice(isMobileLike);
    };

    detectMobileDevice();
    mobileMediaQuery.addEventListener("change", detectMobileDevice);

    return () =>
      mobileMediaQuery.removeEventListener("change", detectMobileDevice);
  }, []);

  const handleInteractionChange = useCallback((isInteracting: boolean) => {
    isMapInteractingRef.current = isInteracting;
  }, []);

  // Adjusting state while rendering, rather than in an effect, so the map
  // never paints a frame pointed at the previous agency.
  const [renderedAgencyId, setRenderedAgencyId] = useState(agencyId);
  if (agencyId !== renderedAgencyId) {
    setRenderedAgencyId(agencyId);

    const config = getAgencyMapConfig(agencyId);
    setMapCenter(config.center);
    setAgencyZoom(config.zoom);
    setAgencyChangeKey((k) => k + 1);

    const available = getAgencyRouteTypes(agencyId);
    setSelectedRouteType((prev) =>
      prev !== null && !available.includes(prev) ? null : prev,
    );
  }

  const fetchVehicles = useCallback(
    async (signal?: AbortSignal) => {
      setError(null);

      try {
        const params = new URLSearchParams();
        if (agencyId) params.set("agencyId", agencyId);
        const url = `/api/vehicles${params.size ? `?${params}` : ""}`;

        const response = await fetch(url, { signal });
        if (!response.ok) {
          throw new Error("Kunde inte hämta fordonspositioner");
        }

        const data = await response.json();
        if (isMapInteractingRef.current) {
          return;
        }

        setVehicles(data.vehicles || []);
        if (data.updatedAt) {
          setLastUpdated(new Date(data.updatedAt));
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        setError(err instanceof Error ? err : new Error("Okänt fel"));
      }
    },
    [agencyId],
  );

  useEffect(() => {
    const controller = new AbortController();
    let inFlight = false;

    // Paused while interacting and while the tab is hidden; skipped entirely
    // if the previous request has not come back yet.
    const tick = async () => {
      if (inFlight) return;
      if (isMapInteractingRef.current) return;
      if (document.visibilityState === "hidden") return;

      inFlight = true;
      try {
        await fetchVehicles(controller.signal);
      } finally {
        inFlight = false;
      }
    };

    void tick();
    const interval = setInterval(() => void tick(), POLL_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(interval);
      controller.abort();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [fetchVehicles]);

  // Derived, so a vehicle leaving the feed deselects itself and the selection
  // always carries that vehicle's current data.
  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) ?? null,
    [vehicles, selectedVehicleId],
  );

  const handleSelect = useCallback((vehicle: Vehicle | null) => {
    setSelectedVehicleId(vehicle?.id ?? null);
  }, []);

  const handleLocateMe = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location: [number, number] = [
            position.coords.latitude,
            position.coords.longitude,
          ];
          setMapCenter(location);
          setUserLocation(location);
          setLocateKey((prev) => prev + 1);
        },
        (err) => {
          console.error("Geolocation error:", err);
        },
      );
    } else {
      alert("Din webbläsare stödjer inte positionering");
    }
  };

  // Fetch trip shape when a vehicle is selected. A stale shape needs no
  // clearing: it is only drawn when it matches the current selection.
  const selectedTripId = selectedVehicle?.tripId;
  useEffect(() => {
    if (!selectedVehicleId || !selectedTripId) return;

    const vehicleId = selectedVehicleId;
    const controller = new AbortController();

    const fetchTripShape = async () => {
      try {
        const response = await fetch(`/api/trips/${selectedTripId}/shape`, {
          signal: controller.signal,
        });
        if (!response.ok) return;

        const data = await response.json();
        if (
          data.shape &&
          data.shape.coordinates &&
          Array.isArray(data.shape.coordinates)
        ) {
          // Shape is GeoJSON format with [lon, lat] coordinates
          setTripShape({
            vehicleId,
            coordinates: data.shape.coordinates.map(
              (coord: [number, number]) => [coord[1], coord[0]],
            ),
          });
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Failed to fetch trip shape:", err);
      }
    };

    fetchTripShape();

    return () => controller.abort();
  }, [selectedVehicleId, selectedTripId]);

  // The API returns every vehicle for the agency, so the route type filter is
  // applied here - instant, and it keeps one shared payload on the server.
  const routeTypeVehicles = useMemo(() => {
    if (selectedRouteType === null) return vehicles;
    return vehicles.filter((v) => v.routeType === selectedRouteType);
  }, [vehicles, selectedRouteType]);

  // Only markers in view are worth handing to Leaflet - zoomed in, that is a
  // few dozen instead of the whole region.
  const displayedVehicles = useMemo(() => {
    if (selectedVehicle) {
      return routeTypeVehicles.filter((v) => v.id === selectedVehicle.id);
    }

    return filterToViewport(routeTypeVehicles, mapViewport);
  }, [routeTypeVehicles, selectedVehicle, mapViewport]);

  const useLightweightMarkers =
    isMobileDevice &&
    displayedVehicles.length > LIGHTWEIGHT_VISIBLE_MARKERS_THRESHOLD &&
    selectedVehicle === null;
  const vehicleMarkers = useMemo(() => {
    if (useLightweightMarkers) {
      return displayedVehicles.map((vehicle) => (
        <LightVehicleMarker
          key={vehicle.id}
          vehicle={vehicle}
          onSelect={handleSelect}
          isSelected={false}
        />
      ));
    }

    return displayedVehicles.map((vehicle) => (
      <VehicleMarker
        key={vehicle.id}
        vehicle={vehicle}
        onSelect={handleSelect}
        isSelected={selectedVehicle?.id === vehicle.id}
        agencyId={agencyId}
        zoom={mapViewport?.zoom ?? agencyZoom}
      />
    ));
  }, [
    displayedVehicles,
    handleSelect,
    selectedVehicle?.id,
    useLightweightMarkers,
    agencyId,
    mapViewport?.zoom,
    agencyZoom,
  ]);

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-6">
          <p className="text-destructive mb-2">Kunde inte ladda karta</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchVehicles()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Försök igen
          </Button>
        </CardContent>
      </Card>
    );
  }

  const routeTypes = getAgencyRouteTypes(agencyId);

  return (
    <Card>
      <CardHeader className="pb-2 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-lg">
              {routeTypeVehicles.length > 0
                ? `Visar ${routeTypeVehicles.length} ${vehicleType(selectedRouteType)}`
                : "Positioner inte tillgängliga"}
            </CardTitle>
            {lastUpdated && (
              <span className="text-xs text-muted-foreground">
                Uppdaterad{" "}
                {lastUpdated.toLocaleTimeString("sv-SE", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleLocateMe}
              title="Min position"
            >
              <Locate className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedRouteType === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedRouteType(null)}
            className="h-8 text-xs"
          >
            Alla
          </Button>
          {routeTypes.map((type) => {
            const color = routeTypeColor(type);
            return (
              <Button
                key={type}
                variant={selectedRouteType === type ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedRouteType(type)}
                className="h-8 text-xs"
                style={
                  selectedRouteType === type
                    ? {
                        backgroundColor: color,
                        color: "#FFFFFF",
                        borderColor: color,
                      }
                    : undefined
                }
              >
                {routeTypeName(type)}
              </Button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div
          style={{ height }}
          className="relative rounded-b-lg overflow-hidden"
        >
          <MapContainer
            center={mapCenter}
            zoom={agencyZoom}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={true}
            preferCanvas={true}
          >
            <MapUpdater
              center={mapCenter}
              zoom={agencyZoom}
              locateKey={locateKey}
              agencyChangeKey={agencyChangeKey}
              onInteractionChange={handleInteractionChange}
              onViewportChange={setMapViewport}
            />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {userLocation && (
              <CircleMarker
                center={userLocation}
                radius={8}
                fillColor="#3B82F6"
                color="#FFFFFF"
                weight={3}
                fillOpacity={0.8}
              >
                <Popup>
                  <div className="text-sm">
                    <p className="font-bold">Din position</p>
                  </div>
                </Popup>
              </CircleMarker>
            )}
            {selectedVehicle && tripShape?.vehicleId === selectedVehicle.id && (
              <Polyline
                positions={tripShape.coordinates}
                color={routeTypeColor(
                  selectedVehicle.routeType,
                  parseInt(selectedVehicle.routeName),
                )}
                weight={4}
                opacity={0.7}
              />
            )}
            {vehicleMarkers}
          </MapContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// MapUpdater must be inside MapContainer to access useMap
function MapUpdater({
  center,
  zoom,
  locateKey,
  agencyChangeKey,
  onInteractionChange,
  onViewportChange,
}: {
  center: [number, number];
  zoom: number;
  locateKey: number;
  agencyChangeKey: number;
  onInteractionChange: (isInteracting: boolean) => void;
  onViewportChange: (viewport: MapViewport) => void;
}) {
  const map = useMap();
  const interactionEndTimeout = useRef<number | null>(null);

  const clearInteractionEndTimeout = () => {
    if (interactionEndTimeout.current !== null) {
      window.clearTimeout(interactionEndTimeout.current);
      interactionEndTimeout.current = null;
    }
  };

  const onInteractionStart = () => {
    clearInteractionEndTimeout();
    onInteractionChange(true);
  };

  const emitViewport = useCallback(() => {
    const bounds = map.getBounds();
    onViewportChange({
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
      zoom: map.getZoom(),
    });
  }, [map, onViewportChange]);

  const onInteractionEnd = () => {
    clearInteractionEndTimeout();
    interactionEndTimeout.current = window.setTimeout(() => {
      onInteractionChange(false);
      emitViewport();
    }, 120);
  };

  useMapEvents({
    movestart: onInteractionStart,
    zoomstart: onInteractionStart,
    moveend: onInteractionEnd,
    zoomend: onInteractionEnd,
  });

  useEffect(() => {
    emitViewport();

    if (locateKey > 0) {
      map.flyTo(center, 12, { duration: 1.5 });
    }
  }, [locateKey, center, map, emitViewport]);

  useEffect(() => {
    if (agencyChangeKey > 0) {
      map.flyTo(center, zoom, { duration: 1.5 });
    }
  }, [agencyChangeKey, center, zoom, map]);

  useEffect(() => {
    return () => {
      clearInteractionEndTimeout();
      onInteractionChange(false);
    };
  }, [onInteractionChange]);

  return null;
}

interface VehicleMarkerProps {
  vehicle: Vehicle;
  onSelect: (vehicle: Vehicle | null) => void;
  isSelected: boolean;
  agencyId?: string;
  zoom: number;
}

function VehicleMarkerComponent({
  vehicle,
  onSelect,
  isSelected,
  agencyId,
  zoom,
}: VehicleMarkerProps) {
  const markerRef = useRef<LeafletMarker | null>(null);

  // Leaflet owns this marker's position after mount. The prop below is pinned
  // to where it first appeared so react-leaflet never calls setLatLng itself
  // and fights the animation.
  const [mountPosition] = useState<Position>(() => [vehicle.lat, vehicle.lon]);
  const drawnPosition = useRef<Position>([vehicle.lat, vehicle.lon]);

  // Get the color for this route type
  const bearing = vehicle.bearing ?? 0;
  const speedMps = vehicle.speed ?? 0;

  const color = routeTypeColor(vehicle.routeType, parseInt(vehicle.routeName));

  // Create custom arrow icon
  const size = isSelected ? 40 : zoom <= 12 ? 20 : 28;
  const icon = useMemo(
    () => createVehicleLeafletIcon(L, color, bearing, size),
    [color, bearing, size],
  );

  useEffect(() => {
    if (isSelected) {
      markerRef.current?.openPopup();
    }
  }, [isSelected]);

  // Slide to each new position rather than jumping. Updates arrive every
  // couple of seconds, which is a visible hop at street zoom. This runs
  // outside React: re-rendering every marker per frame would cost far more
  // than the jump it smooths.
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;

    const from = drawnPosition.current;
    const to: Position = [vehicle.lat, vehicle.lon];

    if (samePosition(from, to)) return;

    if (shouldSnap(from, to, MAX_ANIMATED_DEGREES) || prefersReducedMotion()) {
      drawnPosition.current = to;
      marker.setLatLng(to);
      return;
    }

    const startedAt = performance.now();

    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / POSITION_ANIMATION_MS);
      const next = interpolate(from, to, progress);

      drawnPosition.current = next;
      marker.setLatLng(next);

      if (progress < 1) {
        frame = requestAnimationFrame(step);
      }
    };

    let frame = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frame);
  }, [vehicle.lat, vehicle.lon]);

  return (
    <Marker
      ref={markerRef}
      position={mountPosition}
      icon={icon}
      eventHandlers={{
        click: () => onSelect(vehicle),
        popupclose: () => onSelect(null),
      }}
    >
      <Popup>
        <div className="text-sm">
          <div className="font-bold">{vehicleTitle(vehicle)}</div>
          {speedMps > 0 && (
            <div className="text-gray-600 mt-1">
              {vehicle.routeType === RouteType.Ferry
                ? `Hastighet: ${(speedMps * 1.94).toFixed(0)} knop`
                : `Hastighet: ${(speedMps * 3.6).toFixed(0)} km/h`}
            </div>
          )}
          <a
            href={`/trip/${vehicle.tripId}${agencyId ? `?agency=${agencyId}` : ""}`}
            className="text-blue-600 hover:underline mt-1 inline-block"
          >
            Visa resa
          </a>
        </div>
      </Popup>
    </Marker>
  );
}

const VehicleMarker = memo(
  VehicleMarkerComponent,
  (prev, next) =>
    prev.isSelected === next.isSelected &&
    prev.zoom === next.zoom &&
    prev.vehicle.id === next.vehicle.id &&
    prev.vehicle.lat === next.vehicle.lat &&
    prev.vehicle.lon === next.vehicle.lon &&
    prev.vehicle.bearing === next.vehicle.bearing &&
    prev.vehicle.speed === next.vehicle.speed &&
    prev.vehicle.routeName === next.vehicle.routeName,
);

interface LightVehicleMarkerProps {
  vehicle: Vehicle;
  onSelect: (vehicle: Vehicle | null) => void;
  isSelected: boolean;
}

function LightVehicleMarker({
  vehicle,
  onSelect,
  isSelected,
}: LightVehicleMarkerProps) {
  const color = routeTypeColor(
    vehicle.routeType,
    Number.parseInt(vehicle.routeName),
  );

  return (
    <CircleMarker
      center={[vehicle.lat, vehicle.lon]}
      radius={isSelected ? 7 : 4}
      fillColor={color}
      color="#FFFFFF"
      weight={0.5}
      fillOpacity={1}
      eventHandlers={{
        click: () => onSelect(vehicle),
      }}
    ></CircleMarker>
  );
}
