import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NICHOS_CATEGORIZED, type NichoCategory } from "@/data/nichos";

interface CategorizedNichoDropdownProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function CategorizedNichoDropdown({ value, onChange, placeholder = "Ex: Restaurantes, Dentistas...", className }: CategorizedNichoDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (option: string) => {
    onChange(option);
    setOpen(false);
    setSearch("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setSearch("");
  };

  const query = search.toLowerCase();

  // Filter categories — show category if any item matches
  const filteredCategories: { cat: NichoCategory; items: string[] }[] = NICHOS_CATEGORIZED
    .map((cat) => ({
      cat,
      items: query ? cat.items.filter((i) => i.toLowerCase().includes(query)) : cat.items,
    }))
    .filter((c) => c.items.length > 0);

  const totalFiltered = filteredCategories.reduce((sum, c) => sum + c.items.length, 0);
  const totalAll = NICHOS_CATEGORIZED.reduce((sum, c) => sum + c.items.length, 0);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          if (!open) setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-[hsl(var(--hunter-card-bg))] border border-[hsl(var(--hunter-border))] text-sm text-foreground hover:border-[hsl(var(--hunter-blue)/0.5)] transition-colors"
      >
        <span className={value ? "text-foreground" : "text-muted-foreground"}>
          {value || placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <span onClick={handleClear} className="hover:text-destructive p-0.5 rounded">
              <X className="h-3 w-3" />
            </span>
          )}
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {open && (
        <div className="fixed inset-0 z-[9999]" style={{ pointerEvents: "none" }}>
          <div
            className="absolute z-[9999] rounded-xl border border-[hsl(var(--hunter-border))] bg-[hsl(220_26%_9%)] shadow-2xl overflow-hidden flex flex-col"
            style={{
              pointerEvents: "auto",
              top: ref.current ? ref.current.getBoundingClientRect().bottom + 4 : 0,
              left: ref.current ? ref.current.getBoundingClientRect().left : 0,
              width: ref.current ? Math.max(ref.current.getBoundingClientRect().width, 380) : 380,
              maxHeight: "calc(100vh - 120px)",
            }}
          >
            {/* Search */}
            <div className="p-2.5 border-b border-[hsl(var(--hunter-border))] shrink-0">
              <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[hsl(var(--hunter-card-bg))]">
                <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="💡 Digite para buscar em 603+ nichos..."
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {filteredCategories.length === 0 ? (
                <div className="px-3 py-6 text-sm text-muted-foreground text-center">Nenhum resultado encontrado</div>
              ) : (
                filteredCategories.map(({ cat, items }) => (
                  <div key={cat.label}>
                    {/* Category header */}
                    <div className="sticky top-0 z-10 px-3 py-2 bg-[hsl(220_26%_12%)] border-b border-[hsl(var(--hunter-border)/0.5)]">
                      <span className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--hunter-blue))]">
                        {cat.emoji} {cat.label}
                      </span>
                    </div>
                    {/* Items */}
                    <div className="flex flex-col py-1">
                      {items.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => handleSelect(item)}
                          className={cn(
                            "w-full text-left px-4 py-1.5 text-sm transition-colors",
                            item === value
                              ? "bg-[hsl(var(--hunter-blue)/0.2)] text-[hsl(var(--hunter-blue))] font-medium"
                              : "text-foreground/80 hover:bg-[hsl(var(--hunter-blue)/0.1)] hover:text-[hsl(var(--hunter-blue))]"
                          )}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-3 py-1.5 border-t border-[hsl(var(--hunter-border))] text-xs text-muted-foreground shrink-0">
              {totalFiltered} de {totalAll} nichos
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
