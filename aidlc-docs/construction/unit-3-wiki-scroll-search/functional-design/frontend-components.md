# Frontend Components Design: Unit 3 - Wiki Técnica com Scroll Delimitado & Busca

## 1. ProjectView Modification
Na aba `overview` de `ProjectView.tsx`:

### State Added
```typescript
const [wikiSearchQuery, setWikiSearchQuery] = useState('');
```

### Component Structure
```tsx
<div className="relative bg-zinc-950/80 backdrop-blur-xl p-6 md:p-8 rounded-xl border border-white/5 h-full">
  {/* Header com Título, Indicador de IA e Barra de Busca */}
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-zinc-800/80">
    <h2 className="text-lg font-bold flex items-center gap-3 text-white">
      <div className="p-2 bg-indigo-500/10 rounded-lg">
        <BrainCircuit className="text-indigo-400" size={22} />
      </div>
      Executive Summary & Wiki Técnica
    </h2>

    {/* Campo de Busca Simples */}
    <div className="flex items-center gap-2">
      <div className="relative flex items-center">
        <Search size={14} className="absolute left-3 text-zinc-500 pointer-events-none" />
        <input
          type="text"
          value={wikiSearchQuery}
          onChange={(e) => setWikiSearchQuery(e.target.value)}
          placeholder="Buscar na wiki (ex: PBT, rotas)..."
          className="pl-8 pr-7 py-1.5 bg-zinc-900 border border-zinc-800 focus:border-indigo-500/60 rounded-lg text-xs text-white placeholder-zinc-500 w-48 sm:w-64 focus:outline-none transition-all"
        />
        {wikiSearchQuery && (
          <button
            onClick={() => setWikiSearchQuery('')}
            className="absolute right-2 text-zinc-500 hover:text-zinc-300 p-0.5"
            title="Limpar busca"
          >
            <X size={12} />
          </button>
        )}
      </div>
      {wikiSearchQuery.trim() && (
        <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-md shrink-0">
          {totalMatches} {totalMatches === 1 ? 'resultado' : 'resultados'}
        </span>
      )}
    </div>
  </div>

  {/* Container com Scroll Delimitado e Highlighting */}
  <div className="max-h-[550px] overflow-y-auto pr-3 space-y-3 custom-scrollbar text-zinc-300 text-xs md:text-sm leading-relaxed">
    {/* Renderização com realce */}
  </div>
</div>
```
