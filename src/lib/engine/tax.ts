// 2026 Federal Tax Brackets (estimated, based on inflation adjustments)
const FEDERAL_BRACKETS = {
  single: [
    { min: 0, max: 11925, rate: 0.10 },
    { min: 11925, max: 48475, rate: 0.12 },
    { min: 48475, max: 103350, rate: 0.22 },
    { min: 103350, max: 197300, rate: 0.24 },
    { min: 197300, max: 250525, rate: 0.32 },
    { min: 250525, max: 626350, rate: 0.35 },
    { min: 626350, max: Infinity, rate: 0.37 },
  ],
  married: [
    { min: 0, max: 23850, rate: 0.10 },
    { min: 23850, max: 96950, rate: 0.12 },
    { min: 96950, max: 206700, rate: 0.22 },
    { min: 206700, max: 394600, rate: 0.24 },
    { min: 394600, max: 501050, rate: 0.32 },
    { min: 501050, max: 751600, rate: 0.35 },
    { min: 751600, max: Infinity, rate: 0.37 },
  ],
  head_of_household: [
    { min: 0, max: 17000, rate: 0.10 },
    { min: 17000, max: 64850, rate: 0.12 },
    { min: 64850, max: 103350, rate: 0.22 },
    { min: 103350, max: 197300, rate: 0.24 },
    { min: 197300, max: 250500, rate: 0.32 },
    { min: 250500, max: 626350, rate: 0.35 },
    { min: 626350, max: Infinity, rate: 0.37 },
  ],
};

const STANDARD_DEDUCTION = {
  single: 15700,
  married: 31400,
  head_of_household: 23500,
};

// State income tax rates (simplified — top marginal or flat rate)
const STATE_TAX_RATES: Record<string, { rate: number; name: string }> = {
  AL: { rate: 5.0, name: "Alabama" }, AK: { rate: 0, name: "Alaska" },
  AZ: { rate: 2.5, name: "Arizona" }, AR: { rate: 4.4, name: "Arkansas" },
  CA: { rate: 13.3, name: "California" }, CO: { rate: 4.4, name: "Colorado" },
  CT: { rate: 6.99, name: "Connecticut" }, DE: { rate: 6.6, name: "Delaware" },
  FL: { rate: 0, name: "Florida" }, GA: { rate: 5.49, name: "Georgia" },
  HI: { rate: 11.0, name: "Hawaii" }, ID: { rate: 5.8, name: "Idaho" },
  IL: { rate: 4.95, name: "Illinois" }, IN: { rate: 3.05, name: "Indiana" },
  IA: { rate: 5.7, name: "Iowa" }, KS: { rate: 5.7, name: "Kansas" },
  KY: { rate: 4.0, name: "Kentucky" }, LA: { rate: 4.25, name: "Louisiana" },
  ME: { rate: 7.15, name: "Maine" }, MD: { rate: 5.75, name: "Maryland" },
  MA: { rate: 5.0, name: "Massachusetts" }, MI: { rate: 4.25, name: "Michigan" },
  MN: { rate: 9.85, name: "Minnesota" }, MS: { rate: 5.0, name: "Mississippi" },
  MO: { rate: 4.8, name: "Missouri" }, MT: { rate: 5.9, name: "Montana" },
  NE: { rate: 5.84, name: "Nebraska" }, NV: { rate: 0, name: "Nevada" },
  NH: { rate: 0, name: "New Hampshire" }, NJ: { rate: 10.75, name: "New Jersey" },
  NM: { rate: 5.9, name: "New Mexico" }, NY: { rate: 10.9, name: "New York" },
  NC: { rate: 4.5, name: "North Carolina" }, ND: { rate: 2.5, name: "North Dakota" },
  OH: { rate: 3.5, name: "Ohio" }, OK: { rate: 4.75, name: "Oklahoma" },
  OR: { rate: 9.9, name: "Oregon" }, PA: { rate: 3.07, name: "Pennsylvania" },
  RI: { rate: 5.99, name: "Rhode Island" }, SC: { rate: 6.4, name: "South Carolina" },
  SD: { rate: 0, name: "South Dakota" }, TN: { rate: 0, name: "Tennessee" },
  TX: { rate: 0, name: "Texas" }, UT: { rate: 4.65, name: "Utah" },
  VT: { rate: 8.75, name: "Vermont" }, VA: { rate: 5.75, name: "Virginia" },
  WA: { rate: 0, name: "Washington" }, WV: { rate: 5.12, name: "West Virginia" },
  WI: { rate: 7.65, name: "Wisconsin" }, WY: { rate: 0, name: "Wyoming" },
  DC: { rate: 10.75, name: "District of Columbia" },
};

