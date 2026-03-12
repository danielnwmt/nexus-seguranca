import { useState, useRef } from 'react';
import { Upload, Loader2, Camera, ImageIcon, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const ANALYTICS_OPTIONS = [
  { value: 'lpr', label: 'Leitura de Placa' },
  { value: 'weapon_detection', label: 'Detecção de Armas' },
  { value: 'line_crossing', label: 'Cruzamento de Linha' },
  { value: 'intrusion', label: 'Intrusão' },
  { value: 'loitering', label: 'Vadiagem' },
  { value: 'human_car', label: 'Humano/Carro' },
  { value: 'fallen_person', label: 'Pessoa Caída' },
  { value: 'people_count', label: 'Contagem de Pessoas' },
  { value: 'tampering', label: 'Sabotagem' },
];

interface Detection {
  event_type: string;
  confidence: number;
  details: Record<string, any>;
}

const ManualAnalysis = () => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [selectedAnalytics, setSelectedAnalytics] = useState<string[]>(['people_count', 'human_car', 'intrusion']);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<Detection[] | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Selecione uma imagem válida', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Imagem muito grande (máx 5MB)', variant: 'destructive' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);
      setImageBase64(dataUrl.split(',')[1]);
      setResults(null);
    };
    reader.readAsDataURL(file);
  };

  const toggleAnalytic = (value: string) => {
    setSelectedAnalytics(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  };

  const handleAnalyze = async () => {
    if (!imageBase64) {
      toast({ title: 'Envie uma imagem primeiro', variant: 'destructive' });
      return;
    }
    if (selectedAnalytics.length === 0) {
      toast({ title: 'Selecione pelo menos um analítico', variant: 'destructive' });
      return;
    }

    setAnalyzing(true);
    setResults(null);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-camera', {
        body: {
          image_base64: imageBase64,
          camera_name: 'Análise Manual',
          enabled_analytics: selectedAnalytics,
        },
      });

      if (error) throw error;

      setResults(data?.detections || []);
      toast({
        title: data?.detections_count > 0
          ? `✅ ${data.detections_count} detecção(ões) encontrada(s)`
          : '✅ Análise concluída — nenhuma detecção',
      });
    } catch (e: any) {
      console.error('Manual analysis error:', e);
      toast({ title: 'Erro na análise', description: e.message, variant: 'destructive' });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Análise Manual de Imagem
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Area */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
        >
          {imagePreview ? (
            <img src={imagePreview} alt="Preview" className="max-h-48 mx-auto rounded-md object-contain" />
          ) : (
            <div className="space-y-2">
              <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Clique para enviar uma imagem</p>
              <p className="text-xs text-muted-foreground/70">JPG, PNG — máx 5MB</p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>

        {/* Analytics Selection */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Analíticos a detectar:</p>
          <div className="flex flex-wrap gap-1.5">
            {ANALYTICS_OPTIONS.map(opt => (
              <Badge
                key={opt.value}
                variant={selectedAnalytics.includes(opt.value) ? 'default' : 'outline'}
                className="cursor-pointer text-[10px] select-none"
                onClick={() => toggleAnalytic(opt.value)}
              >
                {opt.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Analyze Button */}
        <Button
          onClick={handleAnalyze}
          disabled={analyzing || !imageBase64}
          className="w-full gap-2"
        >
          {analyzing ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Analisando com IA...</>
          ) : (
            <><Sparkles className="w-4 h-4" /> Analisar Imagem</>
          )}
        </Button>

        {/* Results */}
        {results !== null && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground">
              Resultado: {results.length === 0 ? 'Nenhuma detecção' : `${results.length} detecção(ões)`}
            </p>
            {results.map((det, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/50 text-xs">
                <span className="font-medium text-foreground">
                  {ANALYTICS_OPTIONS.find(o => o.value === det.event_type)?.label || det.event_type}
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant={det.confidence >= 0.8 ? 'default' : 'secondary'} className="text-[10px]">
                    {Math.round(det.confidence * 100)}%
                  </Badge>
                  {det.details && Object.keys(det.details).length > 0 && (
                    <span className="text-muted-foreground max-w-32 truncate">{JSON.stringify(det.details)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ManualAnalysis;
