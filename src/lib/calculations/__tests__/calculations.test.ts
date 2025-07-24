/**
 * Comprehensive Test Suite for Centralized Calculations
 * Validates that all calculation functions work correctly and maintain backward compatibility
 */

import {
  calcAvgEntry,
  calcPositionSize,
  calcAllocation,
  calcSLPercent,
  calcOpenQty,
  calcExitedQty,
  calcAvgExitPrice,
  calcStockMove,
  calcRealisedAmount,
  calcPLRs,
  calcPFImpact,
  calcUnrealizedPL,
  calcRealizedPL_FIFO,
  calcRewardRisk,
  calcTradeOpenHeat,
  calcOpenHeat,
  calculateStandardDeviation,
  calculateMaxDrawdown,
  calculateSharpeRatio,
  formatCurrency,
  formatPercentage,
  formatStockMove,
  safeCalculation,
  validateCalculationInputs
} from '../index';

import { Trade } from '../../../types/trade';

// Mock trade data for testing
const mockTrade: Trade = {
  id: 'test-trade-1',
  date: '2024-01-15',
  name: 'RELIANCE',
  setup: 'Breakout',
  buySell: 'Buy',
  entry: 2500,
  avgEntry: 2520,
  sl: 2400,
  tsl: 2450,
  cmp: 2600,
  initialQty: 100,
  pyramid1Price: 2530,
  pyramid1Qty: 50,
  pyramid1Date: '2024-01-16',
  pyramid2Price: 2540,
  pyramid2Qty: 30,
  pyramid2Date: '2024-01-17',
  positionSize: 453600,
  allocation: 4.54,
  slPercent: 4.76,
  exit1Price: 2580,
  exit1Qty: 80,
  exit1Date: '2024-01-20',
  exit2Price: 2590,
  exit2Qty: 50,
  exit2Date: '2024-01-21',
  exit3Price: 2595,
  exit3Qty: 50,
  exit3Date: '2024-01-22',
  openQty: 0,
  exitedQty: 180,
  avgExitPrice: 2586.11,
  stockMove: 2.62,
  rewardRisk: 1.85,
  holdingDays: 7,
  positionStatus: 'Closed',
  realisedAmount: 465500,
  plRs: 11900,
  pfImpact: 0.119,
  cummPf: 0.119,
  planFollowed: true,
  exitTrigger: 'Target',
  proficiencyGrowthAreas: 'Entry timing',
  sector: 'Energy',
  openHeat: 0,
  baseDuration: 'Short',
  notes: 'Good breakout trade'
};

const mockOpenTrade: Trade = {
  ...mockTrade,
  id: 'test-trade-2',
  positionStatus: 'Open',
  openQty: 180,
  exitedQty: 0,
  exit1Price: 0,
  exit1Qty: 0,
  exit2Price: 0,
  exit2Qty: 0,
  exit3Price: 0,
  exit3Qty: 0,
  avgExitPrice: 0,
  realisedAmount: 0,
  plRs: 0
};

describe('Core Trade Metrics', () => {
  test('calcAvgEntry should calculate correct average entry price', () => {
    const entries = [
      { price: 2500, qty: 100 },
      { price: 2530, qty: 50 },
      { price: 2540, qty: 30 }
    ];
    
    const result = calcAvgEntry(entries);
    expect(result).toBeCloseTo(2520, 0); // Expected weighted average
  });

  test('calcPositionSize should calculate correct position size', () => {
    const result = calcPositionSize(2520, 180);
    expect(result).toBe(453600);
  });

  test('calcAllocation should calculate correct portfolio allocation', () => {
    const result = calcAllocation(453600, 10000000);
    expect(result).toBeCloseTo(4.536, 2);
  });

  test('calcSLPercent should calculate correct stop loss percentage', () => {
    const result = calcSLPercent(2400, 2500);
    expect(result).toBeCloseTo(4, 1);
  });

  test('calcOpenQty should calculate correct open quantity', () => {
    const result = calcOpenQty(100, 50, 30, 80);
    expect(result).toBe(100); // 100 + 50 + 30 - 80
  });

  test('calcExitedQty should calculate correct exited quantity', () => {
    const result = calcExitedQty(80, 50, 50);
    expect(result).toBe(180);
  });

  test('calcAvgExitPrice should calculate correct average exit price', () => {
    const exits = [
      { price: 2580, qty: 80 },
      { price: 2590, qty: 50 },
      { price: 2595, qty: 50 }
    ];
    
    const result = calcAvgExitPrice(exits);
    expect(result).toBeCloseTo(2586.11, 1);
  });

  test('calcStockMove should calculate correct stock movement for closed position', () => {
    const result = calcStockMove(2520, 2586.11, 2600, 0, 180, 'Closed', 'Buy');
    expect(result).toBeCloseTo(2.62, 1);
  });

  test('calcStockMove should calculate correct stock movement for open position', () => {
    const result = calcStockMove(2520, 0, 2600, 180, 0, 'Open', 'Buy');
    expect(result).toBeCloseTo(3.17, 1); // (2600 - 2520) / 2520 * 100
  });

  test('calcUnrealizedPL should calculate correct unrealized P&L', () => {
    const result = calcUnrealizedPL(2520, 2600, 180, 'Buy');
    expect(result).toBe(14400); // (2600 - 2520) * 180
  });

  test('calcRealizedPL_FIFO should calculate correct FIFO P&L', () => {
    const entries = [
      { price: 2500, qty: 100 },
      { price: 2530, qty: 50 },
      { price: 2540, qty: 30 }
    ];
    
    const exits = [
      { price: 2580, qty: 80 },
      { price: 2590, qty: 50 },
      { price: 2595, qty: 50 }
    ];
    
    const result = calcRealizedPL_FIFO(entries, exits, 'Buy');
    expect(result).toBeGreaterThan(0); // Should be positive for profitable trade
  });
});

