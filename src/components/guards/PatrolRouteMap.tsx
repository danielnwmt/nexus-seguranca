import { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, Popup, useMap, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin } from 'lucide-react';

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const guardIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const waypointIcon = (index: number) => L.divIcon({
  className: 'custom-waypoint-icon',
  html: `<div style="
    background: #3b82f6; color: white; border-radius: 50%; width: 24px; height: 24px;
    display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold;
    border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  ">${index + 1}</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

interface LatLng {
  lat: number;
  lng: number;
}

interface PatrolRouteMapProps {
  waypoints: LatLng[];
  onWaypointsChange?: (waypoints: LatLng[]) => void;
  guardPosition?: LatLng | null;
  guardName?: string;
  editable?: boolean;
  className?: string;
  center?: [number, number];
}

// Fetch road-following route between two points using OSRM
const fetchOSRMRoute = async (from: LatLng, to: LatLng): Promise<[number, number][]> => {
  try {
    const url = `https://router.project-osrm.org/route/v1/foot/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.routes && data.routes.length > 0) {
      return data.routes[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
    }
  } catch (e) {
    console.warn('OSRM fetch failed, falling back to straight line', e);
  }
  return [[from.lat, from.lng], [to.lat, to.lng]];
};

// Build full road-following polyline from waypoints
const buildRoutePolyline = async (waypoints: LatLng[]): Promise<[number, number][]> => {
  if (waypoints.length < 2) return waypoints.map(w => [w.lat, w.lng]);
  const segments: [number, number][][] = [];
  for (let i = 0; i < waypoints.length; i++) {
    const next = (i + 1) % waypoints.length; // close the loop
    if (i === waypoints.length - 1 && waypoints.length < 3) break; // don't close loop for 2 points
    segments.push(await fetchOSRMRoute(waypoints[i], waypoints[next]));
  }
  // Merge segments, avoiding duplicate junction points
  const merged: [number, number][] = [];
  segments.forEach((seg, idx) => {
    if (idx === 0) merged.push(...seg);
    else merged.push(...seg.slice(1));
  });
  return merged;
};

const ClickHandler = ({ onAdd }: { onAdd: (latlng: LatLng) => void }) => {
  useMapEvents({
    click(e) {
      onAdd({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
};

const MapCenterUpdater = ({ center }: { center?: [number, number] }) => {
  const map = useMap();
  const prevCenter = useRef<string>('');
  useEffect(() => {
    if (center) {
      const key = `${center[0]},${center[1]}`;
      if (key !== prevCenter.current) {
        prevCenter.current = key;
        map.setView(center, 14);
      }
    }
  }, [center, map]);
  return null;
};

const PatrolRouteMap = ({
  waypoints,
  onWaypointsChange,
  guardPosition,
  guardName,
  editable = false,
  className = '',
  center: propCenter,
}: PatrolRouteMapProps) => {
  const [routePolyline, setRoutePolyline] = useState<[number, number][]>([]);

  const defaultCenter: [number, number] = propCenter
    ? propCenter
    : waypoints.length > 0
      ? [waypoints[0].lat, waypoints[0].lng]
      : guardPosition
        ? [guardPosition.lat, guardPosition.lng]
        : [-15.7801, -47.9292];

  // Rebuild polyline when waypoints change
  useEffect(() => {
    if (waypoints.length < 2) {
      setRoutePolyline(waypoints.map(w => [w.lat, w.lng]));
      return;
    }
    let cancelled = false;
    buildRoutePolyline(waypoints).then(poly => {
      if (!cancelled) setRoutePolyline(poly);
    });
    return () => { cancelled = true; };
  }, [waypoints]);

  const handleAdd = (latlng: LatLng) => {
    if (!editable || !onWaypointsChange) return;
    onWaypointsChange([...waypoints, latlng]);
  };

  const handleRemoveWaypoint = (index: number) => {
    if (!onWaypointsChange) return;
    onWaypointsChange(waypoints.filter((_, i) => i !== index));
  };

  return (
    <div className={`relative ${className}`}>
      {editable && (
        <div className="absolute top-2 left-2 z-[1000] bg-card/90 backdrop-blur border border-border rounded-md px-3 py-1.5 flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-mono text-muted-foreground">Clique no mapa para adicionar pontos — a rota seguirá as ruas</span>
        </div>
      )}
      <MapContainer
        center={defaultCenter}
        zoom={14}
        style={{ height: '100%', width: '100%', borderRadius: '0.5rem' }}
        className="z-0"
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Mapa">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satélite">
            <TileLayer
              attribution='&copy; Esri'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satélite + Ruas">
            <TileLayer
              attribution='&copy; Google'
              url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Street View (Ruas)">
            <TileLayer
              attribution='&copy; Google'
              url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
            />
          </LayersControl.BaseLayer>
        </LayersControl>
        <MapCenterUpdater center={propCenter} />
        {editable && <ClickHandler onAdd={handleAdd} />}

        {/* Numbered waypoint markers */}
        {waypoints.map((wp, i) => (
          <Marker key={i} position={[wp.lat, wp.lng]} icon={waypointIcon(i)}>
            <Popup>
              <div className="text-xs">
                <p className="font-bold">Ponto {i + 1}</p>
                <p className="font-mono text-[10px]">{wp.lat.toFixed(6)}, {wp.lng.toFixed(6)}</p>
                {editable && (
                  <button
                    onClick={() => handleRemoveWaypoint(i)}
                    className="mt-1 text-red-600 text-[10px] underline"
                  >
                    Remover
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Road-following route line */}
        {routePolyline.length > 1 && (
          <Polyline positions={routePolyline} pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.8 }} />
        )}

        {/* Guard position */}
        {guardPosition && (
          <Marker position={[guardPosition.lat, guardPosition.lng]} icon={guardIcon}>
            <Popup>
              <div className="text-xs">
                <p className="font-bold">{guardName || 'Vigilante'}</p>
                <p className="text-[10px] text-green-600">Em ronda</p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
};

export default PatrolRouteMap;
