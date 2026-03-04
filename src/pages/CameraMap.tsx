import { useState, useEffect } from 'react';
import { MapPin, Camera, Wifi, WifiOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { useTableQuery } from '@/hooks/useSupabaseQuery';
import 'leaflet/dist/leaflet.css';

// Fix default Leaflet icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const onlineIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

const offlineIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

const CameraMap = () => {
  const { data: cameras = [] } = useTableQuery('cameras');
  const { data: clients = [] } = useTableQuery('clients');

  const camerasWithLocation = (cameras as any[]).filter(c => c.latitude && c.longitude);

  // Default center: Brazil or first camera with coords
  const defaultCenter: [number, number] = camerasWithLocation.length > 0
    ? [camerasWithLocation[0].latitude, camerasWithLocation[0].longitude]
    : [-15.7801, -47.9292]; // Brasília

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <MapPin className="w-6 h-6 text-primary" /> Mapa de Câmeras
        </h1>
        <p className="text-sm text-muted-foreground font-mono">
          {camerasWithLocation.length} câmeras geolocalizadas de {(cameras as any[]).length} total
        </p>
      </div>

      {camerasWithLocation.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhuma câmera com coordenadas cadastradas.</p>
            <p className="text-sm text-muted-foreground mt-1">Edite as câmeras em Câmeras → Editar e adicione latitude/longitude.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg overflow-hidden border border-border" style={{ height: 'calc(100vh - 200px)' }}>
          <MapContainer center={defaultCenter} zoom={12} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {camerasWithLocation.map((cam: any) => {
              const client = (clients as any[]).find(c => c.id === cam.client_id);
              return (
                <Marker
                  key={cam.id}
                  position={[cam.latitude, cam.longitude]}
                  icon={cam.status === 'online' ? onlineIcon : offlineIcon}
                >
                  <Popup>
                    <div className="min-w-[180px]">
                      <p className="font-bold text-sm flex items-center gap-1">
                        <Camera className="w-3 h-3" /> {cam.name}
                      </p>
                      {client && <p className="text-xs text-gray-600">{client.name}</p>}
                      <p className="text-xs mt-1">
                        {cam.status === 'online' ? (
                          <span className="text-green-600 flex items-center gap-1"><Wifi className="w-3 h-3" /> Online</span>
                        ) : (
                          <span className="text-red-600 flex items-center gap-1"><WifiOff className="w-3 h-3" /> Offline</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{cam.protocol} • {cam.resolution}</p>
                      {cam.location && <p className="text-xs text-gray-500">{cam.location}</p>}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      )}
    </div>
  );
};

export default CameraMap;
