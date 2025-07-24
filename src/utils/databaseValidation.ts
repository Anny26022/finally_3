/**
 * Database validation utilities for trade data
 * Helps identify and fix numeric overflow issues
 */

import { Trade } from '../types/trade'
import { v4 as uuidv4 } from 'uuid'

// Database field constraints based on Supabase schema
export const DB_CONSTRAINTS = {
  // Standard numeric fields with precision 12, scale 4 (max: 99999999.9999)
  STANDARD_NUMERIC: 99999999.9999,
  // Large amount fields with higher precision (max: 999999999.9999)
  LARGE_AMOUNT: 999999999.9999,
  // Percentage fields (max: 9999.9999) - increased for large percentage values
  PERCENTAGE: 9999.9999,
  // Integer fields
  INTEGER: 999999999
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  sanitizedTrade?: Trade
}

/**
 * Validate trade data against database constraints
 */
export function validateTradeForDatabase(trade: Trade): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Check for extremely large values that might cause overflow
  const numericChecks = [
    { field: 'entry', value: trade.entry, max: DB_CONSTRAINTS.STANDARD_NUMERIC, type: 'price' },
    { field: 'avgEntry', value: trade.avgEntry, max: DB_CONSTRAINTS.STANDARD_NUMERIC, type: 'price' },
    { field: 'sl', value: trade.sl, max: DB_CONSTRAINTS.STANDARD_NUMERIC, type: 'price' },
    { field: 'tsl', value: trade.tsl, max: DB_CONSTRAINTS.STANDARD_NUMERIC, type: 'price' },
    { field: 'cmp', value: trade.cmp, max: DB_CONSTRAINTS.STANDARD_NUMERIC, type: 'price' },
    { field: 'pyramid1Price', value: trade.pyramid1Price, max: DB_CONSTRAINTS.STANDARD_NUMERIC, type: 'price' },
    { field: 'pyramid2Price', value: trade.pyramid2Price, max: DB_CONSTRAINTS.STANDARD_NUMERIC, type: 'price' },
    { field: 'exit1Price', value: trade.exit1Price, max: DB_CONSTRAINTS.STANDARD_NUMERIC, type: 'price' },
    { field: 'exit2Price', value: trade.exit2Price, max: DB_CONSTRAINTS.STANDARD_NUMERIC, type: 'price' },
    { field: 'exit3Price', value: trade.exit3Price, max: DB_CONSTRAINTS.STANDARD_NUMERIC, type: 'price' },
    { field: 'avgExitPrice', value: trade.avgExitPrice, max: DB_CONSTRAINTS.STANDARD_NUMERIC, type: 'price' },
    { field: 'rewardRisk', value: trade.rewardRisk, max: DB_CONSTRAINTS.STANDARD_NUMERIC, type: 'ratio' },
    
    // Quantity fields
    { field: 'initialQty', value: trade.initialQty, max: DB_CONSTRAINTS.STANDARD_NUMERIC, type: 'quantity' },
    { field: 'pyramid1Qty', value: trade.pyramid1Qty, max: DB_CONSTRAINTS.STANDARD_NUMERIC, type: 'quantity' },
    { field: 'pyramid2Qty', value: trade.pyramid2Qty, max: DB_CONSTRAINTS.STANDARD_NUMERIC, type: 'quantity' },
    { field: 'exit1Qty', value: trade.exit1Qty, max: DB_CONSTRAINTS.STANDARD_NUMERIC, type: 'quantity' },
    { field: 'exit2Qty', value: trade.exit2Qty, max: DB_CONSTRAINTS.STANDARD_NUMERIC, type: 'quantity' },
    { field: 'exit3Qty', value: trade.exit3Qty, max: DB_CONSTRAINTS.STANDARD_NUMERIC, type: 'quantity' },
    { field: 'openQty', value: trade.openQty, max: DB_CONSTRAINTS.STANDARD_NUMERIC, type: 'quantity' },
    { field: 'exitedQty', value: trade.exitedQty, max: DB_CONSTRAINTS.STANDARD_NUMERIC, type: 'quantity' },
    
    // Large amount fields
    { field: 'positionSize', value: trade.positionSize, max: DB_CONSTRAINTS.LARGE_AMOUNT, type: 'amount' },
    { field: 'realisedAmount', value: trade.realisedAmount, max: DB_CONSTRAINTS.LARGE_AMOUNT, type: 'amount' },
    { field: 'plRs', value: trade.plRs, max: DB_CONSTRAINTS.LARGE_AMOUNT, type: 'amount' },
    
    // Percentage fields
    { field: 'allocation', value: trade.allocation, max: DB_CONSTRAINTS.PERCENTAGE, type: 'percentage' },
    { field: 'slPercent', value: trade.slPercent, max: DB_CONSTRAINTS.PERCENTAGE, type: 'percentage' },
    { field: 'pfImpact', value: trade.pfImpact, max: DB_CONSTRAINTS.PERCENTAGE, type: 'percentage' },
    { field: 'cummPf', value: trade.cummPf, max: DB_CONSTRAINTS.PERCENTAGE, type: 'percentage' },
    { field: 'stockMove', value: trade.stockMove, max: DB_CONSTRAINTS.PERCENTAGE, type: 'percentage' },
    { field: 'openHeat', value: trade.openHeat, max: DB_CONSTRAINTS.PERCENTAGE, type: 'percentage' },
    
    // Integer fields
    { field: 'holdingDays', value: trade.holdingDays, max: DB_CONSTRAINTS.INTEGER, type: 'integer' }
  ]

  numericChecks.forEach(check => {
    if (typeof check.value === 'number' && !isNaN(check.value)) {
      if (Math.abs(check.value) > check.max) {
        errors.push(`${check.field} value ${check.value} exceeds maximum allowed ${check.type} value of ${check.max}`)
      }
    }
  })

  // Check for required fields (name and tradeNo can be empty as users control them)
  const requiredFields = ['id', 'date']
  requiredFields.forEach(field => {
    if (!trade[field as keyof Trade]) {
      errors.push(`Required field '${field}' is missing or empty`)
    }
  })

  // Special handling for name field - allow empty but not undefined/null
  if (trade.name === undefined || trade.name === null) {
    errors.push(`Required field 'name' is missing`)
  }

  const isValid = errors.length === 0
  const sanitizedTrade = isValid ? trade : sanitizeTradeForDatabase(trade)

  return {
    isValid,
    errors,
    warnings,
    sanitizedTrade
  }
}