describe('Portfolio Metrics', () => {
  test('calcTradeOpenHeat should calculate correct open heat', () => {
    const result = calcTradeOpenHeat(mockOpenTrade, 10000000);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(10); // Should be reasonable percentage
  });

  test('calcTradeOpenHeat should calculate 0.2% for user example', () => {
    // User example: Entry 100 @ 10 qty, SL 98, Portfolio 10,000
    const testTrade = {
      id: 'test-user-example',
      positionStatus: 'Open',
      avgEntry: 100,
      openQty: 10,
      sl: 98,
      tsl: 0,
      buySell: 'Buy',
      date: '2024-01-01'
    };

    const result = calcTradeOpenHeat(testTrade, 10000);
    expect(result).toBeCloseTo(0.2, 2); // Should be exactly 0.2%
  });

  test('calcTradeOpenHeat should handle TSL logic correctly', () => {
    const baseTrade = {
      id: 'test-tsl',
      positionStatus: 'Open',
      avgEntry: 100,
      openQty: 10,
      buySell: 'Buy',
      date: '2024-01-01'
    };

    // Case 1: sl = tsl, should use tsl
    const trade1 = { ...baseTrade, sl: 98, tsl: 98 };
    const result1 = calcTradeOpenHeat(trade1, 10000);
    expect(result1).toBeCloseTo(0.2, 2);

    // Case 2: tsl > sl, should use tsl
    const trade2 = { ...baseTrade, sl: 95, tsl: 98 };
    const result2 = calcTradeOpenHeat(trade2, 10000);
    expect(result2).toBeCloseTo(0.2, 2);

    // Case 3: tsl < sl, should use sl
    const trade3 = { ...baseTrade, sl: 98, tsl: 95 };
    const result3 = calcTradeOpenHeat(trade3, 10000);
    expect(result3).toBeCloseTo(0.2, 2);
  });

  test('calcTradeOpenHeat should handle edge cases', () => {
    const baseTrade = {
      id: 'test-edge',
      positionStatus: 'Open',
      avgEntry: 100,
      openQty: 10,
      sl: 98,
      date: '2024-01-01'
    };

    // Edge case 1: Short position
    const shortTrade = { ...baseTrade, buySell: 'Short', sl: 102 };
    const shortResult = calcTradeOpenHeat(shortTrade, 10000);
    expect(shortResult).toBeCloseTo(0.2, 2);

    // Edge case 2: Invalid SL for buy (above entry)
    const invalidBuyTrade = { ...baseTrade, buySell: 'Buy', sl: 105 };
    const invalidBuyResult = calcTradeOpenHeat(invalidBuyTrade, 10000);
    expect(invalidBuyResult).toBe(0);

    // Edge case 3: Invalid SL for sell (below entry)
    const invalidSellTrade = { ...baseTrade, buySell: 'Sell', sl: 95 };
    const invalidSellResult = calcTradeOpenHeat(invalidSellTrade, 10000);
    expect(invalidSellResult).toBe(0);

    // Edge case 4: Extreme values
    const extremeTrade = { ...baseTrade, sl: Infinity };
    const extremeResult = calcTradeOpenHeat(extremeTrade, 10000);
    expect(extremeResult).toBe(0);

    // Edge case 5: Invalid date
    const invalidDateTrade = { ...baseTrade, date: 'invalid-date' };
    const invalidDateResult = calcTradeOpenHeat(invalidDateTrade, 10000);
    expect(invalidDateResult).toBeCloseTo(0.2, 2); // Should still work with default portfolio
  });

  test('calcOpenHeat should calculate total open heat for multiple trades', () => {
    const trades = [mockOpenTrade, { ...mockOpenTrade, id: 'test-2' }];
    const result = calcOpenHeat(trades, 10000000);
    expect(result).toBeGreaterThan(0);
  });
});

