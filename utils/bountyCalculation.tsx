/**
 * Bounty Calculation System
 * Calculates rewards based on:
 * 1. Average pothole size (in cm)
 * 2. Number of potholes detected
 * 3. Severity level
 */

export interface BountyCalculationInput {
  averageSizeCm: number
  potholeCount: number
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
  baseCost?: number
  sizeMultiplier?: number
}

export interface BountyResult {
  baseBounty: number
  sizeBonus: number
  countBonus: number
  severityMultiplier: number
  totalBounty: number
  breakdown: string
}

const DEFAULT_BASE_COST = 500 // Base bounty in rupees
const DEFAULT_SIZE_MULTIPLIER = 50 // Per cm bonus

/**
 * Calculates severity based on average size
 */
export function calculateSeverity(
  averageSizeCm: number
): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (averageSizeCm < 20) return 'LOW'
  if (averageSizeCm < 40) return 'MEDIUM'
  return 'HIGH'
}

/**
 * Calculates severity multiplier
 */
function getSeverityMultiplier(severity: 'LOW' | 'MEDIUM' | 'HIGH'): number {
  const multipliers = {
    LOW: 1.0,
    MEDIUM: 1.5,
    HIGH: 2.0
  }
  return multipliers[severity]
}

/**
 * Calculates count bonus (more potholes = more bonus)
 * Formula: base * (1 + count * 0.15)
 * 1 pothole: +0%, 2 potholes: +15%, 3 potholes: +30%, etc.
 */
function getCountBonus(baseBounty: number, potholeCount: number): number {
  const countMultiplier = Math.min(1 + potholeCount * 0.15, 2.0) // Cap at 200% bonus
  return baseBounty * (countMultiplier - 1)
}

/**
 * Main bounty calculation function
 */
export function calculateBounty(input: BountyCalculationInput): BountyResult {
  const {
    averageSizeCm,
    potholeCount,
    severity,
    baseCost = DEFAULT_BASE_COST,
    sizeMultiplier = DEFAULT_SIZE_MULTIPLIER
  } = input

  // Base bounty (fixed amount)
  const baseBounty = baseCost

  // Size bonus: Rs 50 per cm of average width
  const sizeBonus = averageSizeCm * sizeMultiplier

  // Count bonus: increases with number of potholes
  const countBonus = getCountBonus(baseBounty + sizeBonus, potholeCount)

  // Severity multiplier
  const severityMultiplier = getSeverityMultiplier(severity)

  // Total bounty
  const totalBounty = Math.round(
    (baseBounty + sizeBonus + countBonus) * severityMultiplier
  )

  const breakdown = `
Base: ₹${baseBounty} +
Size (${averageSizeCm.toFixed(1)}cm × ₹${sizeMultiplier}): ₹${sizeBonus.toFixed(0)} +
Count (${potholeCount}× bonus): ₹${countBonus.toFixed(0)} ×
${severity} (${severityMultiplier}x) = ₹${totalBounty}
  `.trim()

  return {
    baseBounty,
    sizeBonus: Math.round(sizeBonus),
    countBonus: Math.round(countBonus),
    severityMultiplier,
    totalBounty,
    breakdown
  }
}

/**
 * Validates bounty calculation
 */
export function validateBounty(bounty: number): boolean {
  return bounty > 0 && bounty < 100000 // Min ₹1, Max ₹100k
}
