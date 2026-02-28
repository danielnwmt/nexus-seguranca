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

interface BgPreset {
  name: string;
  background: string;
  card: string;
  popover: string;
  secondary: string;
  muted: string;
  border: string;
  input: string;
  sidebarBg: string;
  sidebarBorder: string;
  sidebarAccent: string;
  cameraBg: string;
  cameraBorder: string;
  preview: string;
}

const colorPresets: ThemePreset[] = [
  { name: 'Ciano', primary: '175 80% 45%', accent: '160 70% 40%', preview: 'hsl(175, 80%, 45%)' },
  { name: 'Azul', primary: '217 91% 60%', accent: '210 80% 50%', preview: 'hsl(217, 91%, 60%)' },
  { name: 'Verde', primary: '142 70% 45%', accent: '152 60% 40%', preview: 'hsl(142, 70%, 45%)' },
  { name: 'Roxo', primary: '270 70% 55%', accent: '280 60% 45%', preview: 'hsl(270, 70%, 55%)' },
  { name: 'Laranja', primary: '25 95% 53%', accent: '35 90% 50%', preview: 'hsl(25, 95%, 53%)' },
  { name: 'Vermelho', primary: '0 72% 50%', accent: '10 70% 45%', preview: 'hsl(0, 72%, 50%)' },
  { name: 'Rosa', primary: '330 80% 55%', accent: '340 70% 45%', preview: 'hsl(330, 80%, 55%)' },
  { name: 'Dourado', primary: '45 90% 48%', accent: '38 85% 42%', preview: 'hsl(45, 90%, 48%)' },
];

const bgPresets: BgPreset[] = [
  {
    name: 'Escuro (Padrão)',
    background: '220 20% 7%', card: '220 18% 10%', popover: '220 18% 12%',
    secondary: '220 15% 16%', muted: '220 15% 14%', border: '220 15% 18%',
    input: '220 15% 18%', sidebarBg: '220 20% 9%', sidebarBorder: '220 15% 15%',
    sidebarAccent: '220 15% 14%', cameraBg: '220 20% 5%', cameraBorder: '220 15% 15%',
    preview: 'hsl(220, 20%, 7%)',
  },
  {
    name: 'Preto Puro',
    background: '0 0% 3%', card: '0 0% 6%', popover: '0 0% 8%',
    secondary: '0 0% 12%', muted: '0 0% 10%', border: '0 0% 14%',
    input: '0 0% 14%', sidebarBg: '0 0% 4%', sidebarBorder: '0 0% 10%',
    sidebarAccent: '0 0% 10%', cameraBg: '0 0% 2%', cameraBorder: '0 0% 10%',
    preview: 'hsl(0, 0%, 3%)',
  },
  {
    name: 'Azul Escuro',
    background: '230 25% 8%', card: '230 22% 11%', popover: '230 22% 13%',
    secondary: '230 18% 17%', muted: '230 18% 15%', border: '230 18% 20%',
    input: '230 18% 20%', sidebarBg: '230 25% 10%', sidebarBorder: '230 18% 16%',
    sidebarAccent: '230 18% 15%', cameraBg: '230 25% 6%', cameraBorder: '230 18% 16%',
    preview: 'hsl(230, 25%, 8%)',
  },
  {
    name: 'Cinza Carvão',
    background: '210 10% 10%', card: '210 8% 14%', popover: '210 8% 16%',
    secondary: '210 6% 20%', muted: '210 6% 18%', border: '210 6% 22%',
    input: '210 6% 22%', sidebarBg: '210 10% 12%', sidebarBorder: '210 6% 18%',
    sidebarAccent: '210 6% 18%', cameraBg: '210 10% 8%', cameraBorder: '210 6% 18%',
    preview: 'hsl(210, 10%, 10%)',
  },
  {
    name: 'Verde Escuro',
    background: '160 20% 6%', card: '160 18% 9%', popover: '160 18% 11%',
    secondary: '160 14% 15%', muted: '160 14% 13%', border: '160 14% 17%',
    input: '160 14% 17%', sidebarBg: '160 20% 8%', sidebarBorder: '160 14% 14%',
    sidebarAccent: '160 14% 13%', cameraBg: '160 20% 4%', cameraBorder: '160 14% 14%',
    preview: 'hsl(160, 20%, 6%)',
  },
  {
    name: 'Roxo Escuro',
    background: '270 20% 7%', card: '270 18% 10%', popover: '270 18% 12%',
    secondary: '270 14% 16%', muted: '270 14% 14%', border: '270 14% 18%',
    input: '270 14% 18%', sidebarBg: '270 20% 9%', sidebarBorder: '270 14% 15%',
    sidebarAccent: '270 14% 14%', cameraBg: '270 20% 5%', cameraBorder: '270 14% 15%',
    preview: 'hsl(270, 20%, 7%)',
  },
];