/**
 * Sanitize trade data to fit database constraints
 */
export function sanitizeTradeForDatabase(trade: Trade): Trade {
  const sanitized = { ...trade }

  // CRITICAL FIX: Ensure required fields have valid defaults
  // Name can be empty string (UI will show placeholder), but ensure it's not null/undefined
  if (sanitized.name === undefined || sanitized.name === null) {
    sanitized.name = '' // Empty string is fine - UI will show "Stock name" placeholder
  }
  if (!sanitized.id) {
    // Generate UUID for missing ID
    sanitized.id = uuidv4();
  }
  if (!sanitized.tradeNo) {
    sanitized.tradeNo = '' // No default trade number - user must assign manually
  }
  if (!sanitized.date) {
    sanitized.date = new Date().toISOString()
  }

  // Helper function to sanitize numeric values
  const sanitize = (value: number, max: number): number => {
    if (typeof value !== 'number' || isNaN(value)) return 0
    if (Math.abs(value) > max) return value > 0 ? max : -max
    return Math.round(value * 10000) / 10000 // Round to 4 decimal places
  }

  // Sanitize all numeric fields
  sanitized.entry = sanitize(trade.entry, DB_CONSTRAINTS.STANDARD_NUMERIC)
  sanitized.avgEntry = sanitize(trade.avgEntry, DB_CONSTRAINTS.STANDARD_NUMERIC)
  sanitized.sl = sanitize(trade.sl, DB_CONSTRAINTS.STANDARD_NUMERIC)
  sanitized.tsl = sanitize(trade.tsl, DB_CONSTRAINTS.STANDARD_NUMERIC)
  sanitized.cmp = sanitize(trade.cmp, DB_CONSTRAINTS.STANDARD_NUMERIC)
  sanitized.pyramid1Price = sanitize(trade.pyramid1Price, DB_CONSTRAINTS.STANDARD_NUMERIC)
  sanitized.pyramid2Price = sanitize(trade.pyramid2Price, DB_CONSTRAINTS.STANDARD_NUMERIC)
  sanitized.exit1Price = sanitize(trade.exit1Price, DB_CONSTRAINTS.STANDARD_NUMERIC)
  sanitized.exit2Price = sanitize(trade.exit2Price, DB_CONSTRAINTS.STANDARD_NUMERIC)
  sanitized.exit3Price = sanitize(trade.exit3Price, DB_CONSTRAINTS.STANDARD_NUMERIC)
  sanitized.avgExitPrice = sanitize(trade.avgExitPrice, DB_CONSTRAINTS.STANDARD_NUMERIC)
  sanitized.rewardRisk = sanitize(trade.rewardRisk, DB_CONSTRAINTS.STANDARD_NUMERIC)
  
  // Quantity fields
  sanitized.initialQty = sanitize(trade.initialQty, DB_CONSTRAINTS.STANDARD_NUMERIC)
  sanitized.pyramid1Qty = sanitize(trade.pyramid1Qty, DB_CONSTRAINTS.STANDARD_NUMERIC)
  sanitized.pyramid2Qty = sanitize(trade.pyramid2Qty, DB_CONSTRAINTS.STANDARD_NUMERIC)
  sanitized.exit1Qty = sanitize(trade.exit1Qty, DB_CONSTRAINTS.STANDARD_NUMERIC)
  sanitized.exit2Qty = sanitize(trade.exit2Qty, DB_CONSTRAINTS.STANDARD_NUMERIC)
  sanitized.exit3Qty = sanitize(trade.exit3Qty, DB_CONSTRAINTS.STANDARD_NUMERIC)
  sanitized.openQty = sanitize(trade.openQty, DB_CONSTRAINTS.STANDARD_NUMERIC)
  sanitized.exitedQty = sanitize(trade.exitedQty, DB_CONSTRAINTS.STANDARD_NUMERIC)
  
  // Large amount fields
  sanitized.positionSize = sanitize(trade.positionSize, DB_CONSTRAINTS.LARGE_AMOUNT)
  sanitized.realisedAmount = sanitize(trade.realisedAmount, DB_CONSTRAINTS.LARGE_AMOUNT)
  sanitized.plRs = sanitize(trade.plRs, DB_CONSTRAINTS.LARGE_AMOUNT)
  
  // Percentage fields
  sanitized.allocation = sanitize(trade.allocation, DB_CONSTRAINTS.PERCENTAGE)
  sanitized.slPercent = sanitize(trade.slPercent, DB_CONSTRAINTS.PERCENTAGE)
  sanitized.pfImpact = sanitize(trade.pfImpact, DB_CONSTRAINTS.PERCENTAGE)
  sanitized.cummPf = sanitize(trade.cummPf, DB_CONSTRAINTS.PERCENTAGE)
  sanitized.stockMove = sanitize(trade.stockMove, DB_CONSTRAINTS.PERCENTAGE)
  sanitized.openHeat = sanitize(trade.openHeat, DB_CONSTRAINTS.PERCENTAGE)
  
  // Integer fields
  sanitized.holdingDays = Math.max(0, Math.floor(trade.holdingDays || 0))

  return sanitized
}

/**
 * Validate batch of trades
 */
export function validateTradesBatch(trades: Trade[]): {
  validTrades: Trade[]
  invalidTrades: { trade: Trade; errors: string[] }[]
  totalErrors: number
} {
  const validTrades: Trade[] = []
  const invalidTrades: { trade: Trade; errors: string[] }[] = []
  let totalErrors = 0

  trades.forEach(trade => {
    const validation = validateTradeForDatabase(trade)
    if (validation.isValid) {
      validTrades.push(trade)
    } else {
      invalidTrades.push({ trade, errors: validation.errors })
      totalErrors += validation.errors.length
    }
  })

  return { validTrades, invalidTrades, totalErrors }
}
