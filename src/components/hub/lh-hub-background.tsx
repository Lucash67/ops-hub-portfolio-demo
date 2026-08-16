import { LhMonogramOutline } from "@/components/hub/lh-monogram";

/**
 * Camada visual de fundo do LH Hub.
 * Absolute / pointer-events: none — não altera auth, layout nem formulário.
 */
export function LhHubBackground() {
  return (
    <div className="lh-hub-background" aria-hidden>
      <div className="lh-hub-background__base" />
      <div className="lh-hub-background__glow lh-hub-background__glow--tl" />
      <div className="lh-hub-background__glow lh-hub-background__glow--form" />
      <div className="lh-hub-background__glow lh-hub-background__glow--field" />

      {/* Monograma outline — assinatura atrás do conteúdo, centro → direita */}
      <div className="lh-hub-background__monogram">
        <LhMonogramOutline className="lh-hub-background__monogram-svg" />
      </div>

      {/* Wireframe geométrico discreto (não atravessa o formulário em z) */}
      <svg
        className="lh-hub-background__lines"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g stroke="#00D4A8" fill="none" strokeLinecap="square">
          <path d="M0 640 H1440" strokeWidth="1" opacity="0.09" />
          <path d="M0 760 H1440" strokeWidth="1" opacity="0.06" />
          <path d="M720 80 V820" strokeWidth="1" opacity="0.07" />
          <path d="M160 480 H380 V700" strokeWidth="1" opacity="0.11" />
          <path d="M380 560 H520" strokeWidth="1" opacity="0.08" />
          <path d="M1040 160 H1300 V300 H1180" strokeWidth="1" opacity="0.1" />
          <path d="M240 200 L340 300" strokeWidth="1" opacity="0.08" />
          <path d="M1120 620 L1280 780" strokeWidth="1" opacity="0.07" />
          <path d="M600 720 L720 620 L840 720" strokeWidth="1" opacity="0.09" />
        </g>
      </svg>

      {/* Campo de partículas — ondas / topografia dourada no terço inferior */}
      <div className="lh-hub-background__particles">
        <svg
          className="lh-hub-background__particles-svg"
          viewBox="0 0 160 100"
          preserveAspectRatio="xMidYMax slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g className="lh-hub-background__wave-guide" stroke="#00D4A8" fill="none">
            {WAVE_GUIDES.map((d, i) => (
              <path key={i} d={d} strokeWidth="0.12" opacity={0.06 + (i % 3) * 0.02} />
            ))}
          </g>
          {PARTICLES.map((p) => (
            <circle
              key={p.id}
              className={`lh-hub-background__dot lh-hub-background__dot--${p.tier}`}
              cx={p.x}
              cy={p.y}
              r={p.r}
              style={{ animationDelay: `${p.delay}s` }}
            />
          ))}
        </svg>
      </div>

      <div className="lh-hub-background__vignette" />
    </div>
  );
}

type Particle = {
  id: number;
  x: number;
  y: number;
  r: number;
  tier: "dim" | "mid" | "bright";
  delay: number;
};

/** Guias de onda (perspectiva) — só estrutura visual, bem discretas. */
const WAVE_GUIDES = [
  "M8 72 Q40 64 80 70 T152 66",
  "M4 78 Q44 70 80 78 T156 74",
  "M2 84 Q48 76 80 86 T158 82",
  "M0 90 Q50 82 80 92 T160 88",
  "M0 96 Q52 90 80 97 T160 94",
];

/**
 * Partículas determinísticas em faixas onduladas (centro-inferior),
 * inspiradas no campo da referência — sem canvas.
 */
const PARTICLES: Particle[] = (() => {
  const out: Particle[] = [];
  let id = 0;

  const waveY = (x: number, band: number) => {
    const base = 68 + band * 5.2;
    const amp = 2.2 + band * 0.35;
    return base + Math.sin(x * 0.11 + band * 0.9) * amp + Math.sin(x * 0.05 + band) * 1.1;
  };

  for (let band = 0; band < 6; band++) {
    const count = 22 + band * 6;
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      // densifica no centro (sob a divisão / atrás do card)
      const bias = Math.pow(Math.sin(t * Math.PI), 0.65);
      const x = 8 + t * 144 + Math.sin(i * 1.7 + band) * (1.2 + band * 0.15);
      const y = waveY(x, band) + (1 - bias) * 1.8;
      const edgeFade = bias;
      if (edgeFade < 0.12 && band < 2) continue;

      let tier: Particle["tier"] = "dim";
      if (edgeFade > 0.55 && (i + band) % 5 === 0) tier = "bright";
      else if (edgeFade > 0.3 && (i + band) % 2 === 0) tier = "mid";

      const r =
        tier === "bright" ? 0.38 + band * 0.02 : tier === "mid" ? 0.26 : 0.16 + (i % 3) * 0.02;

      out.push({
        id: id++,
        x,
        y,
        r,
        tier,
        delay: -((i * 0.37 + band * 1.1) % 12),
      });
    }
  }

  // Rastro vertical suave na divisão dos painéis
  for (let i = 0; i < 18; i++) {
    out.push({
      id: id++,
      x: 78 + Math.sin(i * 0.8) * 2.2,
      y: 18 + i * 2.6,
      r: i % 4 === 0 ? 0.32 : 0.18,
      tier: i % 3 === 0 ? "bright" : "mid",
      delay: -(i * 0.5),
    });
  }

  // Brilhos esparsos (atmosfera)
  const sparks: Array<[number, number, Particle["tier"]]> = [
    [22, 24, "dim"],
    [36, 16, "mid"],
    [50, 28, "dim"],
    [110, 20, "mid"],
    [128, 34, "dim"],
    [140, 48, "mid"],
    [18, 52, "dim"],
    [96, 40, "bright"],
  ];
  for (const [x, y, tier] of sparks) {
    out.push({
      id: id++,
      x,
      y,
      r: tier === "bright" ? 0.34 : 0.2,
      tier,
      delay: -(x % 9),
    });
  }

  return out;
})();