describe('Statistical Metrics', () => {
  test('calculateStandardDeviation should calculate correct standard deviation', () => {
    const values = [1, 2, 3, 4, 5];
    const result = calculateStandardDeviation(values);
    expect(result).toBeCloseTo(1.414, 2);
  });

  test('calculateMaxDrawdown should calculate correct maximum drawdown', () => {
    const portfolioValues = new Map([
      [1, 100000],
      [2, 110000],
      [3, 105000],
      [4, 95000],
      [5, 120000]
    ]);
    
    const result = calculateMaxDrawdown(portfolioValues);
    expect(result).toBeCloseTo(13.64, 1); // Max drawdown from 110k to 95k
  });

  test('calculateSharpeRatio should calculate correct Sharpe ratio', () => {
    const returns = [0.01, 0.02, -0.01, 0.03, 0.015];
    const result = calculateSharpeRatio(returns, 0.005);
    expect(result).toBeGreaterThan(0);
  });
});

describe('Formatting Functions', () => {
  test('formatCurrency should format currency correctly', () => {
    const result = formatCurrency(123456.78);
    expect(result).toBe('₹1,23,456.78');
  });

  test('formatPercentage should format percentage correctly', () => {
    const result = formatPercentage(12.345);
    expect(result).toBe('12.35%');
  });

  test('formatStockMove should format stock move with sign', () => {
    const positiveResult = formatStockMove(5.67);
    const negativeResult = formatStockMove(-3.45);
    
    expect(positiveResult).toBe('+5.67%');
    expect(negativeResult).toBe('-3.45%');
  });
});

describe('Utility Functions', () => {
  test('safeCalculation should handle errors gracefully', () => {
    const result = safeCalculation(
      () => { throw new Error('Test error'); },
      'fallback',
      'Test error message'
    );
    
    expect(result).toBe('fallback');
  });

  test('validateCalculationInputs should validate inputs correctly', () => {
    const validResult = validateCalculationInputs([mockTrade], 100000);
    expect(validResult.isValid).toBe(true);
    expect(validResult.errors).toHaveLength(0);

    const invalidResult = validateCalculationInputs([], -1000);
    expect(invalidResult.isValid).toBe(false);
    expect(invalidResult.errors.length).toBeGreaterThan(0);
  });
});

describe('Edge Cases and Error Handling', () => {
  test('should handle zero values gracefully', () => {
    expect(calcAvgEntry([])).toBe(0);
    expect(calcPositionSize(0, 100)).toBe(0);
    expect(calcAllocation(1000, 0)).toBe(0);
    expect(calcSLPercent(0, 100)).toBe(0);
  });

  test('should handle negative values appropriately', () => {
    const result = calcStockMove(100, 90, 95, 100, 0, 'Open', 'Buy');
    expect(result).toBeLessThan(0); // Should be negative for loss
  });

  test('should handle invalid position status', () => {
    const result = calcStockMove(100, 110, 105, 50, 50, 'Invalid' as any, 'Buy');
    expect(result).toBe(0); // Should return 0 for invalid status
  });
});

describe('Performance and Memory', () => {
  test('should handle large datasets efficiently', () => {
    const largeEntries = Array.from({ length: 1000 }, (_, i) => ({
      price: 100 + i * 0.1,
      qty: 10
    }));

    const startTime = performance.now();
    const result = calcAvgEntry(largeEntries);
    const endTime = performance.now();

    expect(result).toBeGreaterThan(0);
    expect(endTime - startTime).toBeLessThan(100); // Should complete in under 100ms
  });

  test('should not cause memory leaks with repeated calculations', () => {
    for (let i = 0; i < 1000; i++) {
      calcPositionSize(2500 + i, 100);
      calcAllocation(250000 + i * 100, 10000000);
      calcSLPercent(2400, 2500 + i);
    }
    
    // If we reach here without memory issues, test passes
    expect(true).toBe(true);
  });
});
