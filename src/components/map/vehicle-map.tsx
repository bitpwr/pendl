"use client";

import { useEffect, useState, useMemo, useCallback, memo, useRef } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Locate } from "lucide-react";
import type { Marker as LeafletMarker } from "leaflet";
import type { Vehicle } from "@/types/api";
import { routeTypeColor, routeTypeName, RouteType } from "@/types/gtfs";
import { createVehicleLeafletIcon } from "./vehicle-arrow-icon";
import { getAgencyMapConfig, getAgencyRouteTypes } from "@/lib/config/agencies";

// Dynamically import Leaflet components to avoid SSR issues
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false },
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false },
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false },
);
const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), {
  ssr: false,
});
const CircleMarker = dynamic(
  () => import("react-leaflet").then((mod) => mod.CircleMarker),
  { ssr: false },
);
const Polyline = dynamic(
  () => import("react-leaflet").then((mod) => mod.Polyline),
  { ssr: false },
);

interface VehicleMapProps {
  center?: [number, number];
  zoom?: number;
  height?: string;
  agencyId?: string;
}

interface MapViewport {
  north: number;
  south: number;
  east: number;
  west: number;
  zoom: number;
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
  if (vehicle.routeShortName !== vehicle.headsign) {
    return vehicle.headsign;
  }

  return `${routeTypeName(vehicle.routeType)} ${vehicle.routeShortName}`;
}

const LIGHTWEIGHT_VISIBLE_MARKERS_THRESHOLD = 300;

