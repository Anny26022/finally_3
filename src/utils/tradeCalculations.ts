/**
 * GAP DOWN ANALYSIS FUNCTIONS
 * All other calculations moved to src/lib/calculations/
 */
import { isRiskyPosition } from '../lib/calculations';

export interface TradeGapDownAnalysis {
  tradeId: string;
  tradeName: string;
  normalStopLossRisk: number;
  gapDownRisk: number;
  additionalRisk: number;
  riskIncreaseFactor: number;
}

export interface PortfolioGapDownAnalysis {
  totalNormalRisk: number;
  totalGapDownRisk: number;
  totalAdditionalRisk: number;
  riskIncreaseFactor: number;
  affectedTrades: TradeGapDownAnalysis[];
  scenarios: GapDownScenario[];
  normalPfImpact: number;
  gapDownPfImpact: number;
  additionalPfImpact: number;
  tradeAnalyses: TradeGapDownAnalysis[];
}

export interface GapDownScenario {
  percentage: number;
  totalRisk: number;
  riskIncreaseFactor: number;
}

// Centralized risk calculation function to eliminate duplication
function calcPositionRisk(
  entryPrice: number,
  stopPrice: number,
  quantity: number,
  buySell: 'Buy' | 'Sell' = 'Buy'
): number {
  return buySell === 'Buy'
    ? Math.abs((stopPrice - entryPrice) * quantity)
    : Math.abs((entryPrice - stopPrice) * quantity);
}

// Centralized gap down price calculation
function calcGapDownPrice(
  entryPrice: number,
  gapPercentage: number,
  buySell: 'Buy' | 'Sell' = 'Buy'
): number {
  return buySell === 'Buy'
    ? entryPrice * (1 - gapPercentage / 100)
    : entryPrice * (1 + gapPercentage / 100);
}

function calcTradeGapDownAnalysis(
  trade: any,
  gapDownPercentage: number,
  portfolioSize: number,
  getPortfolioSize?: (month: string, year: number) => number
): TradeGapDownAnalysis {
  const avgEntry = trade.avgEntry || 0;
  const sl = trade.sl || 0;
  const openQty = trade.openQty || 0;
  const buySell = trade.buySell || 'Buy';

  // Calculate effective portfolio size
  let effectivePortfolioSize = portfolioSize;
  if (getPortfolioSize && trade.date) {
    try {
      const tradeDate = new Date(trade.date);
      const month = tradeDate.toLocaleString('default', { month: 'short' });
      const year = tradeDate.getFullYear();
      const monthlySize = getPortfolioSize(month, year);
      if (monthlySize > 0) effectivePortfolioSize = monthlySize;
    } catch (error) {}
  }

  // Use centralized risk calculation functions
  const normalStopLossRisk = calcPositionRisk(avgEntry, sl, openQty, buySell);
  const gapDownPrice = calcGapDownPrice(avgEntry, gapDownPercentage, buySell);
  const gapDownRisk = calcPositionRisk(avgEntry, gapDownPrice, openQty, buySell);
  const additionalRisk = gapDownRisk - normalStopLossRisk;
  const riskIncreaseFactor = normalStopLossRisk > 0 ? gapDownRisk / normalStopLossRisk : 1;

  return {
    tradeId: trade.id,
    tradeName: trade.name || 'Unknown',
    normalStopLossRisk,
    gapDownRisk,
    additionalRisk,
    riskIncreaseFactor
  };
}

export function calcPortfolioGapDownAnalysis(
  trades: any[],
  gapDownPercentage: number,
  portfolioSize: number,
  getPortfolioSize?: (month: string, year: number) => number
): PortfolioGapDownAnalysis {
  const riskyOpenTrades = trades.filter(t =>
    (t.positionStatus === 'Open' || t.positionStatus === 'Partial') &&
    t.openQty > 0 && isRiskyPosition(t));

  const tradeAnalyses = riskyOpenTrades.map(trade =>
    calcTradeGapDownAnalysis(trade, gapDownPercentage, portfolioSize, getPortfolioSize)
  );

  const totalNormalRisk = tradeAnalyses.reduce((sum, analysis) => sum + analysis.normalStopLossRisk, 0);
  const totalGapDownRisk = tradeAnalyses.reduce((sum, analysis) => sum + analysis.gapDownRisk, 0);
  const totalAdditionalRisk = totalGapDownRisk - totalNormalRisk;
  const riskIncreaseFactor = totalNormalRisk > 0 ? totalGapDownRisk / totalNormalRisk : 1;

  let effectivePortfolioSize = portfolioSize;
  if (getPortfolioSize && tradeAnalyses.length > 0) {
    try {
      const firstTrade = riskyOpenTrades[0];
      if (firstTrade?.date) {
        const tradeDate = new Date(firstTrade.date);
        const month = tradeDate.toLocaleString('default', { month: 'short' });
        const year = tradeDate.getFullYear();
        const monthlySize = getPortfolioSize(month, year);
        if (monthlySize > 0) effectivePortfolioSize = monthlySize;
      }
    } catch (error) {}
  }
  const normalPfImpact = effectivePortfolioSize > 0 ? (totalNormalRisk / effectivePortfolioSize) * 100 : 0;
  const gapDownPfImpact = effectivePortfolioSize > 0 ? (totalGapDownRisk / effectivePortfolioSize) * 100 : 0;
  const additionalPfImpact = gapDownPfImpact - normalPfImpact;

  return {
    totalNormalRisk,
    totalGapDownRisk,
    totalAdditionalRisk,
    riskIncreaseFactor,
    affectedTrades: tradeAnalyses,
    scenarios: [],
    normalPfImpact,
    gapDownPfImpact,
    additionalPfImpact,
    tradeAnalyses: tradeAnalyses
  };
}

export function getGapDownScenarios(
  trades: any[],
  portfolioSize: number,
  getPortfolioSize?: (month: string, year: number) => number
): GapDownScenario[] {
  const percentages = [1, 2, 3, 4, 5, 7, 10, 15, 20];
  const riskyOpenTrades = trades.filter(t =>
    (t.positionStatus === 'Open' || t.positionStatus === 'Partial') &&
    t.openQty > 0 && isRiskyPosition(t));

  return percentages.map(percentage => {
    let totalNormalRisk = 0;
    let totalGapDownRisk = 0;
    riskyOpenTrades.forEach(trade => {
      const avgEntry = trade.avgEntry || 0;
      const sl = trade.sl || 0;
      const openQty = trade.openQty || 0;
      const buySell = trade.buySell || 'Buy';

      // Use centralized risk calculation functions
      const normalStopLossRisk = calcPositionRisk(avgEntry, sl, openQty, buySell);
      const gapDownPrice = calcGapDownPrice(avgEntry, percentage, buySell);
      const gapDownRisk = calcPositionRisk(avgEntry, gapDownPrice, openQty, buySell);

      totalNormalRisk += normalStopLossRisk;
      totalGapDownRisk += gapDownRisk;
    });
    const riskIncreaseFactor = totalNormalRisk > 0 ? totalGapDownRisk / totalNormalRisk : 1;
    return { percentage, totalRisk: totalGapDownRisk, riskIncreaseFactor };
  });
}
