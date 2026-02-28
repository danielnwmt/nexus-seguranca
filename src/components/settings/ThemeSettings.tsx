import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Save, RotateCcw, Palette } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ThemePreset {
  name: string;
  primary: string;
  accent: string;
  preview: string;
}

const presets: ThemePreset[] = [
  { name: 'Ciano (Padrão)', primary: '175 80% 45%', accent: '160 70% 40%', preview: 'hsl(175, 80%, 45%)' },
  { name: 'Azul', primary: '217 91% 60%', accent: '210 80% 50%', preview: 'hsl(217, 91%, 60%)' },
  { name: 'Verde', primary: '142 70% 45%', accent: '152 60% 40%', preview: 'hsl(142, 70%, 45%)' },
  { name: 'Roxo', primary: '270 70% 55%', accent: '280 60% 45%', preview: 'hsl(270, 70%, 55%)' },
  { name: 'Laranja', primary: '25 95% 53%', accent: '35 90% 50%', preview: 'hsl(25, 95%, 53%)' },
  { name: 'Vermelho', primary: '0 72% 50%', accent: '10 70% 45%', preview: 'hsl(0, 72%, 50%)' },
  { name: 'Rosa', primary: '330 80% 55%', accent: '340 70% 45%', preview: 'hsl(330, 80%, 55%)' },
  { name: 'Dourado', primary: '45 90% 48%', accent: '38 85% 42%', preview: 'hsl(45, 90%, 48%)' },
];

const STORAGE_KEY = 'nexus-theme';

function applyTheme(primary: string, accent: string) {
  const root = document.documentElement;
  root.style.setProperty('--primary', primary);
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--ring', primary);
  root.style.setProperty('--sidebar-primary', primary);
  root.style.setProperty('--sidebar-ring', primary);
  root.style.setProperty('--alarm-info', primary);
}

export function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const { primary, accent } = JSON.parse(saved);
      applyTheme(primary, accent);
    } catch {}
  }
}

const ThemeSettings = () => {
  const { toast } = useToast();
  const [selectedPreset, setSelectedPreset] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const { primary } = JSON.parse(saved);
        const idx = presets.findIndex(p => p.primary === primary);
        if (idx >= 0) setSelectedPreset(idx);
      } catch {}
    }
  }, []);

  const handleSelectPreset = (index: number) => {
    setSelectedPreset(index);
    const preset = presets[index];
    applyTheme(preset.primary, preset.accent);
  };

  const handleSave = () => {
    const preset = presets[selectedPreset];
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ primary: preset.primary, accent: preset.accent }));
    toast({ title: 'Tema salvo', description: `Cor "${preset.name}" aplicada com sucesso.` });
  };

  const handleReset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSelectedPreset(0);
    applyTheme(presets[0].primary, presets[0].accent);
    toast({ title: 'Tema restaurado', description: 'Cores padrão restauradas.' });
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Palette className="w-5 h-5 text-primary" />
          <div>
            <CardTitle className="text-base">Cores do Sistema</CardTitle>
            <CardDescription className="text-xs">Escolha a cor principal da interface</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs text-muted-foreground mb-3 block">Selecione um tema</Label>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
            {presets.map((preset, i) => (
              <button
                key={preset.name}
                onClick={() => handleSelectPreset(i)}
                className={`group flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all ${
                  selectedPreset === i
                    ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                    : 'border-border hover:border-muted-foreground/30'
                }`}
              >
                <div
                  className="w-8 h-8 rounded-full shadow-md transition-transform group-hover:scale-110"
                  style={{ background: preset.preview }}
                />
                <span className="text-[10px] text-muted-foreground leading-tight text-center">{preset.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-border">
          <div className="flex-1 flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-primary" />
            <span className="text-sm text-foreground font-medium">{presets[selectedPreset].name}</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-1">
            <RotateCcw className="w-3.5 h-3.5" /> Restaurar
          </Button>
          <Button size="sm" onClick={handleSave} className="gap-1">
            <Save className="w-3.5 h-3.5" /> Salvar Tema
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ThemeSettings;