export function VehicleMap({
  center,
  zoom,
  height = "400px",
  agencyId,
}: VehicleMapProps) {
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
  const isFirstAgencyRender = useRef(true);
  const [isClient, setIsClient] = useState(false);
  const [selectedRouteType, setSelectedRouteType] = useState<RouteType | null>(
    null,
  );
  const [locateKey, setLocateKey] = useState(0);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null,
  );
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [tripShape, setTripShape] = useState<[number, number][]>([]);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isMapInteracting, setIsMapInteracting] = useState(false);
  const [mapViewport, setMapViewport] = useState<MapViewport | null>(null);
  const isMapInteractingRef = useRef(false);
  const [L, setL] = useState<typeof import("leaflet") | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

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

  useEffect(() => {
    if (!isClient) return;

    import("leaflet").then((leaflet) => setL(leaflet));
  }, [isClient]);

  useEffect(() => {
    isMapInteractingRef.current = isMapInteracting;
  }, [isMapInteracting]);

  useEffect(() => {
    if (isFirstAgencyRender.current) {
      isFirstAgencyRender.current = false;
      return;
    }
    const config = getAgencyMapConfig(agencyId);
    setMapCenter(config.center);
    setAgencyZoom(config.zoom);
    setAgencyChangeKey((k) => k + 1);
    const available = getAgencyRouteTypes(agencyId);
    setSelectedRouteType((prev) =>
      prev !== null && !available.includes(prev) ? null : prev,
    );
  }, [agencyId]);

  const fetchVehicles = useCallback(async () => {
    setError(null);

    try {
      const params = new URLSearchParams();
      if (selectedRouteType !== null)
        params.set("routeType", String(selectedRouteType));
      if (agencyId) params.set("agencyId", agencyId);
      const url = `/api/vehicles${params.size ? `?${params}` : ""}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Kunde inte hämta fordonspositioner");
      }

      const data = await response.json();
      if (isMapInteractingRef.current) {
        return;
      }

      setVehicles(data.vehicles || []);
      setLastUpdated(new Date(data.updatedAt));
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Okänt fel"));
    }
  }, [selectedRouteType, agencyId]);

  useEffect(() => {
    if (!isMapInteracting) {
      fetchVehicles();
    }

    // Auto-refresh every 2 seconds (paused while interacting)
    const interval = setInterval(() => {
      if (!isMapInteracting) {
        fetchVehicles();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [fetchVehicles, isMapInteracting]);

  // Clear selected vehicle if it's no longer in the vehicles list
  useEffect(() => {
    if (
      selectedVehicle &&
      !vehicles.some((v) => v.vehicleId === selectedVehicle.vehicleId)
    ) {
      setSelectedVehicle(null);
    }
  }, [vehicles, selectedVehicle]);

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

  // Fetch trip shape when a vehicle is selected
  useEffect(() => {
    if (!selectedVehicle) {
      setTripShape([]);
      return;
    }

    const fetchTripShape = async () => {
      try {
        const response = await fetch(`/api/trips/${selectedVehicle.tripId}`);
        if (!response.ok) return;

        const data = await response.json();
        if (
          data.shape &&
          data.shape.coordinates &&
          Array.isArray(data.shape.coordinates)
        ) {
          // Shape is GeoJSON format with [lon, lat] coordinates
          setTripShape(
            data.shape.coordinates.map((coord: [number, number]) => [
              coord[1],
              coord[0],
            ]),
          );
        }
      } catch (err) {
        console.error("Failed to fetch trip shape:", err);
      }
    };

    fetchTripShape();
  }, [selectedVehicle]);

  // Filter vehicles based on selection
  const displayedVehicles = useMemo(() => {
    if (selectedVehicle) {
      return vehicles.filter((v) => v.vehicleId === selectedVehicle.vehicleId);
    }
    return vehicles;
  }, [vehicles, selectedVehicle]);

  const visibleVehicleCount = useMemo(() => {
    if (!mapViewport) {
      return displayedVehicles.length;
    }

    return displayedVehicles.reduce((count, vehicle) => {
      const isVisible =
        vehicle.latitude >= mapViewport.south &&
        vehicle.latitude <= mapViewport.north &&
        vehicle.longitude >= mapViewport.west &&
        vehicle.longitude <= mapViewport.east;

      return isVisible ? count + 1 : count;
    }, 0);
  }, [displayedVehicles, mapViewport]);

  const useLightweightMarkers =
    isMobileDevice &&
    visibleVehicleCount > LIGHTWEIGHT_VISIBLE_MARKERS_THRESHOLD &&
    selectedVehicle === null;
  // Create vehicle markers only on client
  const vehicleMarkers = useMemo(() => {
    if (!isClient) return null;

    if (useLightweightMarkers) {
      return displayedVehicles.map((vehicle) => (
        <LightVehicleMarker
          key={vehicle.vehicleId}
          vehicle={vehicle}
          onSelect={setSelectedVehicle}
          isSelected={false}
        />
      ));
    }

    if (!L) return null;

    return displayedVehicles.map((vehicle) => (
      <VehicleMarker
        key={vehicle.vehicleId}
        vehicle={vehicle}
        L={L}
        onSelect={setSelectedVehicle}
        isSelected={selectedVehicle?.vehicleId === vehicle.vehicleId}
        agencyId={agencyId}
      />
    ));
  }, [
    displayedVehicles,
    isClient,
    L,
    selectedVehicle?.vehicleId,
    useLightweightMarkers,
    agencyId,
  ]);

  if (!isClient) {
    return <MapSkeleton height={height} />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-6">
          <p className="text-destructive mb-2">Kunde inte ladda karta</p>
          <Button variant="outline" size="sm" onClick={fetchVehicles}>
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
              {vehicles.length > 0
                ? `Visar ${vehicles.length} ${vehicleType(selectedRouteType)}`
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
              onInteractionChange={setIsMapInteracting}
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
            {tripShape.length > 0 && (
              <Polyline
                positions={tripShape}
                color={
                  selectedVehicle
                    ? routeTypeColor(
                        selectedVehicle.routeType,
                        parseInt(selectedVehicle.routeShortName),
                      )
                    : "#3B82F6"
                }
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

// MapUpdater component must be inside MapContainer to access useMap
const MapUpdater = dynamic(
  () =>
    import("react-leaflet").then((mod) => {
      const { useMap, useMapEvents } = mod;

      return function MapUpdaterComponent({
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
      };
    }),
  { ssr: false },
);

interface VehicleMarkerProps {
  vehicle: Vehicle;
  L: typeof import("leaflet");
  onSelect: (vehicle: Vehicle | null) => void;
  isSelected: boolean;
  agencyId?: string;
}

function VehicleMarkerComponent({
  vehicle,
  L,
  onSelect,
  isSelected,
  agencyId,
}: VehicleMarkerProps) {
  const markerRef = useRef<LeafletMarker | null>(null);

  // Get the color for this route type
  const bearing = vehicle.bearing ?? 0;
  const speedMps = vehicle.speed ?? 0;

  const color = routeTypeColor(
    vehicle.routeType,
    parseInt(vehicle.routeShortName),
  );

  // Create custom arrow icon
  const icon = useMemo(
    () => createVehicleLeafletIcon(L, color, bearing, isSelected ? 48 : 30),
    [L, color, bearing, isSelected],
  );

  useEffect(() => {
    if (isSelected) {
      markerRef.current?.openPopup();
    }
  }, [isSelected]);

  return (
    <Marker
      ref={markerRef}
      position={[vehicle.latitude, vehicle.longitude]}
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
    prev.vehicle.vehicleId === next.vehicle.vehicleId &&
    prev.vehicle.latitude === next.vehicle.latitude &&
    prev.vehicle.longitude === next.vehicle.longitude &&
    prev.vehicle.bearing === next.vehicle.bearing &&
    prev.vehicle.speed === next.vehicle.speed &&
    prev.vehicle.routeShortName === next.vehicle.routeShortName,
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
    Number.parseInt(vehicle.routeShortName),
  );

  return (
    <CircleMarker
      center={[vehicle.latitude, vehicle.longitude]}
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

function MapSkeleton({ height }: { height: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-8 w-8" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Skeleton style={{ height }} className="rounded-b-lg" />
      </CardContent>
    </Card>
  );
}
