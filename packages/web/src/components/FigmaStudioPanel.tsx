import { useState, useEffect } from 'react';
import { 
  Sparkles, 
  CheckCircle, 
  RefreshCw, 
  Layers,
  Check,
  X,
  Bot
} from 'lucide-react';
import { io } from 'socket.io-client';

interface FigmaStudioPanelProps {
  projectId: string;
  apiUrl: string;
}

export interface UIComponentItem {
  id: string;
  project_id: string;
  name: string;
  source_type: string;
  source_input?: string;
  design_tokens?: string;
  component_code: string;
  file_path?: string;
  created_at: string;
}

export default function FigmaStudioPanel({ projectId, apiUrl }: FigmaStudioPanelProps) {
  // Input State
  const [mode, setMode] = useState<'prompt' | 'figma'>('prompt');
  const [componentName, setComponentName] = useState('TravelBookingCard');
  const [promptInput, setPromptInput] = useState(
    'Card de Reserva de Pacote Turístico com imagem de fundo, badge de 20% OFF, avaliação 4.9 estrelas, preço em R$, lista de inclusos (Voo + Hotel) e botão de reserva com efeito hover neon.'
  );
  const [figmaUrl, setFigmaUrl] = useState('');
  const [figmaToken, setFigmaToken] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-flex');

  // Generation & Results State
  const [importing, setImporting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Active Component & Tokens
  const [activeCode, setActiveCode] = useState<string>('');
  const [designTokens, setDesignTokens] = useState<any>({
    colors: [
      { name: 'Brand Indigo', hex: '#4F46E5', role: 'Primary' },
      { name: 'Cyan Neon', hex: '#06B6D4', role: 'Accent' },
      { name: 'Emerald Glow', hex: '#10B981', role: 'Success' },
      { name: 'Dark Slate', hex: '#09090B', role: 'Background' },
      { name: 'Card Surface', hex: '#18181B', role: 'Surface' },
    ],
    typography: {
      fontFamily: 'Inter, sans-serif',
      title: 'text-xl font-bold tracking-tight',
      subtitle: 'text-xs text-zinc-400',
    },
    spacing: { padding: 'p-6', borderRadius: 'rounded-2xl', gap: 'gap-4' }
  });

  // Preview & Viewport State
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [activeViewTab, setActiveViewTab] = useState<'preview' | 'code'>('preview');

  // History of components
  const [savedComponents, setSavedComponents] = useState<UIComponentItem[]>([]);

  const fetchSavedComponents = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/projects/${projectId}/figma/components`);
      const data = await res.json();
      if (data.success && data.components) {
        setSavedComponents(data.components);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchSavedComponents();

    const socket = io(apiUrl);
    socket.emit('join_project', { projectId });

    socket.on('figma_component_generated', (data) => {
      if (data.component) {
        setActiveCode(data.component.component_code);
        setComponentName(data.component.name);
        fetchSavedComponents();
      }
    });

    return () => {
      socket.close();
    };
  }, [projectId, apiUrl]);

  // Importar Specs do Figma
  const handleImportFigma = async () => {
    if (!figmaUrl.trim()) return;
    setImporting(true);

    try {
      const res = await fetch(`${apiUrl}/api/projects/${projectId}/figma/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ figmaUrl, accessToken: figmaToken }),
      });

      const data = await res.json();
      if (data.success) {
        if (data.designTokens) setDesignTokens(data.designTokens);
        setComponentName(data.name.replace(/[^a-zA-Z0-9]/g, '') || 'FigmaComponent');
        setPromptInput(`Componente importado do Figma (${data.name}). Fidelidade visual total aos tokens de cor e layout.`);
      }
    } catch (e) {
      console.error('Falha ao importar Figma:', e);
    } finally {
      setImporting(false);
    }
  };

  // Gerar Componente com Alpha Frontend
  const handleGenerate = async () => {
    setGenerating(true);
    setSaveSuccessMsg(null);

    try {
      const res = await fetch(`${apiUrl}/api/projects/${projectId}/figma/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          componentName: componentName.trim() || 'CustomCard',
          prompt: promptInput,
          designTokens,
          sourceType: mode === 'figma' ? 'figma_url' : 'prompt',
          sourceInput: mode === 'figma' ? figmaUrl : promptInput,
          model: selectedModel,
        }),
      });

      const data = await res.json();
      if (data.success && data.component) {
        setActiveCode(data.component.component_code);
        setActiveViewTab('preview');
        fetchSavedComponents();
      }
    } catch (e) {
      console.error('Erro ao gerar componente:', e);
    } finally {
      setGenerating(false);
    }
  };

  // Salvar no Repositório do Projeto
  const handleSaveToProject = async () => {
    if (!activeCode) return;
    setSaving(true);
    setSaveSuccessMsg(null);

    try {
      const res = await fetch(`${apiUrl}/api/projects/${projectId}/figma/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          componentName: componentName.trim() || 'CustomCard',
          componentCode: activeCode,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSaveSuccessMsg(data.message || `Componente salvo em ${data.filePath}`);
      }
    } catch (e: any) {
      console.error('Erro ao salvar componente:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyCode = () => {
    if (!activeCode) return;
    navigator.clipboard.writeText(activeCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLoadComponent = (comp: UIComponentItem) => {
    setComponentName(comp.name);
    setActiveCode(comp.component_code);
    if (comp.design_tokens) {
      try {
        setDesignTokens(JSON.parse(comp.design_tokens));
      } catch (e) {}
    }
    setActiveViewTab('preview');
  };

  const handleDeleteComponent = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`${apiUrl}/api/projects/${projectId}/figma/components/${id}`, {
        method: 'DELETE',
      });
      fetchSavedComponents();
    } catch (e) {}
  };

  // Preset prompts rápidos
  const presets = [
    { label: '🏖️ Card de Pacote de Viagem', name: 'TravelBookingCard', prompt: 'Card de Reserva de Pacote Turístico com imagem de fundo, badge 20% OFF, avaliação 4.9 estrelas, preço em R$, itens inclusos (Voo + Hotel) e botão Reservar com efeito neon.' },
    { label: '✈️ Painel de Filtros de Voo', name: 'FlightSearchFilter', prompt: 'Painel de filtros de passagens aéreas com sliders de preço, checkboxes de companhias aéreas, escalas e ordenação por melhor preço.' },
    { label: '🏨 Modal de Detalhes do Hotel', name: 'HotelDetailsModal', prompt: 'Modal com galeria de fotos de resort, comodidades com ícones (Wi-Fi, Piscina, Café), mapa simulado, seletor de datas e botão de confirmação.' },
  ];

  // Gera HTML seguro para o Live Preview Sandbox
  const previewHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Inter', sans-serif;
            background-color: #09090b;
            color: #ffffff;
            margin: 0;
            padding: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            box-sizing: border-box;
          }
        </style>
      </head>
      <body>
        <div id="root" class="w-full flex justify-center">
          <!-- Live Preview Render Component Simulation -->
          <div class="max-w-md w-full p-6 rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-[0_0_30px_rgba(79,70,229,0.2)] backdrop-blur-xl space-y-4">
            <div class="relative overflow-hidden rounded-xl h-44 bg-gradient-to-tr from-indigo-900/80 via-purple-900/60 to-cyan-900/80 flex items-center justify-center border border-white/10">
              <span class="text-4xl">🏖️</span>
              <span class="absolute top-3 right-3 px-2.5 py-1 bg-emerald-500/90 text-white text-[10px] font-bold rounded-full shadow-lg">
                20% OFF
              </span>
              <span class="absolute bottom-3 left-3 px-2.5 py-0.5 bg-black/60 backdrop-blur-md text-zinc-200 text-xs font-semibold rounded-lg">
                ⭐ 4.9 (1.420 avaliações)
              </span>
            </div>

            <div>
              <div class="flex items-center justify-between">
                <h4 class="text-lg font-bold text-white tracking-tight">Pacote Caribe Premium 2026</h4>
                <span class="text-xs px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 font-mono">7 Dias</span>
              </div>
              <p class="text-xs text-zinc-400 mt-1">Cancún, Riviera Maya • Voo direto + All-Inclusive 5 estrelas.</p>
            </div>

            <div class="grid grid-cols-2 gap-2 text-[11px] text-zinc-300 py-2 border-y border-zinc-800/80">
              <div class="flex items-center gap-1.5">
                <span class="text-emerald-400 font-bold">✓</span> Passagem Aérea Ida/Volta
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-emerald-400 font-bold">✓</span> Traslado Incluso
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-emerald-400 font-bold">✓</span> Cancelamento Grátis
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-emerald-400 font-bold">✓</span> Seguro Viagem
              </div>
            </div>

            <div class="flex items-center justify-between pt-1">
              <div>
                <span class="text-[10px] uppercase text-zinc-500 font-bold block">A partir de</span>
                <div class="flex items-baseline gap-1">
                  <span class="text-lg font-black text-emerald-400">R$ 2.490</span>
                  <span class="text-[10px] text-zinc-500 line-through">R$ 3.120</span>
                </div>
              </div>

              <button class="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white rounded-xl text-xs font-bold transition-all shadow-[0_0_15px_rgba(79,70,229,0.4)] cursor-pointer">
                Reservar Agora ➔
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  return (
    <div className="space-y-6">
      {/* Top Banner: Alpha Frontend & Figma Studio Header */}
      <div className="relative overflow-hidden bg-zinc-950/80 border border-zinc-800 rounded-2xl p-6 backdrop-blur-xl shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl -z-10"></div>

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-cyan-500/20 text-cyan-400 rounded-2xl border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
              <Sparkles size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">
                  Figma Studio & Gerador UI: Alpha Frontend
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-bold">
                  React 19 + Tailwind
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
                O agente <strong className="text-cyan-400">Alpha Frontend</strong> lê especificações e arquivos do Figma, extrai Design Tokens de cores/layout e gera componentes modernos com Live Preview e exportação direta para o repositório.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-400">Modelo:</span>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs rounded-xl px-3 py-2 font-mono focus:outline-none focus:border-cyan-500"
            >
              <option value="gemini-flex">gemini-flex (Econômico)</option>
              <option value="gemini-3.7-flash">gemini-3.7-flash (Raciocínio)</option>
              <option value="gemini-3.6-flash">gemini-3.6-flash</option>
              <option value="gemini-2.5-flash">gemini-2.5-flash</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Studio Grid: Controls vs Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Inputs & Design Spec (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Mode Switcher */}
          <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <span className="text-xs font-bold text-white uppercase tracking-wider">Origem do Design</span>
              <div className="bg-zinc-900 p-1 border border-zinc-800 rounded-xl flex items-center text-xs">
                <button
                  onClick={() => setMode('prompt')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    mode === 'prompt' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  ✨ Descrição / Prompt
                </button>
                <button
                  onClick={() => setMode('figma')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    mode === 'figma' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  🔗 Figma URL
                </button>
              </div>
            </div>

            {/* Input fields based on mode */}
            {mode === 'figma' ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">
                    URL do Arquivo ou Frame do Figma
                  </label>
                  <input
                    type="text"
                    value={figmaUrl}
                    onChange={(e) => setFigmaUrl(e.target.value)}
                    placeholder="https://www.figma.com/design/:fileKey/Nome?node-id=1:2"
                    className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-700/80 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">
                    Figma Personal Access Token (Opcional se configurado no .env)
                  </label>
                  <input
                    type="password"
                    value={figmaToken}
                    onChange={(e) => setFigmaToken(e.target.value)}
                    placeholder="figd_xxxxxxxxxxxxxxxx..."
                    className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-700/80 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>

                <button
                  onClick={handleImportFigma}
                  disabled={importing || !figmaUrl.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all border border-zinc-700"
                >
                  {importing ? (
                    <>
                      <RefreshCw size={14} className="animate-spin text-cyan-400" />
                      Importando Specs do Figma...
                    </>
                  ) : (
                    <>
                      <Layers size={14} className="text-cyan-400" />
                      Importar & Mapear Tokens do Figma
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Presets Rápidos */}
                <div>
                  <span className="text-[11px] font-bold text-zinc-400 block mb-1.5">Sugestões Rápidas:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {presets.map((preset, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setComponentName(preset.name);
                          setPromptInput(preset.prompt);
                        }}
                        className="text-[11px] px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 rounded-lg transition-all"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">
                    Nome do Componente React (PascalCase)
                  </label>
                  <input
                    type="text"
                    value={componentName}
                    onChange={(e) => setComponentName(e.target.value)}
                    placeholder="Ex: TravelBookingCard"
                    className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-700/80 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">
                    Especificação Visual / Descrição do Componente
                  </label>
                  <textarea
                    rows={4}
                    value={promptInput}
                    onChange={(e) => setPromptInput(e.target.value)}
                    placeholder="Descreva layout, botões, estados e micro-interações..."
                    className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-700/80 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 leading-relaxed"
                  />
                </div>
              </div>
            )}

            {/* Botão de Disparo da Geração */}
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-[0_0_20px_rgba(79,70,229,0.4)]"
            >
              {generating ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  Alpha Frontend Gerando Componente...
                </>
              ) : (
                <>
                  <Sparkles size={15} />
                  Gerar Componente React 19 + Tailwind
                </>
              )}
            </button>
          </div>

          {/* Design Tokens Extracted Card */}
          <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <h3 className="text-xs font-bold text-white flex items-center gap-2">
                <Layers size={14} className="text-cyan-400" />
                Design Tokens Mapeados
              </h3>
              <span className="text-[10px] font-mono text-zinc-500">ui-figma-reader</span>
            </div>

            {/* Colors Palette */}
            <div>
              <span className="text-[11px] text-zinc-400 block mb-1.5 font-semibold">Paleta de Cores:</span>
              <div className="grid grid-cols-5 gap-2">
                {designTokens.colors?.map((col: any, idx: number) => (
                  <div
                    key={idx}
                    onClick={() => navigator.clipboard.writeText(col.hex)}
                    title={`Clique para copiar ${col.hex}`}
                    className="flex flex-col items-center gap-1 p-2 bg-zinc-900 border border-zinc-800 rounded-xl cursor-pointer hover:border-zinc-600 transition-all group"
                  >
                    <div
                      className="w-7 h-7 rounded-lg shadow-sm border border-white/10 group-hover:scale-105 transition-transform"
                      style={{ backgroundColor: col.hex }}
                    ></div>
                    <span className="text-[9px] font-mono text-zinc-400 group-hover:text-white truncate max-w-full">
                      {col.hex}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Typography & Spacing Specs */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800/80 text-[11px] text-zinc-300">
              <div className="bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-800">
                <span className="text-[10px] uppercase font-bold text-zinc-500 block">Fonte & Raio</span>
                <span className="font-mono text-xs text-indigo-300">Inter • 16px (12px Rad)</span>
              </div>
              <div className="bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-800">
                <span className="text-[10px] uppercase font-bold text-zinc-500 block">Auto-Layout</span>
                <span className="font-mono text-xs text-cyan-300">Flexbox • Gap-4</span>
              </div>
            </div>
          </div>

          {/* Histórico de Componentes Salvos */}
          {savedComponents.length > 0 && (
            <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-5 space-y-3">
              <h3 className="text-xs font-bold text-white flex items-center justify-between border-b border-zinc-800 pb-2">
                <span>Galeria de Componentes ({savedComponents.length})</span>
                <span className="text-[10px] text-zinc-500 font-mono">Repositório</span>
              </h3>

              <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                {savedComponents.map(comp => (
                  <div
                    key={comp.id}
                    onClick={() => handleLoadComponent(comp)}
                    className="p-2.5 bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800/80 rounded-xl cursor-pointer flex items-center justify-between transition-all group"
                  >
                    <div className="flex items-center gap-2">
                      <Layers size={14} className="text-indigo-400" />
                      <span className="text-xs font-bold text-white group-hover:text-indigo-300">
                        {comp.name}.tsx
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {new Date(comp.created_at).toLocaleDateString('pt-BR')}
                      </span>
                      <button
                        onClick={(e) => handleDeleteComponent(comp.id, e)}
                        className="p-1 text-zinc-500 hover:text-rose-400 transition-colors"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Code Editor & Live Preview Sandbox (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-zinc-950/90 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[750px]">
            {/* Tab Bar: Preview vs Code */}
            <div className="p-3 bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveViewTab('preview')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeViewTab === 'preview'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Sparkles size={14} />
                  Live Preview Sandbox
                </button>

                <button
                  onClick={() => setActiveViewTab('code')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeViewTab === 'code'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Layers size={14} />
                  Código TSX ({componentName}.tsx)
                </button>
              </div>

              {/* Device Selector for Preview */}
              {activeViewTab === 'preview' && (
                <div className="bg-zinc-950 p-1 border border-zinc-800 rounded-xl flex items-center gap-1 text-xs">
                  <button
                    onClick={() => setPreviewDevice('desktop')}
                    className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                      previewDevice === 'desktop' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                    title="Desktop View"
                  >
                    🖥️ Desktop
                  </button>
                  <button
                    onClick={() => setPreviewDevice('tablet')}
                    className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                      previewDevice === 'tablet' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                    title="Tablet View"
                  >
                    📱 Tablet
                  </button>
                  <button
                    onClick={() => setPreviewDevice('mobile')}
                    className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                      previewDevice === 'mobile' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                    title="Mobile View"
                  >
                    📲 Mobile
                  </button>
                </div>
              )}

              {/* Code Actions */}
              {activeViewTab === 'code' && activeCode && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-1 px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium border border-zinc-700 transition-all"
                  >
                    {copied ? <Check size={13} className="text-emerald-400" /> : <Bot size={13} />}
                    {copied ? 'Copiado!' : 'Copiar TSX'}
                  </button>
                </div>
              )}
            </div>

            {/* Main Display Area */}
            <div className="flex-1 overflow-hidden relative bg-black/60">
              {activeViewTab === 'preview' ? (
                /* LIVE PREVIEW IFRAME SANDBOX */
                <div className="w-full h-full flex items-center justify-center p-4 overflow-auto custom-scrollbar">
                  <div
                    className={`h-full border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 bg-zinc-950 ${
                      previewDevice === 'desktop' ? 'w-full' :
                      previewDevice === 'tablet' ? 'w-[600px]' : 'w-[375px]'
                    }`}
                  >
                    <iframe
                      srcDoc={previewHtml}
                      title="Live Preview"
                      sandbox="allow-scripts"
                      className="w-full h-full border-0"
                    />
                  </div>
                </div>
              ) : (
                /* TSX CODE EDITOR VIEW */
                <div className="w-full h-full overflow-auto p-4 font-mono text-xs custom-scrollbar">
                  {activeCode ? (
                    <pre className="text-zinc-300 leading-relaxed whitespace-pre font-mono">
                      <code>{activeCode}</code>
                    </pre>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-2">
                      <Layers size={36} className="text-zinc-600" />
                      <p className="text-xs">Nenhum componente gerado ainda.</p>
                      <p className="text-[11px]">Clique em "Gerar Componente" para o Alpha Frontend criar o código TSX.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Action Bar */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-900/80 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                {saveSuccessMsg ? (
                  <span className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle size={15} />
                    {saveSuccessMsg}
                  </span>
                ) : (
                  <span className="text-[11px] text-zinc-400 font-mono">
                    Destino: <strong className="text-white">src/components/{componentName}.tsx</strong>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveToProject}
                  disabled={saving || !activeCode}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_20px_rgba(16,185,129,0.5)]"
                >
                  {saving ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Gravando no Repositório...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={14} />
                      Salvar Componente no Projeto
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
