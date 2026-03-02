import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AnalysisResult {
  detections_count: number;
  detections: Array<{
    event_type: string;
    confidence: number;
    details: Record<string, any>;
  }>;
}

export function useAnalyzeCamera() {
  const { toast } = useToast();
  const [analyzing, setAnalyzing] = useState<string | null>(null);

  // Capturar frame do vídeo no canvas do browser
  const analyzeFromCanvas = useCallback(async (
    videoElement: HTMLVideoElement,
    camera: {
      id: string;
      name: string;
      clientId?: string;
      clientName?: string;
      analytics: string[];
    }
  ): Promise<AnalysisResult | null> => {
    if (!camera.analytics || camera.analytics.length === 0) {
      toast({ title: 'Nenhum analítico habilitado para esta câmera', variant: 'destructive' });
      return null;
    }

    setAnalyzing(camera.id);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoElement.videoWidth || 640;
      canvas.height = videoElement.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context failed');
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

      const { data, error } = await supabase.functions.invoke('analyze-camera', {
        body: {
          image_base64: base64,
          camera_id: camera.id,
          camera_name: camera.name,
          client_id: camera.clientId || null,
          client_name: camera.clientName || null,
          enabled_analytics: camera.analytics,
        },
      });

      if (error) throw error;
      showResult(data);
      return data as AnalysisResult;
    } catch (e: any) {
      console.error('Analysis error:', e);
      toast({ title: 'Erro na análise IA', description: e.message || 'Erro desconhecido', variant: 'destructive' });
      return null;
    } finally {
      setAnalyzing(null);
    }
  }, [toast]);

  // Usar snapshot URL da câmera
  const analyzeFromUrl = useCallback(async (
    imageUrl: string,
    camera: {
      id: string;
      name: string;
      clientId?: string;
      clientName?: string;
      analytics: string[];
    }
  ): Promise<AnalysisResult | null> => {
    if (!camera.analytics || camera.analytics.length === 0) {
      toast({ title: 'Nenhum analítico habilitado para esta câmera', variant: 'destructive' });
      return null;
    }

    setAnalyzing(camera.id);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-camera', {
        body: {
          image_url: imageUrl,
          camera_id: camera.id,
          camera_name: camera.name,
          client_id: camera.clientId || null,
          client_name: camera.clientName || null,
          enabled_analytics: camera.analytics,
        },
      });

      if (error) throw error;
      showResult(data);
      return data as AnalysisResult;
    } catch (e: any) {
      console.error('Analysis error:', e);
      toast({ title: 'Erro na análise IA', description: e.message || 'Erro desconhecido', variant: 'destructive' });
      return null;
    } finally {
      setAnalyzing(null);
    }
  }, [toast]);

  // Capturar frame do stream ao vivo via servidor local (ffmpeg + HLS/RTSP)
  const analyzeFromStream = useCallback(async (
    camera: {
      id: string;
      name: string;
      streamKey: string;
      snapshotUrl?: string;
      clientId?: string;
      clientName?: string;
      analytics: string[];
    }
  ): Promise<AnalysisResult | null> => {
    if (!camera.analytics || camera.analytics.length === 0) {
      toast({ title: 'Nenhum analítico habilitado para esta câmera', variant: 'destructive' });
      return null;
    }

    setAnalyzing(camera.id);

    try {
      // Pedir ao servidor local para capturar um frame via ffmpeg do HLS/RTSP
      const baseUrl = window.location.origin;
      const snapResp = await fetch(`${baseUrl}/api/cameras/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stream_key: camera.streamKey,
          snapshot_url: camera.snapshotUrl || null,
        }),
      });

      if (!snapResp.ok) {
        const err = await snapResp.json().catch(() => ({ error: 'Falha ao capturar frame' }));
        throw new Error(err.error || 'Falha ao capturar frame do stream');
      }

      const snapData = await snapResp.json();
      if (!snapData.image_base64) {
        throw new Error('Nenhuma imagem capturada do stream');
      }

      // Enviar para análise IA
      const { data, error } = await supabase.functions.invoke('analyze-camera', {
        body: {
          image_base64: snapData.image_base64,
          camera_id: camera.id,
          camera_name: camera.name,
          client_id: camera.clientId || null,
          client_name: camera.clientName || null,
          enabled_analytics: camera.analytics,
        },
      });

      if (error) throw error;
      showResult(data);
      return data as AnalysisResult;
    } catch (e: any) {
      console.error('Stream analysis error:', e);
      toast({ title: 'Erro na análise IA', description: e.message || 'Erro desconhecido', variant: 'destructive' });
      return null;
    } finally {
      setAnalyzing(null);
    }
  }, [toast]);

  const showResult = (data: any) => {
    if (data?.detections_count > 0) {
      toast({
        title: `IA: ${data.detections_count} detecção(ões)`,
        description: data.detections.map((d: any) => `${d.event_type} (${Math.round(d.confidence * 100)}%)`).join(', '),
      });
    } else {
      toast({ title: 'IA: Nenhuma detecção nesta imagem' });
    }
  };

  return { analyzing, analyzeFromCanvas, analyzeFromUrl, analyzeFromStream };
}