import { useState } from 'react';
import { MapPin, Camera, Wifi, WifiOff, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { useCameras } from '@/hooks/useCameras';
import { useTableQuery } from '@/hooks/useSupabaseQuery';
import CameraPlayer from '@/components/CameraPlayer';
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
  const { allCameras, getClientName } = useCameras();
  const { data: clients = [] } = useTableQuery('clients');

  // Agrupar câmeras por cliente com localização
  const clientsWithLocation = (clients as any[]).filter(c => c.latitude && c.longitude);

  const clientCamerasMap: Record<string, any[]> = {};
  for (const cam of allCameras) {
    if (cam.client_id) {
      if (!clientCamerasMap[cam.client_id]) clientCamerasMap[cam.client_id] = [];
      clientCamerasMap[cam.client_id].push(cam);
    }
  }

  const defaultCenter: [number, number] = clientsWithLocation.length > 0
    ? [clientsWithLocation[0].latitude, clientsWithLocation[0].longitude]
    : [-15.7801, -47.9292];

  const totalCamerasOnMap = clientsWithLocation.reduce((acc, c) => acc + (clientCamerasMap[c.id]?.length || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <MapPin className="w-6 h-6 text-primary" /> Mapa de Clientes
        </h1>
        <p className="text-sm text-muted-foreground font-mono">
          {clientsWithLocation.length} clientes geolocalizados ({totalCamerasOnMap} câmeras)
        </p>
      </div>

      {clientsWithLocation.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum cliente com coordenadas cadastradas.</p>
            <p className="text-sm text-muted-foreground mt-1">Edite os clientes e adicione latitude/longitude.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg overflow-hidden border border-border" style={{ height: 'calc(100vh - 200px)' }}>
          <MapContainer center={defaultCenter} zoom={12} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {clientsWithLocation.map((client) => {
              const cameras = clientCamerasMap[client.id] || [];
              const onlineCount = cameras.filter(c => c.status === 'online').length;
              const allOnline = cameras.length > 0 && onlineCount === cameras.length;
              const someOnline = onlineCount > 0;

              return (
                <Marker
                  key={client.id}
                  position={[client.latitude, client.longitude]}
                  icon={allOnline ? onlineIcon : (someOnline ? onlineIcon : offlineIcon)}
                >
                  <Popup minWidth={280} maxWidth={360}>
                    <div className="min-w-[260px]">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-bold text-sm flex items-center gap-1">
                          <Users className="w-3 h-3" /> {client.name}
                        </p>
                        <Badge className={`text-[9px] ${someOnline ? 'bg-emerald-500/20 text-emerald-600' : 'bg-red-500/20 text-red-600'}`}>
                          {onlineCount}/{cameras.length} online
                        </Badge>
                      </div>
                      {client.address && <p className="text-xs text-muted-foreground mb-2">{client.address}</p>}

                      {cameras.length > 0 ? (
                        <div className="space-y-2">
                          {cameras.map((cam: any) => (
                            <div key={cam.id} className="border border-border rounded p-2">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-xs font-medium flex items-center gap-1">
                                  <Camera className="w-3 h-3" /> {cam.name}
                                </p>
                                <span className={`text-[9px] ${cam.status === 'online' ? 'text-emerald-600' : 'text-red-500'}`}>
                                  {cam.status === 'online' ? (
                                    <span className="flex items-center gap-0.5"><Wifi className="w-2.5 h-2.5" /> Online</span>
                                  ) : (
                                    <span className="flex items-center gap-0.5"><WifiOff className="w-2.5 h-2.5" /> Offline</span>
                                  )}
                                </span>
                              </div>
                              <p className="text-[10px] text-muted-foreground">{cam.protocol} • {cam.resolution}</p>
                              {cam.status === 'online' && cam.stream_url && (
                                <div className="mt-1 rounded overflow-hidden border border-border">
                                  <CameraPlayer
                                    name={cam.name}
                                    streamUrl={cam.stream_url}
                                    protocol={cam.protocol}
                                    status={cam.status}
                                    resolution={cam.resolution || ''}
                                    compact
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Nenhuma câmera vinculada</p>
                      )}
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
