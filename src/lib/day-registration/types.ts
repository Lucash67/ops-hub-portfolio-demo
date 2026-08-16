import { z } from "zod";

export const draftSaleSchema = z.object({
  time: z.string().regex(/^\d{2}:\d{2}$/),
  clientName: z.string().min(1),
  productName: z.string().min(1),
  quantity: z.number().int().min(1).default(1),
  paymentMethod: z.enum(["pix", "card", "cash"]),
  paymentStatus: z.enum(["paid", "pending", "partial"]).default("paid"),
  department: z.string().min(1),
  notes: z.string().optional(),
});

export const draftClientSchema = z.object({
  name: z.string().min(1),
  sector: z.string().optional(),
  notes: z.string().optional(),
});

export const draftPurchaseSchema = z.object({
  totalUnits: z.number().int().min(0),
  investment: z.number().min(0),
  ownInvestment: z.number().min(0).optional(),
  thirdParty: z
    .object({
      name: z.string(),
      amount: z.number().min(0),
    })
    .optional(),
  products: z.array(
    z.object({
      name: z.string(),
      quantity: z.number().int().min(1),
    }),
  ),
  acalAllocation: z
    .array(z.object({ name: z.string(), quantity: z.number().int().min(1) }))
    .optional(),
  fatherAllocation: z
    .array(z.object({ name: z.string(), quantity: z.number().int().min(1) }))
    .optional(),
});

export const dayRegistrationPlanSchema = z.object({
  businessId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dailyGoalUnits: z.number().int().min(0).optional(),
  purchase: draftPurchaseSchema.optional(),
  summary: z.object({
    revenue: z.number().min(0),
    profit: z.number(),
    quantitySold: z.number().int().min(0),
    quantityLost: z.number().int().min(0).default(0),
    lossReason: z.string().optional(),
    forecastProfit: z.number().optional(),
  }),
  sales: z.array(draftSaleSchema),
  newClients: z.array(draftClientSchema).default([]),
  suggestedActions: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        description: z.string(),
        status: z.enum(["planned", "in_progress", "done"]).default("planned"),
      }),
    )
    .optional(),
  observations: z.string().optional(),
  manualInsights: z.string().optional(),
  lessonsLearned: z.string().optional(),
});

export type DraftSale = z.infer<typeof draftSaleSchema>;
export type DraftClient = z.infer<typeof draftClientSchema>;
export type DraftPurchase = z.infer<typeof draftPurchaseSchema>;
export type DayRegistrationPlan = z.infer<typeof dayRegistrationPlanSchema>;

export interface ProductMatchPreview {
  context: string;
  productName: string;
  matchedProductId?: string;
  matchedProductName?: string;
  willCreate: boolean;
}

export interface ClientMatchPreview {
  clientName: string;
  existingClientId?: string;
  existingClientName?: string;
  willCreate: boolean;
}

export interface DayRegistrationPreview extends DayRegistrationPlan {
  warnings: string[];
  errors: string[];
  productMatches: ProductMatchPreview[];
  clientMatches: ClientMatchPreview[];
  dayAlreadyRegistered: boolean;
  existingSalesCount: number;
}

/** Modelo no padrão Lucas — copie, preencha e cole no Registro do Dia. */
export const DRAFT_TEMPLATE = `DD/MM

Encomendados hoje:

- 0 Croissant
- 0 Pastel
- 0 Mistao

Custo total dos salgados: R$0,00
Minha parte investida: R$0,00
Parte restante do meu pai (não sai nada de mim) R$0,00

Separados para o trabalho do meu pai:

- 0 Croissant
- 0 Mistao
- 0 Pastel

Obs: Importante ressaltar que esses vendidos no trabalho do meu pai eu ainda não possuo dados mais completos (turno, nome, forma de pagamento e sabor pego). Eu apenas dou pro meu pai levar e vender e depois me passar o valor do faturamento

Separados para acal:

- 0 Croissant
- 0 Pastel
- 0 Mistao

Histórico de vendas:

1 - Nome Completo da Cliente: 1 Croissant | Manhã ✅Pix
2 - Nome Completo do Cliente: 1 Mistao | Manhã ✅Pix
3 - Nome: 1 Croissant | Manhã ✅Pix
4 - Cliente não identificado que deu em moeda: 1 Mistao | Manhã ✅Moeda (Já foi revertido em pix)
5 - Cliente não identificado que deu em espécie: 1 Croissant | Manhã ✅Espécie
6 - Mikely: 1 Mistao | Manhã (devendo) ⚠️
7 - Nome: 1 croisant e 1 mistao | Manhã ✅Pix
8 - Leonardo de Souza Sena: 1 | Tarde ✅Pix
9 - Não pagou (Pegou quando eu não estava)
10 - Não pagou (Pegou quando eu não estava)

Devendo ainda de ontem: Nome (R$5) | Pagou dia DD/MM - Manhã ✅Pix

Observações do dia:

- Escreva aqui o que o sistema não consegue deduzir sozinho
- Novos clientes, oportunidades, pendências, contexto do dia

Previsões de Lucro
- Lucro previsto do dia se meu pai vender os que ele levou: R$0

Faturamento e Lucro
- Faturamento do dia: R$0
- Lucro do dia: R$0
`;
