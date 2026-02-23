import React, { useState } from "react";
import { X, Upload, CheckCircle, Loader2, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface ImportModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

export function ImportModal({ onClose, onSuccess }: ImportModalProps) {
    const { user } = useAuth();
    const [file, setFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const [preview, setPreview] = useState<any[]>([]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            const reader = new FileReader();
            reader.onload = (evt) => {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: "binary" });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
                setPreview(data.slice(0, 5));
            };
            reader.readAsBinaryString(selectedFile);
        }
    };

    const cleanPhone = (raw: any): string | null => {
        if (!raw) return null;
        const digits = String(raw).replace(/\D/g, "");
        if (digits.length >= 10 && digits.length <= 13) return digits;
        return null;
    };

    const classifyTemp = (hasWa: boolean, hasEmail: boolean, hasSite: boolean): string => {
        if (hasWa && hasEmail && hasSite) return "Fervendo";
        if (hasWa && (hasEmail || hasSite)) return "Quente";
        if (hasWa) return "Morno";
        return "Frio";
    };

    const handleImport = async () => {
        if (!file || !user) return;
        setImporting(true);

        try {
            const reader = new FileReader();
            reader.onload = async (evt) => {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: "binary" });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rawData: any[] = XLSX.utils.sheet_to_json(ws);

                // Map columns (fuzzy match)
                const leadsToInsert = rawData.map((row: any) => {
                    const name = row.nome || row.Nome || row.name || row.Name || "Sem nome";
                    const phoneRaw = row.whatsapp || row.WhatsApp || row.telefone || row.Telefone || row.phone || row.Phone || null;
                    const phone = cleanPhone(phoneRaw);
                    const email = row.email || row.Email || null;
                    const site = row.site || row.Site || row.website || row.Website || null;
                    const nicho = row.nicho || row.Nicho || row.categoria || row.Categoria || "Geral";
                    const cidade = row.cidade || row.Cidade || "";
                    const estado = row.estado || row.Estado || "";

                    return {
                        nome_empresa: name,
                        whatsapp: phone,
                        telefone: phone,
                        email: email,
                        site: site,
                        nicho: nicho,
                        cidade: cidade,
                        estado: estado,
                        fonte: "Importado CSV",
                        status_funil: "Novo",
                        temperatura: classifyTemp(!!phone, !!email, !!site),
                        user_id: user.id
                    };
                }).filter(l => l.nome_empresa !== "Sem nome" || l.whatsapp);

                // Deduplicate locally by phone first
                const uniqueLeads = Array.from(new Map(leadsToInsert.map(l => [l.whatsapp, l])).values());
                const duplicatesCount = leadsToInsert.length - uniqueLeads.length;

                const { data, error } = await supabase.from("leads").insert(uniqueLeads);

                if (error) throw error;

                toast.success(`Importados ${uniqueLeads.length} contatos. Duplicados ignorados: ${duplicatesCount}`);
                onSuccess();
                onClose();
            };
            reader.readAsBinaryString(file);
        } catch (err: any) {
            console.error("Import error:", err);
            toast.error("Erro ao importar base: " + err.message);
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-[#0f111a] border border-white/10 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Download className="h-5 w-5 text-[hsl(var(--vallor-purple-light))]" />
                        Importar Base de Leads
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-white/5 rounded-lg transition-colors text-slate-400 hover:text-white">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
                    {!file ? (
                        <div
                            className="border-2 border-dashed border-white/10 rounded-xl p-10 text-center hover:border-[hsl(var(--vallor-purple))]/50 transition-colors cursor-pointer group"
                            onClick={() => document.getElementById("fileInput")?.click()}
                        >
                            <input id="fileInput" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
                            <div className="h-12 w-12 rounded-full bg-[hsl(var(--vallor-purple)/0.2)] flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                                <Upload className="h-6 w-6 text-[hsl(var(--vallor-purple-light))]" />
                            </div>
                            <p className="text-sm text-slate-300 font-medium tracking-tight">Clique para selecionar ou arraste o arquivo</p>
                            <p className="text-xs text-slate-500 mt-1">Suporta XLSX, XLS e CSV</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                                        <CheckCircle className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white leading-none">{file.name}</p>
                                        <p className="text-[11px] text-slate-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                </div>
                                <button onClick={() => { setFile(null); setPreview([]); }} className="text-red-400 hover:text-red-300 text-xs font-semibold px-3 py-1 hover:bg-red-400/10 rounded-lg transition-all">Limpar</button>
                            </div>

                            {preview.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Pré-visualização dos dados:</p>
                                    <div className="rounded-xl border border-white/10 overflow-hidden bg-black/20">
                                        <table className="w-full text-left border-collapse table-fixed">
                                            <thead className="bg-white/5">
                                                <tr>
                                                    {preview[0]?.map((h: any, i: number) => (
                                                        <th key={i} className="px-3 py-2 text-[10px] font-black text-slate-400 border-b border-white/5 uppercase">{String(h || "").substring(0, 15)}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {preview.slice(1).map((row, i) => (
                                                    <tr key={i} className="border-b border-white/5">
                                                        {row.map((cell: any, j: number) => (
                                                            <td key={j} className="px-3 py-2 text-[10px] text-slate-300 truncate">{String(cell || "")}</td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={handleImport}
                                    disabled={importing}
                                    className="flex-1 flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-[hsl(var(--vallor-purple))] hover:bg-[hsl(var(--vallor-purple-light))] text-white text-sm font-black transition-all shadow-lg shadow-purple-500/10 disabled:opacity-50 active:scale-95"
                                >
                                    {importing ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
                                    {importing ? "Processando..." : "Confirmar Importação"}
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
                        <p className="text-xs text-blue-300/80 leading-relaxed font-medium">
                            💡 <strong>Dica:</strong> Certifique-se que o arquivo possui colunas identificáveis como <strong>Nome</strong>, <strong>WhatsApp</strong> e <strong>Email</strong>. O sistema remove duplicados automaticamente pelo número de telefone.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
