import React, { useState, useMemo } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Button,
  Card,
  CardBody,
  Select,
  SelectItem,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Divider
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import { Trade } from "../types/trade";
import { formatCurrency, formatPercentage } from '../utils/formatters';
import {
  calcPortfolioGapDownAnalysis,
  getGapDownScenarios,
  PortfolioGapDownAnalysis,
  GapDownScenario
} from "../utils/tradeCalculations";
import { isRiskyPosition } from "../lib/calculations";
import { useQuery } from '@tanstack/react-query';
import * as tradeService from '../services/tradeService';

interface GapDownAnalysisModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  portfolioSize: number;
  getPortfolioSize?: (month: string, year: number) => number;
}

export default function GapDownAnalysisModal({
  isOpen,
  onOpenChange,
  portfolioSize,
  getPortfolioSize
}: GapDownAnalysisModalProps) {
  const [selectedScenario, setSelectedScenario] = useState("5");

  // WORLD-CLASS FIX: Load trades internally when modal is open
  const { data: trades = [], isLoading: isLoadingTrades } = useQuery({
    queryKey: ['trades'],
    queryFn: tradeService.getTrades,
    enabled: isOpen, // Only fetch when modal is open
    staleTime: 5 * 60 * 1000,
  });

  // CRITICAL FIX: Only calculate scenarios when trades are loaded
  const scenarios = useMemo(() => {
    if (!trades || trades.length === 0 || isLoadingTrades) return [];
    return getGapDownScenarios(trades, portfolioSize);
  }, [trades, portfolioSize, isLoadingTrades]);

  // Filter for risky open positions only (SL only, no TSL)
  const riskyOpenTrades = useMemo(() => 
    trades.filter(t => 
      (t.positionStatus === 'Open' || t.positionStatus === 'Partial') && 
      t.openQty > 0 &&
      isRiskyPosition(t)
    ), [trades]
  );

  // Count protected positions for display
  const protectedPositions = useMemo(() => 
    trades.filter(t => 
      (t.positionStatus === 'Open' || t.positionStatus === 'Partial') && 
      t.openQty > 0 &&
      !isRiskyPosition(t)
    ), [trades]
  );

  // Calculate analysis based on selected scenario
  const analysis = useMemo(() => {
    const gapDownPercentage = parseFloat(selectedScenario);
    return calcPortfolioGapDownAnalysis(riskyOpenTrades, gapDownPercentage, portfolioSize, getPortfolioSize);
  }, [riskyOpenTrades, selectedScenario, portfolioSize, getPortfolioSize]);

  const getRiskColor = (impact: number) => {
    if (impact < 1) return "default";
    if (impact < 3) return "warning";
    return "danger";
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onOpenChange={onOpenChange}
      size="5xl"
      scrollBehavior="inside"
      classNames={{
        base: "bg-white dark:bg-gray-900",
        header: "border-b border-gray-100 dark:border-gray-800",
        body: "p-0",
        closeButton: "hover:bg-gray-100 dark:hover:bg-gray-800"
      }}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <Icon icon="lucide:trending-down" className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">PORTFOLIO LEVEL RISK ASSESSMENT IN GAP DOWN SCENARIOS</h2>
                </div>
              </div>
            </ModalHeader>

            <ModalBody className="p-6">
              {riskyOpenTrades.length === 0 ? (
                // No Risky Positions - Celebration View
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-12"
                >
                  <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                    <Icon icon="lucide:shield-check" className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    All Positions Protected
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
                    Excellent risk management! All open positions have trailing stop protection.
                  </p>

                  {protectedPositions.length > 0 && (
                    <Card className="max-w-2xl mx-auto">
                      <CardBody className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-semibold text-gray-900 dark:text-white">
                            Protected Positions
                          </h4>
                          <Chip size="sm" color="success" variant="flat">
                            {protectedPositions.length} position{protectedPositions.length > 1 ? 's' : ''}
                          </Chip>
                        </div>
                        
                        <div className="space-y-3">
                          {protectedPositions.slice(0, 4).map((position, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                              <div>
                                <div className="font-medium text-gray-900 dark:text-white">
                                  {position.name}
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  {position.openQty} qty
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                                  TSL: ₹{position.tsl}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  Protected
                                </div>
                              </div>
                            </div>
                          ))}
                          
                          {protectedPositions.length > 4 && (
                            <div className="text-center text-sm text-gray-500 dark:text-gray-400 pt-2">
                              +{protectedPositions.length - 4} more protected positions
                            </div>
                          )}
                        </div>

                        <Divider className="my-4" />
                        
                        <div className="text-center">
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            In gap down scenarios, you'll only lose unrealized gains, not your capital.
                          </p>
                        </div>
                      </CardBody>
                    </Card>
                  )}
                </motion.div>
              ) : (
                // Risk Analysis View
                <div className="space-y-6">
                  {/* Scenario Selection - Fill in the blanks style */}
                  <div className="py-6 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2 text-lg font-medium text-gray-900 dark:text-white">
                      <span>What if my</span>
                      <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-md font-medium border border-blue-200 dark:border-blue-800">
                        {riskyOpenTrades.length}
                      </span>
                      <span>risky position{riskyOpenTrades.length !== 1 ? 's' : ''} gaps down</span>
                      <Select
                        selectedKeys={[selectedScenario]}
                        onSelectionChange={(keys) => setSelectedScenario(Array.from(keys)[0] as string)}
                        className="w-20"
                        variant="bordered"
                        size="sm"
                        aria-label="Gap down percentage"
                        renderValue={(items) => {
                          return items.map((item) => (
                            <span key={item.key} className="font-semibold">
                              {item.data?.gapDownPercentage || selectedScenario}%
                            </span>
                          ));
                        }}
                        classNames={{
                          trigger: "border-gray-200 dark:border-gray-700 min-h-8",
                          value: "text-center font-semibold text-gray-900 dark:text-white"
                        }}
                      >
                        {scenarios.map((scenario) => (
                          <SelectItem
                            key={scenario.gapDownPercentage.toString()}
                            value={scenario.gapDownPercentage.toString()}
                            textValue={`${scenario.gapDownPercentage}%`}
                          >
                            {scenario.gapDownPercentage}%
                          </SelectItem>
                        ))}
                      </Select>
                      {riskyOpenTrades.length !== 1 && <span>each</span>}
                      <span>?</span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                      Analyze portfolio impact in sudden market decline scenarios
                    </p>
                  </div>

                  {/* Risk Metrics - Compact */}
                  <div className="grid grid-cols-3 gap-6 py-4">
                    {/* Planned Risk */}
                    <div className="text-center">
                      <div className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                        RISKY POSITIONS RISK
                      </div>
                      <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mb-1">
                        {formatPercentage(analysis.normalPfImpact)}
                      </div>
                      <div className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                        {formatCurrency(analysis.totalNormalRisk)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        If all stops hit at planned price
                      </div>
                    </div>

                    {/* Gap Down Risk */}
                    <div className="text-center">
                      <div className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                        GAP DOWN RISK
                      </div>
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400 mb-1">
                        {formatPercentage(analysis.gapDownPfImpact)}
                      </div>
                      <div className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                        {formatCurrency(analysis.totalGapDownRisk)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {analysis.additionalPfImpact < 0 && (
                          <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                            You will still lose within your planned limits
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Incremental Change */}
                    <div className="text-center">
                      <div className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                        INCREMENTAL PF HIT
                      </div>
                      <div className={`text-2xl font-bold mb-1 ${
                        analysis.additionalPfImpact >= 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {analysis.additionalPfImpact >= 0 ? '+' : ''}{formatPercentage(analysis.additionalPfImpact)}
                      </div>
                      <div className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                        {analysis.totalAdditionalRisk >= 0 ? '+' : ''}{formatCurrency(analysis.totalAdditionalRisk)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {analysis.additionalPfImpact >= 0
                          ? `You will lose an additional ${formatPercentage(analysis.additionalPfImpact)} of your PF than expected`
                          : (
                            <span className="text-sm font-bold text-black dark:text-white">
                              No worries, everything's under control
                            </span>
                          )
                        }
                      </div>
                    </div>
                  </div>

                  {/* Position Analysis Table */}
                  {analysis.tradeAnalyses.length > 0 && (
                    <div className="border-t border-gray-100 dark:border-gray-800 pt-8">
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                            Position Analysis
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Individual position impact breakdown
                          </p>
                        </div>
                        <Chip size="sm" color={getRiskColor(analysis.gapDownPfImpact)} variant="flat">
                          {analysis.tradeAnalyses.length} risky position{analysis.tradeAnalyses.length > 1 ? 's' : ''}
                        </Chip>
                      </div>

                        <div className="overflow-x-auto">
                          <Table
                            aria-label="Position gap down analysis"
                            classNames={{
                              wrapper: "shadow-none border border-gray-200 dark:border-gray-700 rounded-lg",
                              th: "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium",
                              td: "border-b border-gray-100 dark:border-gray-800"
                            }}
                          >
                            <TableHeader>
                              <TableColumn>POSITION</TableColumn>
                              <TableColumn>CMP</TableColumn>
                              <TableColumn>SL</TableColumn>
                              <TableColumn>GAP PRICE</TableColumn>
                              <TableColumn>PLANNED</TableColumn>
                              <TableColumn>GAP RISK</TableColumn>
                              <TableColumn>CHANGE</TableColumn>
                            </TableHeader>
                            <TableBody>
                              {analysis.tradeAnalyses.map((trade) => (
                                <TableRow key={trade.tradeId}>
                                  <TableCell>
                                    <div>
                                      <div className="font-medium text-gray-900 dark:text-white">
                                        {trade.tradeName}
                                      </div>
                                      <div className="text-xs text-gray-500 dark:text-gray-400">
                                        {trade.openQty} qty • {trade.buySell}
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="font-mono text-sm">
                                      ₹{trade.currentPrice.toFixed(2)}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="font-mono text-sm">
                                      ₹{trade.stopLoss.toFixed(2)}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="font-mono text-sm text-red-600 dark:text-red-400">
                                      ₹{trade.gapDownPrice.toFixed(2)}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="font-mono text-sm">
                                      {formatCurrency(trade.normalStopLossRisk)}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="font-mono text-sm">
                                      {formatCurrency(trade.gapDownRisk)}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Chip
                                      size="sm"
                                      color={trade.additionalRisk >= 0 ? "danger" : "success"}
                                      variant="flat"
                                      className="font-mono"
                                    >
                                      {trade.additionalRisk >= 0 ? '+' : ''}{formatCurrency(trade.additionalRisk)}
                                    </Chip>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>

                      {protectedPositions.length > 0 && (
                        <>
                          <Divider className="my-6" />
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {protectedPositions.length} position{protectedPositions.length > 1 ? 's' : ''} excluded (TSL protected)
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Only lose unrealized gains, not capital
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </ModalBody>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
