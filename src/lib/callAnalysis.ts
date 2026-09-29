import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import type { FathomTranscriptItem } from "./fathom";
import { normalizeMatchKey } from "./clientMatch";

// ---------- Métricas sin IA (a partir de la transcripción) ----------

export interface TranscriptMetrics {
  closerTalkPct: number | null;
  closerQuestions: number;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Porcentaje de palabras dichas por el closer (quien grabó la llamada) y número de
 * preguntas que ha hecho. En una llamada de venta sana el closer habla ~30-45%.
 */
export function computeTranscriptMetrics(
  transcript: FathomTranscriptItem[],
  closer: { name?: string | null; email?: string | null }
): TranscriptMetrics {
  const closerName = closer.name ? normalizeMatchKey(closer.name) : null;
  const closerEmail = closer.email ? normalizeMatchKey(closer.email) : null;
  let closerWords = 0;
  let totalWords = 0;
  let closerQuestions = 0;

  for (const item of transcript) {
    const text = item.text ?? "";
    const words = wordCount(text);
    totalWords += words;
    const speakerName = item.speaker?.display_name ? normalizeMatchKey(item.speaker.display_name) : null;
    const speakerEmail = item.speaker?.matched_calendar_invitee_email
      ? normalizeMatchKey(item.speaker.matched_calendar_invitee_email)
      : null;
    const isCloser =
      (closerEmail != null && speakerEmail === closerEmail) || (closerName != null && speakerName === closerName);
    if (isCloser) {
      closerWords += words;
      closerQuestions += (text.match(/\?/g) ?? []).length;
    }
  }

  return {
    closerTalkPct: totalWords > 0 ? (closerWords / totalWords) * 100 : null,
    closerQuestions,
  };
}

export function formatTranscript(transcript: FathomTranscriptItem[]): string {
  return transcript
    .map((t) => `[${t.timestamp ?? ""}] ${t.speaker?.display_name ?? "?"}: ${t.text ?? ""}`)
    .join("\n");
}

// ---------- Análisis con Claude ----------

export const OBJECTION_TYPES = [
  "precio",
  "tiempo",
  "pareja_o_terceros",
  "confianza",
  "pensarlo",
  "timing",
  "otro",
] as const;

export const OBJECTION_LABELS: Record<(typeof OBJECTION_TYPES)[number], string> = {
  precio: "Precio / dinero",
  tiempo: "Falta de tiempo",
  pareja_o_terceros: "Consultarlo con pareja/terceros",
  confianza: "Confianza / malas experiencias",
  pensarlo: "\"Tengo que pensarlo\"",
  timing: "No es el momento",
  otro: "Otra",
};

const CallAnalysisSchema = z.object({
  es_llamada_de_venta: z
    .boolean()
    .describe("false si es una reunión interna, de onboarding, revisión de un cliente ya activo, etc."),
  resultado: z
    .enum(["cerrada", "seguimiento", "perdida"])
    .describe(
      "cerrada = el prospecto dijo que sí y se acordó pago o fianza; seguimiento = quedó pendiente de decidir; perdida = dijo que no"
    ),
  importe: z
    .number()
    .nullable()
    .describe("Importe total del programa acordado en euros si se cerró; si no, el importe ofrecido; null si no se habló de precio"),
  plan: z.string().nullable().describe("Programa/duración acordado u ofrecido, p. ej. '6 meses'"),
  forma_de_pago: z.string().nullable().describe("p. ej. 'pago único', 'financiado 12 meses', 'fianza 150 €'"),
  objeciones: z.array(
    z.object({
      tipo: z.enum(OBJECTION_TYPES),
      detalle: z.string().describe("Qué dijo el prospecto, en una frase"),
      superada: z.boolean().describe("true si el closer la resolvió durante la llamada"),
    })
  ),
  puntuacion_global: z.number().describe("Nota del closer de 1 a 10"),
  fases: z.object({
    conexion: z.number().describe("1-10: rapport y control de la llamada"),
    descubrimiento: z.number().describe("1-10: preguntas para entender situación, objetivo e historial"),
    dolor: z.number().describe("1-10: profundizar en el problema y la urgencia"),
    presentacion: z.number().describe("1-10: conectar la oferta con lo que el prospecto contó"),
    cierre: z.number().describe("1-10: pedir la venta y manejar objeciones"),
  }),
  puntos_fuertes: z.array(z.string()).describe("2-4 cosas que el closer hizo bien, concretas"),
  mejoras: z.array(z.string()).describe("2-4 cosas concretas a mejorar, citando el momento de la llamada"),
  resumen: z.string().describe("2-3 frases: quién es el prospecto, qué quiere y cómo terminó"),
});

export type CallAnalysis = z.infer<typeof CallAnalysisSchema>;

const SYSTEM_PROMPT = `Eres un director comercial que audita llamadas de venta de un negocio de coaching online de fitness y nutrición (programas de 6 y 12 meses, venta por llamada 1 a 1).
Analiza la transcripción de la llamada y devuelve el análisis estructurado. El "closer" es quien grabó la llamada; el otro participante es el prospecto.
Sé exigente y concreto: la nota global 7 es una buena llamada, 9-10 solo si es de manual. En las mejoras, cita el momento o la frase de la llamada y di qué habría sido mejor decir.
Escribe en español.`;

export class ClaudeConfigError extends Error {}

export async function analyzeCallWithClaude(input: {
  title: string;
  closerName: string | null;
  durationMin: number | null;
  transcript: string;
}): Promise<CallAnalysis> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ClaudeConfigError(
      "Falta la variable de entorno ANTHROPIC_API_KEY. Configúrala en .env.local y reinicia el servidor."
    );
  }
  const client = new Anthropic();

  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(CallAnalysisSchema) },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Llamada: ${input.title}
Closer: ${input.closerName ?? "desconocido"}
Duración: ${input.durationMin != null ? `${Math.round(input.durationMin)} min` : "desconocida"}

<transcripcion>
${input.transcript}
</transcripcion>`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Claude no ha podido analizar esta llamada (rechazo de seguridad).");
  }
  if (!response.parsed_output) {
    throw new Error(`Respuesta de Claude incompleta (stop_reason: ${response.stop_reason}).`);
  }
  return response.parsed_output;
}
