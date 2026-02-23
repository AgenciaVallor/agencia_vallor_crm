import { useState } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import * as XLSX from "xlsx";
import { toast } from "sonner";

interface ImportModalProps {
    onClose: () => void;
    onComplete: () => void;
}

export default function ImportModal({ onClose, onComplete }: ImportModalProps) {
    const { user } = useAuth();
    const [file, setFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const [preview, setPreview] = useState<any[]>([]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setFile(f);

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: "binary" });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
            setPreview(data.slice(0, 6)); // Show first 5 rows
        };
        reader.readAsBinaryString(f);
    };

    const handleImport = async () => {
        if (!file || !user) return;
        setImporting(true);

        try {
            const reader = new FileReader();
            reader.onload = async (evt) => {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: "binary" });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const rows: any[] = XLSX.utils.sheet_to_json(ws);

                if (rows.length === 0) {
                    toast.error("O arquivo está vazio.");
                    setImporting(false);
                    return;
                }

                // Remove duplicates and Map columns
                const seenPhones = new Set<string>();
                const { data: existingLeads } = await supabase
                    .from("leads")
                    .select("whatsapp, telefone")
                    .eq("user_id", user.id);

                if (existingLeads) {
                    existingLeads.forEach(l => {
                        if (l.whatsapp) seenPhones.add(l.whatsapp.replace(/\D/g, ""));
                        if (l.telefone) seenPhones.add(l.telefone.replace(/\D/g, ""));
                    });
                }

                let duplicatesRemoved = 0;
                const leadsToInsert = rows.reduce((acc: any[], r: any) => {
                    const rawPhone = String(r.whatsapp || r.WhatsApp || r.celular || r.Celular || r.telefone || r.Telefone || r.phone || "").replace(/\D/g, "");
                    const email = r.email || r.Email || null;
                    const site = r.site || r.Site || r.website || null;

                    if (rawPhone && seenPhones.has(rawPhone)) {
                        duplicatesRemoved++;
                        return acc;
                    }
                    if (rawPhone) seenPhones.add(rawPhone);

                    // Classificação de temperatura
                    let temperatura = "Frio";
                    if (rawPhone && email && site) temperatura = "Fervendo";
                    else if (rawPhone && (email || site)) temperatura = "Quente";
                    else if (rawPhone) temperatura = "Morno";

                    acc.push({
                        user_id: user.id,
                        nome_empresa: r.nome || r.empresa || r.name || r.Nome || "Sem Nome",
                        whatsapp: rawPhone || null,
                        email: email,
                        telefone: rawPhone || null,
                        cidade: r.cidade || r.Cidade || null,
                        estado: r.estado || r.Estado || r.uf || r.UF || null,
                        nicho: r.nicho || r.Nicho || r.categoria || "Importado",
                        site: site,
                        fonte: "Importado CSV",
                        status_funil: "Novo",
                        temperatura: temperatura
                    });
                    return acc;
                }, []);

                if (leadsToInsert.length === 0) {
                    toast.error("Nenhum lead novo para importar.");
                    setImporting(false);
                    return;
                }

                const { error } = await supabase.from("leads").insert(leadsToInsert);
                if (error) throw error;

                toast.success(`Importados ${leadsToInsert.length} contatos. Duplicados removidos: ${duplicatesRemoved}`);
                onComplete();
            };
            reader.readAsBinaryString(file);
        } catch (err) {
            console.error(err);
            toast.error("Erro ao importar arquivo. Verifique o formato.");
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={onClose}>
            <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-[#1a1c2e] shadow-2xl p-8 space-y-6" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
                    <X className="h-6 w-6" />
                </button>

                <div className="space-y-1">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Upload className="h-6 w-6 text-primary" /> Importar Contatos
                    </h2>
                    <p className="text-sm text-slate-400">Suba um arquivo Excel (.xlsx, .xls) ou CSV com seus leads.</p>
                </div>

                <div className="grid gap-6">
                    <div className="relative border-2 border-dashed border-white/10 rounded-2xl p-10 flex flex-col items-center justify-center group hover:border-primary/50 transition-colors">
                        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                            <Upload className="h-6 w-6" />
                        </div>
                        <p className="text-sm font-medium text-slate-200">
                            {file ? file.name : "Clique para selecionar ou arraste o arquivo"}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">Colunas sugeridas: Nome, WhatsApp, Email, Nicho, Cidade, Estado</p>
                    </div>

                    {preview.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Preview dos dados:</p>
                            <div className="rounded-xl border border-white/5 bg-black/20 overflow-hidden">
                                <table className="w-full text-left text-xs text-slate-300">
                                    <thead className="bg-white/5">
                                        <tr>{preview[0].map((h: any, i: number) => <th key={i} className="px-3 py-2 font-semibold">{h}</th>)}</tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {preview.slice(1).map((row: any, i: number) => (
                                            <tr key={i} className="hover:bg-white/5 transition-colors">
                                                {row.map((c: any, j: number) => <td key={j} className="px-3 py-2 truncate max-w-[120px]">{String(c)}</td>)}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={onClose}
                            className="flex-1 h-12 rounded-xl border border-white/10 text-slate-300 font-medium hover:bg-white/5 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleImport}
                            disabled={!file || importing}
                            className="flex-[2] h-12 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {importing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                            {importing ? "Importando..." : `Importar ${file ? "Contatos" : ""}`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
