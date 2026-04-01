/**
 * Pothole Size Calculation with Error Propagation
 * Based on scale-from-reference methodology
 * 
 * Reference: Error propagation in pothole measurement using smartphone photos
 */

interface MeasurementInput {
  referenceRealLengthM: number; // L_ref (meters) - e.g., 0.20m for 20cm reference sticker
  referencePixels: number; // p_ref (pixels) - how many pixels the reference occupies
  referencePixelError: number; // δp_ref (pixels) - measurement error ±1-2 pixels
  potholePixels: number; // p_pothole (pixels) - width of pothole in pixels
  potholePixelError: number; // δp_pothole (pixels) - measurement error in pothole pixels
  refRealLengthError: number; // δL_ref (meters) - e.g., ±0.005m for reference sticker
}

interface SizeCalculationResult {
  potholeSizeCM: number; // Estimated pothole width in cm
  scaleFactor: number; // s = L_ref / p_ref (meters per pixel)
  relativeErrorScale: number; // δs/s ratio
  relativeErrorPothole: number; // δL_pothole / L_pothole ratio
  totalRelativeError: number; // Combined error percentage
  errorMarginCM: number; // ±error in cm
  minSizeCM: number; // Lower bound
  maxSizeCM: number; // Upper bound
  confidence: number; // 0-1, inverse of error
}

/**
 * Calculate pothole size using scale-from-reference with error propagation
 * Formula: L_pothole = (L_ref / p_ref) × p_pothole
 * 
 * Error propagation accounts for:
 * 1. Absolute uncertainty in real size of reference (δL_ref)
 * 2. Pixel measurement noise for reference (δp_ref)
 * 3. Pixel measurement noise for pothole (δp_pothole)
 */
export function calculatePotholeSize(input: MeasurementInput): SizeCalculationResult {
  // Step 1: Calculate scale factor
  // s = L_ref / p_ref (meters per pixel)
  const scaleFactor = input.referenceRealLengthM / input.referencePixels;

  // Step 2: Calculate relative error in scale factor
  // δs/s = sqrt((δL_ref/L_ref)² + (δp_ref/p_ref)²)
  const relativeErrorRef = input.refRealLengthError / input.referenceRealLengthM;
  const relativeErrorPixRef = input.referencePixelError / input.referencePixels;
  const relativeErrorScale = Math.sqrt(relativeErrorRef ** 2 + relativeErrorPixRef ** 2);

  // Step 3: Calculate relative error in pothole measurement
  // δp_pothole / p_pothole
  const relativeErrorPixPothole = input.potholePixelError / input.potholePixels;

  // Step 4: Calculate pothole size
  // L_pothole = s × p_pothole (in meters)
  const potholeSizeM = scaleFactor * input.potholePixels;
  const potholeSizeCM = potholeSizeM * 100; // Convert to cm

  // Step 5: Calculate total relative error (quadrature sum)
  // δL_pothole / L_pothole = sqrt((δs/s)² + (δp_pothole/p_pothole)²)
  const totalRelativeError = Math.sqrt(relativeErrorScale ** 2 + relativeErrorPixPothole ** 2);

  // Step 6: Calculate absolute error margin in cm
  const errorMarginCM = potholeSizeCM * totalRelativeError;

  // Step 7: Calculate confidence (inverse of error, 0-1)
  const confidence = Math.max(0, Math.min(1, 1 - totalRelativeError));

  return {
    potholeSizeCM: parseFloat(potholeSizeCM.toFixed(1)),
    scaleFactor: scaleFactor,
    relativeErrorScale: relativeErrorScale,
    relativeErrorPothole: relativeErrorPixPothole,
    totalRelativeError: totalRelativeError,
    errorMarginCM: parseFloat(errorMarginCM.toFixed(1)),
    minSizeCM: parseFloat((potholeSizeCM - errorMarginCM).toFixed(1)),
    maxSizeCM: parseFloat((potholeSizeCM + errorMarginCM).toFixed(1)),
    confidence: parseFloat((confidence * 100).toFixed(1))
  };
}

/**
 * Calculate bounty based on pothole size with error-weighted pricing
 * Higher accuracy (lower error) = higher bounty
 * Severity categories:
 * - LOW: < 20cm
 * - MEDIUM: 20-40cm
 * - HIGH: > 40cm
 */
export interface BountyConfig {
  baseCost: number; // Base repair cost in INR
  costPerCM: number; // Cost per cm of pothole width
  severityMultipliers: {
    LOW: number;
    MEDIUM: number;
    HIGH: number;
  };
  confidenceBonus: number; // Bonus multiplier for high-confidence measurements (0-0.2)
  maxBounty: number; // Cap on bounty
}

export function calculateBounty(
  result: SizeCalculationResult,
  config: BountyConfig
): { bounty: number; severity: 'LOW' | 'MEDIUM' | 'HIGH'; breakdown: string } {
  const size = result.potholeSizeCM;
  
  // Determine severity
  let severity: 'LOW' | 'MEDIUM' | 'HIGH';
  if (size < 20) severity = 'LOW';
  else if (size < 40) severity = 'MEDIUM';
  else severity = 'HIGH';

  // Base calculation
  const baseBounty = config.baseCost + size * config.costPerCM;
  const severityAdjusted = baseBounty * config.severityMultipliers[severity];

  // Confidence bonus (high confidence = more accurate measurement = higher bounty)
  const errorPercent = result.totalRelativeError * 100;
  let confidenceMultiplier = 1;
  if (errorPercent <= 3) {
    confidenceMultiplier = 1 + config.confidenceBonus; // Max bonus for <3% error
  } else if (errorPercent <= 10) {
    confidenceMultiplier = 1 + (config.confidenceBonus * (1 - (errorPercent - 3) / 7));
  }

  const finalBounty = Math.min(
    severityAdjusted * confidenceMultiplier,
    config.maxBounty
  );

  const breakdown = `Base: ₹${config.baseCost.toFixed(0)} + Size (${size.toFixed(1)}cm × ₹${config.costPerCM}/${config.costPerCM === 1 ? 'cm' : 'unit'}) + ${severity} severity (${(config.severityMultipliers[severity] * 100).toFixed(0)}%) + Accuracy bonus (${((confidenceMultiplier - 1) * 100).toFixed(1)}%)`;

  return {
    bounty: Math.round(finalBounty),
    severity,
    breakdown
  };
}

/**
 * Estimate error based on reference visibility in image
 * Returns suggested pixel measurement errors based on reference size
 */
export function estimatePixelErrors(
  referencePixelSize: number
): { refError: number; potholeError: number } {
  // Based on manual pixel counting typically ±1-2 pixels
  // Larger reference = more accurate measurement
  let refError = 2; // Default ±2 pixels
  let potholeError = 2;

  if (referencePixelSize > 150) {
    refError = 1; // ±1 pixel for large reference
    potholeError = 1;
  } else if (referencePixelSize > 100) {
    refError = 1.5;
    potholeError = 1.5;
  }

  return { refError, potholeError };
}