const STORAGE_KEY = 'nexus-theme';

function applyColorTheme(primary: string, accent: string) {
  const root = document.documentElement;
  root.style.setProperty('--primary', primary);
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--ring', primary);
  root.style.setProperty('--sidebar-primary', primary);
  root.style.setProperty('--sidebar-ring', primary);
  root.style.setProperty('--alarm-info', primary);
}

function applyBgTheme(bg: BgPreset) {
  const root = document.documentElement;
  root.style.setProperty('--background', bg.background);
  root.style.setProperty('--card', bg.card);
  root.style.setProperty('--card-foreground', '200 20% 90%');
  root.style.setProperty('--popover', bg.popover);
  root.style.setProperty('--secondary', bg.secondary);
  root.style.setProperty('--muted', bg.muted);
  root.style.setProperty('--border', bg.border);
  root.style.setProperty('--input', bg.input);
  root.style.setProperty('--sidebar-background', bg.sidebarBg);
  root.style.setProperty('--sidebar-border', bg.sidebarBorder);
  root.style.setProperty('--sidebar-accent', bg.sidebarAccent);
  root.style.setProperty('--camera-bg', bg.cameraBg);
  root.style.setProperty('--camera-border', bg.cameraBorder);
}

export function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const { primary, accent, bgIndex } = JSON.parse(saved);
      if (primary && accent) applyColorTheme(primary, accent);
      if (bgIndex !== undefined && bgPresets[bgIndex]) applyBgTheme(bgPresets[bgIndex]);
    } catch {}
  }
}

const ThemeSettings = () => {
  const { toast } = useToast();
  const [selectedColor, setSelectedColor] = useState(0);
  const [selectedBg, setSelectedBg] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const { primary, bgIndex } = JSON.parse(saved);
        const idx = colorPresets.findIndex(p => p.primary === primary);
        if (idx >= 0) setSelectedColor(idx);
        if (bgIndex !== undefined) setSelectedBg(bgIndex);
      } catch {}
    }
  }, []);

  const handleSelectColor = (index: number) => {
    setSelectedColor(index);
    applyColorTheme(colorPresets[index].primary, colorPresets[index].accent);
  };

  const handleSelectBg = (index: number) => {
    setSelectedBg(index);
    applyBgTheme(bgPresets[index]);
  };

  const handleSave = () => {
    const color = colorPresets[selectedColor];
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      primary: color.primary,
      accent: color.accent,
      bgIndex: selectedBg,
    }));
    toast({ title: 'Tema salvo', description: `Cor "${color.name}" com fundo "${bgPresets[selectedBg].name}" aplicados.` });
  };

  const handleReset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSelectedColor(0);
    setSelectedBg(0);
    applyColorTheme(colorPresets[0].primary, colorPresets[0].accent);
    applyBgTheme(bgPresets[0]);
    toast({ title: 'Tema restaurado', description: 'Cores padrão restauradas.' });
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Palette className="w-5 h-5 text-primary" />
          <div>
            <CardTitle className="text-base">Cores do Sistema</CardTitle>
            <CardDescription className="text-xs">Personalize as cores da interface</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Cor principal */}
        <div>
          <Label className="text-xs text-muted-foreground mb-3 block">Cor principal</Label>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
            {colorPresets.map((preset, i) => (
              <button
                key={preset.name}
                onClick={() => handleSelectColor(i)}
                className={`group flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all ${
                  selectedColor === i
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

        {/* Cor de fundo */}
        <div>
          <Label className="text-xs text-muted-foreground mb-3 block">Cor de fundo</Label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {bgPresets.map((preset, i) => (
              <button
                key={preset.name}
                onClick={() => handleSelectBg(i)}
                className={`group flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all ${
                  selectedBg === i
                    ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                    : 'border-border hover:border-muted-foreground/30'
                }`}
              >
                <div
                  className="w-10 h-8 rounded-md shadow-md transition-transform group-hover:scale-110 border border-white/10"
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
            <span className="text-sm text-foreground font-medium">
              {colorPresets[selectedColor].name} / {bgPresets[selectedBg].name}
            </span>
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