export type FilingStatus = "single" | "married" | "head_of_household";

export function calculateFederalTax(
  grossAnnualIncome: number,
  filingStatus: FilingStatus = "single"
): { tax: number; effectiveRate: number; marginalRate: number } {
  const deduction = STANDARD_DEDUCTION[filingStatus] || STANDARD_DEDUCTION.single;
  const taxableIncome = Math.max(0, grossAnnualIncome - deduction);
  const brackets = FEDERAL_BRACKETS[filingStatus] || FEDERAL_BRACKETS.single;

  let tax = 0;
  let marginalRate = 0;
  for (const bracket of brackets) {
    if (taxableIncome > bracket.min) {
      const taxableInBracket = Math.min(taxableIncome, bracket.max) - bracket.min;
      tax += taxableInBracket * bracket.rate;
      marginalRate = bracket.rate;
    }
  }

  return {
    tax: Math.round(tax),
    effectiveRate: grossAnnualIncome > 0 ? Math.round((tax / grossAnnualIncome) * 1000) / 10 : 0,
    marginalRate: Math.round(marginalRate * 100),
  };
}

export function calculateStateTax(
  grossAnnualIncome: number,
  stateCode: string
): { tax: number; rate: number; stateName: string } {
  const stateInfo = STATE_TAX_RATES[stateCode.toUpperCase()];
  if (!stateInfo) return { tax: 0, rate: 0, stateName: "Unknown" };

  const tax = Math.round(grossAnnualIncome * (stateInfo.rate / 100));
  return { tax, rate: stateInfo.rate, stateName: stateInfo.name };
}

export function calculateTotalTax(
  grossAnnualIncome: number,
  filingStatus: FilingStatus = "single",
  stateCode: string | null = null
): {
  federal: { tax: number; effectiveRate: number; marginalRate: number };
  state: { tax: number; rate: number; stateName: string };
  fica: number;
  totalTax: number;
  totalEffectiveRate: number;
  takeHome: number;
} {
  const federal = calculateFederalTax(grossAnnualIncome, filingStatus);
  const state = stateCode ? calculateStateTax(grossAnnualIncome, stateCode) : { tax: 0, rate: 0, stateName: "None" };

  // FICA: Social Security (6.2% up to $176,100) + Medicare (1.45% + 0.9% over $200K)
  const ssMax = 176100;
  const ssTax = Math.min(grossAnnualIncome, ssMax) * 0.062;
  const medicareTax = grossAnnualIncome * 0.0145 + Math.max(0, grossAnnualIncome - 200000) * 0.009;
  const fica = Math.round(ssTax + medicareTax);

  const totalTax = federal.tax + state.tax + fica;

  return {
    federal,
    state,
    fica,
    totalTax,
    totalEffectiveRate: grossAnnualIncome > 0 ? Math.round((totalTax / grossAnnualIncome) * 1000) / 10 : 0,
    takeHome: grossAnnualIncome - totalTax,
  };
}

export function getStateList(): { code: string; name: string; rate: number }[] {
  return Object.entries(STATE_TAX_RATES)
    .map(([code, info]) => ({ code, name: info.name, rate: info.rate }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
