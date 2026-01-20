// Configuración y utilidades para comisiones de pasarela (Mercado Pago)
// Fuente: Buenas prácticas Mercado Pago 2025 y experiencias comunes de e-commerce

function parsePercent(val, def = 0) {
  if (val === undefined || val === null || val === '') return def;
  const num = Number(val);
  if (Number.isNaN(num)) return def;
  return num;
}

export function getPaymentFeeConfig() {
  const mode = (process.env.PAYMENT_FEE_MODE || 'absorb').toLowerCase(); // 'absorb' | 'pass_through'
  const percent = parsePercent(process.env.MP_FEE_PERCENT, 0); // ej: 0.0761
  const fixed = parsePercent(process.env.MP_FEE_FIXED, 0); // en ARS
  const label = process.env.MP_FEE_LABEL || 'Recargo Mercado Pago';

  // Validaciones mínimas
  const safePercent = percent < 0 ? 0 : percent > 0.25 ? 0.25 : percent; // Limitar al 25% por seguridad
  const safeFixed = fixed < 0 ? 0 : fixed;

  return {
    mode: mode === 'pass_through' ? 'pass_through' : 'absorb',
    percent: safePercent,
    fixed: safeFixed,
    label
  };
}

// Fórmula: Para netear X tras comisión r y fijo f, se cobra C donde
// C = (X + f) / (1 - r). El recargo = C - X
export function computeSurchargeForNetTarget(netTarget, percent, fixed = 0) {
  const r = Number(percent) || 0;
  const f = Number(fixed) || 0;
  if (r <= 0 && f <= 0) return 0;
  const charge = (netTarget + f) / (1 - r);
  const surcharge = charge - netTarget;
  // Redondeo a pesos (0 decimales) para evitar rechazo por centavos
  return Math.round(surcharge);
}

export default {
  getPaymentFeeConfig,
  computeSurchargeForNetTarget
};
