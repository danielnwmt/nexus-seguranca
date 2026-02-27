import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { Trash2, Save, MapPin } from 'lucide-react';

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
}

const ClickHandler = ({ onAdd }: { onAdd: (latlng: LatLng) => void }) => {
  useMapEvents({
    click(e) {
      onAdd({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
};

const PatrolRouteMap = ({
  waypoints,
  onWaypointsChange,
  guardPosition,
  guardName,
  editable = false,
  className = '',
}: PatrolRouteMapProps) => {
  const center: [number, number] = waypoints.length > 0
    ? [waypoints[0].lat, waypoints[0].lng]
    : guardPosition
      ? [guardPosition.lat, guardPosition.lng]
      : [-15.7801, -47.9292]; // Brasília default

  const handleAdd = (latlng: LatLng) => {
    if (!editable || !onWaypointsChange) return;
    onWaypointsChange([...waypoints, latlng]);
  };

  const handleRemoveWaypoint = (index: number) => {
    if (!onWaypointsChange) return;
    onWaypointsChange(waypoints.filter((_, i) => i !== index));
  };

  const polylinePositions: [number, number][] = waypoints.map(w => [w.lat, w.lng]);
  // Close the loop
  if (polylinePositions.length > 1) {
    polylinePositions.push(polylinePositions[0]);
  }

  return (
    <div className={`relative ${className}`}>
      {editable && (
        <div className="absolute top-2 left-2 z-[1000] bg-card/90 backdrop-blur border border-border rounded-md px-3 py-1.5 flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-mono text-muted-foreground">Clique no mapa para adicionar pontos da rota</span>
        </div>
      )}
      <MapContainer
        center={center}
        zoom={15}
        style={{ height: '100%', width: '100%', borderRadius: '0.5rem' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {editable && <ClickHandler onAdd={handleAdd} />}

        {/* Waypoints */}
        {waypoints.map((wp, i) => (
          <Marker key={i} position={[wp.lat, wp.lng]}>
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

        {/* Route line */}
        {polylinePositions.length > 1 && (
          <Polyline positions={polylinePositions} pathOptions={{ color: '#3b82f6', weight: 3, dashArray: '10, 6' }} />
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
