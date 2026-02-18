export interface Lead {
  nome_empresa: string;
  nicho: string;
  cidade: string;
  estado: string;
  whatsapp?: string;
  email?: string;
  site?: string;
  telefone?: string;
  temperatura: "Fervendo" | "Quente" | "Morno" | "Frio" | "Desinteressado";
  fonte: string;
  status_funil: string;
}

const PREFIXOS_EMPRESA = [
  "Studio", "Clínica", "Espaço", "Centro", "Instituto", "Grupo",
  "Casa", "Loja", "Atelier", "Consultório", "Oficina", "Empresa",
  "Prime", "Top", "Max", "Plus", "Pro", "Master", "Elite", "Grand",
];

const SUFIXOS_EMPRESA = [
  "do João", "da Silva", "Express", "Já", "Fácil", "Total",
  "Completo", "Rápido", "Premium", "Especial", "Quality", "Solutions",
];

const NOMES_BRASILEIROS = [
  "João", "Maria", "Pedro", "Ana", "Carlos", "Fernanda", "Lucas", "Juliana",
  "Marcos", "Patricia", "Rafael", "Camila", "Felipe", "Isabela", "Rodrigo",
  "Larissa", "Gabriel", "Amanda", "Bruno", "Natalia", "Diego", "Leticia",
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generatePhoneBR(withCountryCode = true): string {
  const ddd = String(Math.floor(Math.random() * 89) + 11);
  const num = `9${String(Math.floor(Math.random() * 90000000) + 10000000)}`;
  return withCountryCode ? `55${ddd}${num}` : `(${ddd}) ${num.slice(0, 5)}-${num.slice(5)}`;
}

function generateEmail(nome: string, nicho: string): string {
  const domains = ["gmail.com", "hotmail.com", "yahoo.com.br", "outlook.com", "uol.com.br"];
  const sanitized = nome.toLowerCase().replace(/[^a-z]/g, "").slice(0, 12);
  const nichoSan = nicho.toLowerCase().replace(/[^a-z]/g, "").slice(0, 8);
  const rand = Math.floor(Math.random() * 99);
  const formats = [
    `${sanitized}${rand}@${randomFrom(domains)}`,
    `${nichoSan}.${sanitized}@${randomFrom(domains)}`,
    `contato.${sanitized}@${randomFrom(domains)}`,
  ];
  return randomFrom(formats);
}

function generateSite(nome: string, nicho: string): string {
  const tlds = [".com.br", ".com", ".net.br"];
  const sanitized = nome.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 15);
  const nichoSan = nicho.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
  return `www.${sanitized}${randomFrom(tlds)}`;
}

function generateCompanyName(nicho: string): string {
  const rand = Math.random();
  const nome = randomFrom(NOMES_BRASILEIROS);
  if (rand < 0.3) return `${nicho} ${randomFrom(PREFIXOS_EMPRESA)}`;
  if (rand < 0.55) return `${randomFrom(PREFIXOS_EMPRESA)} ${nome}`;
  if (rand < 0.75) return `${nome} ${nicho}`;
  return `${randomFrom(PREFIXOS_EMPRESA)} ${nicho} ${randomFrom(SUFIXOS_EMPRESA)}`;
}

function classifyTemperature(hasWhatsApp: boolean, hasEmail: boolean, hasSite: boolean, hasValidPhone: boolean): Lead["temperatura"] {
  if (!hasValidPhone && !hasWhatsApp) return "Desinteressado";
  if (hasWhatsApp && hasEmail && hasSite) return "Fervendo";
  if (hasWhatsApp && (hasEmail || hasSite)) return "Quente";
  if (hasWhatsApp) return "Morno";
  return "Frio";
}

export function generateMockLeads(nicho: string, cidade: string, estado: string, quantidade: number): Lead[] {
  const leads: Lead[] = [];

  for (let i = 0; i < quantidade; i++) {
    const rand = Math.random();

    // Distribute contact types realistically
    const hasWhatsApp = rand > 0.25; // 75% have WhatsApp
    const hasEmail = rand > 0.4;     // 60% have email
    const hasSite = rand > 0.55;     // 45% have site
    const hasValidPhone = rand > 0.1; // 90% have phone

    const nomeEmpresa = generateCompanyName(nicho);
    const temperatura = classifyTemperature(hasWhatsApp, hasEmail, hasSite, hasValidPhone);

    leads.push({
      nome_empresa: nomeEmpresa,
      nicho,
      cidade,
      estado,
      whatsapp: hasWhatsApp ? generatePhoneBR(true) : undefined,
      email: hasEmail ? generateEmail(nomeEmpresa, nicho) : undefined,
      site: hasSite ? generateSite(nomeEmpresa, nicho) : undefined,
      telefone: hasValidPhone ? generatePhoneBR(false) : undefined,
      temperatura,
      fonte: "Google Maps simulado",
      status_funil: "Novo",
    });
  }

  return leads;
}

export function getTemperaturaColor(temperatura: string): string {
  switch (temperatura) {
    case "Fervendo": return "text-red-400 bg-red-400/10 border-red-400/30";
    case "Quente": return "text-orange-400 bg-orange-400/10 border-orange-400/30";
    case "Morno": return "text-yellow-400 bg-yellow-400/10 border-yellow-400/30";
    case "Frio": return "text-blue-400 bg-blue-400/10 border-blue-400/30";
    case "Desinteressado": return "text-gray-400 bg-gray-400/10 border-gray-400/30";
    default: return "text-gray-400 bg-gray-400/10 border-gray-400/30";
  }
}

export function getTemperaturaIcon(temperatura: string): string {
  switch (temperatura) {
    case "Fervendo": return "🔥";
    case "Quente": return "♨️";
    case "Morno": return "🌡️";
    case "Frio": return "❄️";
    case "Desinteressado": return "💤";
    default: return "❓";
  }
}
