import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardBody, CardHeader, Button, Tabs, Tab, Chip, Modal, ModalContent, ModalHeader, ModalBody, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Divider } from "@heroui/react";
import { Icon } from "@iconify/react";
import { Trade } from "../../types/trade";
import { useAccountingMethod } from "../../context/AccountingMethodContext";
import { useGlobalFilter } from "../../context/GlobalFilterContext";
import { isTradeInGlobalFilter } from "../../utils/dateFilterUtils";
import { useTruePortfolioWithTrades } from "../../hooks/use-true-portfolio-with-trades";
import { useAccountingCalculations } from "../../hooks/use-accounting-calculations";

export interface DrawdownDataPoint {
  month: string;
  drawdown: number;
  volatility: number;
  capital: number;
  plPercentage: number;
  maxDrawdown: number;
  recovery: number;
}

interface DrawdownCurveProps {
  trades: Trade[];
  className?: string;
  embedded?: boolean; // New prop to control rendering mode
}

export const DrawdownCurve: React.FC<DrawdownCurveProps> = ({ trades, className, embedded = false }) => {
  const { accountingMethod } = useAccountingMethod();
  const useCashBasis = accountingMethod === 'cash';
  const { filter: globalFilter } = useGlobalFilter();
  const [selectedView, setSelectedView] = React.useState<"drawdown" | "volatility">("drawdown");
  const [isDetailModalOpen, setIsDetailModalOpen] = React.useState(false);
  const [selectedPeriod, setSelectedPeriod] = React.useState("YTD");

  // CRITICAL FIX: Use the same data source as main dashboard
  // Get portfolio data using the same hook as the main dashboard
  const { getAllMonthlyTruePortfolios } = useTruePortfolioWithTrades(trades);
  const monthlyPortfolios = getAllMonthlyTruePortfolios();

  // Also get the same accounting calculations as the main dashboard
  const { tradesWithAccountingPL, totalTrades, grossPL } = useAccountingCalculations(trades);

  // Filter trades based on global filter and accounting method
  const filteredTrades = React.useMemo(() => {
    if (globalFilter.type === 'all') {
      return trades;
    }
    return trades.filter(trade => isTradeInGlobalFilter(trade, globalFilter, useCashBasis));
  }, [trades, globalFilter, useCashBasis]);

  // Calculate drawdown and volatility data
  const drawdownData = React.useMemo(() => {
    // Handle case where monthlyPortfolios is undefined or empty
    if (!monthlyPortfolios || monthlyPortfolios.length === 0) {
      return [];
    }

    // Calculate cumulative profit factor (cummPf) for each month
    // This matches the tax analytics logic where cummPf is cumulative portfolio impact
    let cummPf = 0; // Start at 0% cumulative profit factor

    const processedData = monthlyPortfolios
      .map(monthData => {
        const monthlyReturn = monthData.startingCapital !== 0 ? (monthData.pl / monthData.startingCapital) * 100 : 0;
        cummPf += monthlyReturn; // Add this month's return to cumulative PF

        return {
          month: `${monthData.month} ${monthData.year}`,
          capital: monthData.finalCapital,
          pl: monthData.pl,
          plPercentage: monthlyReturn,
          cummPf: cummPf // Cumulative profit factor in percentage points
        };
      });

    if (processedData.length === 0) return [];

    // Track running maximum of cumulative PF (like tax analytics)
    let runningMax = processedData[0]?.cummPf || 0;
    let maxDrawdownSeen = 0;

    return processedData.map((d, index) => {
      // Check if this is a new peak (drawdown reset)
      const isNewPeak = d.cummPf > runningMax;

      // Update running maximum of cumulative PF
      if (d.cummPf > runningMax) runningMax = d.cummPf;

      // Calculate DD From Peak (absolute percentage points down from peak)
      // This exactly matches tax analytics logic: runningMax - currentPF
      const ddFromPeak = runningMax > 0 ? runningMax - d.cummPf : 0;

      // Track maximum drawdown seen so far
      if (ddFromPeak > maxDrawdownSeen) maxDrawdownSeen = ddFromPeak;

      // Calculate recovery (how close cumulative PF is to its peak)
      const recovery = runningMax !== 0 ? (d.cummPf / runningMax) * 100 : 100;

      // Calculate rolling volatility (3-month window)
      let volatility = 0;
      if (index >= 2) {
        const window = processedData.slice(Math.max(0, index - 2), index + 1);
        const returns = window.map(w => w.plPercentage);
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
        volatility = Math.sqrt(variance);
      }

      return {
        month: d.month,
        drawdown: -ddFromPeak, // Negative for visual representation (chart shows downward)
        ddFromPeak, // Positive value for display (absolute percentage points down from peak)
        isNewPeak, // Flag to show when drawdown resets
        volatility,
        capital: d.capital,
        plPercentage: d.plPercentage,
        cummPf: d.cummPf, // Cumulative profit factor
        maxDrawdown: -maxDrawdownSeen,
        recovery
      };
    });
  }, [monthlyPortfolios]);

  // Calculate summary statistics
  const summaryStats = React.useMemo(() => {
    if (drawdownData.length === 0) return { maxDrawdown: 0, avgVolatility: 0, currentDrawdown: 0, recoveryTime: 0, newPeaks: 0 };

    const maxDrawdown = Math.min(...drawdownData.map(d => d.drawdown));
    const avgVolatility = drawdownData.reduce((sum, d) => sum + d.volatility, 0) / drawdownData.length;
    const currentDrawdown = drawdownData[drawdownData.length - 1]?.drawdown || 0;

    // Count number of new peaks (drawdown resets)
    const newPeaks = drawdownData.filter(d => d.isNewPeak).length;

    // Calculate average recovery time (simplified)
    let recoveryPeriods = 0;
    let inDrawdown = false;
    let drawdownStart = 0;

    drawdownData.forEach((d, i) => {
      if (d.drawdown < -0.5 && !inDrawdown) {
        inDrawdown = true;
        drawdownStart = i;
      } else if (d.drawdown >= -0.1 && inDrawdown) {
        inDrawdown = false;
        recoveryPeriods += i - drawdownStart;
      }
    });

    return {
      maxDrawdown: Math.abs(maxDrawdown),
      avgVolatility,
      currentDrawdown: Math.abs(currentDrawdown),
      recoveryTime: recoveryPeriods,
      newPeaks
    };
  }, [drawdownData]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-content1 border border-divider rounded-lg p-3 shadow-lg">
          <p className="font-medium text-sm mb-2">{label}</p>
          {selectedView === "drawdown" ? (
            <>
              <p className="text-danger text-sm">
                DD From Peak: {data.ddFromPeak.toFixed(2)}%
              </p>
              <p className="text-default-600 text-sm">
                Recovery: {data.recovery.toFixed(1)}%
              </p>
              {data.isNewPeak && (
                <p className="text-success text-sm font-medium flex items-center gap-1">
                  <span>🏆</span> New Peak! (DD Reset)
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-warning text-sm">
                Volatility: {data.volatility.toFixed(2)}%
              </p>
              <p className="text-default-600 text-sm">
                P&L: {data.plPercentage >= 0 ? '+' : ''}{data.plPercentage.toFixed(2)}%
              </p>
            </>
          )}
        </div>
      );
    }
    return null;
  };

  // Empty state content (without Card wrapper for embedded mode)
  const emptyStateContent = (
    <>
      {!embedded && (
        <>
          <CardHeader className="flex flex-col gap-3">
            <div className="flex justify-between items-center w-full">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-danger/10">
                  <Icon icon="lucide:trending-down" className="text-danger text-sm" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Drawdown Analysis</h3>
                  <p className="text-xs text-default-500">Risk and volatility metrics</p>
                </div>
              </div>
            </div>
          </CardHeader>
          <Divider />
        </>
      )}
      <CardBody>
        <div className="flex flex-col items-center justify-center h-[350px] text-center">
          <Icon icon="lucide:bar-chart-3" className="w-12 h-12 text-default-300 mb-3" />
          <p className="text-default-500 text-sm">No data available for drawdown analysis</p>
          <p className="text-default-400 text-xs mt-1">
            {totalTrades > 0
              ? `${totalTrades} trades found, but no monthly portfolio data available`
              : "Add some trades to see risk metrics"
            }
          </p>
          {/* Debug info to show connection to main dashboard */}
          <div className="mt-3 p-2 bg-default-100 rounded text-xs text-left">
            <p><strong>Debug Info:</strong></p>
            <p>• Total Trades: {totalTrades}</p>
            <p>• Gross P/L: ₹{grossPL.toFixed(2)}</p>
            <p>• Monthly Portfolios: {monthlyPortfolios?.length || 0}</p>
            <p>• Accounting: {useCashBasis ? 'Cash' : 'Accrual'}</p>
          </div>
        </div>
      </CardBody>
    </>
  );

  // Show loading or empty state if no data
  if (!drawdownData || drawdownData.length === 0) {
    return embedded ? emptyStateContent : (
      <Card className={className}>
        {emptyStateContent}
      </Card>
    );
  }

  // Main content (without Card wrapper for embedded mode)
  const mainContent = (
    <>
      {!embedded && (
        <CardHeader className="flex flex-col gap-3">
          <div className="flex justify-between items-center w-full">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-danger/10">
                <Icon icon="lucide:trending-down" className="text-danger text-sm" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Drawdown Analysis</h3>
                <p className="text-xs text-default-500">Risk and volatility metrics</p>
              </div>
            </div>
            <Button
              isIconOnly
              variant="light"
              size="sm"
              onPress={() => setIsDetailModalOpen(true)}
              className="text-default-400 hover:text-primary"
              isDisabled={drawdownData.length === 0}
            >
              <Icon icon="lucide:maximize-2" className="w-4 h-4" />
            </Button>
          </div>

          {/* Toggle between Drawdown and Volatility */}
          <Tabs
            selectedKey={selectedView}
            onSelectionChange={(key) => setSelectedView(key as "drawdown" | "volatility")}
            size="sm"
            variant="underlined"
            classNames={{
              tabList: "gap-6 w-full relative rounded-none p-0 border-b border-divider",
              cursor: "w-full bg-primary-500",
              tab: "max-w-fit px-0 h-8",
              tabContent: "group-data-[selected=true]:text-primary-500"
            }}
          >
            <Tab
              key="drawdown"
              title={
                <div className="flex items-center gap-2">
                  <Icon icon="lucide:trending-down" className="w-4 h-4" />
                  <span>Drawdown</span>
                </div>
              }
            />
            <Tab
              key="volatility"
              title={
                <div className="flex items-center gap-2">
                  <Icon icon="lucide:activity" className="w-4 h-4" />
                  <span>Volatility</span>
                </div>
              }
            />
          </Tabs>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="text-center">
              <p className="text-xs text-default-500">Max DD</p>
              <p className="text-sm font-semibold text-danger">
                {summaryStats.maxDrawdown.toFixed(2)}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-default-500">Current DD</p>
              <p className="text-sm font-semibold text-warning">
                {summaryStats.currentDrawdown.toFixed(2)}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-default-500">Avg Volatility</p>
              <p className="text-sm font-semibold text-primary">
                {summaryStats.avgVolatility.toFixed(2)}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-default-500">New Peaks</p>
              <p className="text-sm font-semibold text-success">
                {summaryStats.newPeaks}
              </p>
            </div>
          </div>
        </CardHeader>
      )}
      {!embedded && <Divider />}

      {/* For embedded mode, show tabs and stats without CardHeader wrapper */}
      {embedded && (
        <div className="flex flex-col gap-3 mb-4">
          {/* Toggle between Drawdown and Volatility */}
          <Tabs
            selectedKey={selectedView}
            onSelectionChange={(key) => setSelectedView(key as "drawdown" | "volatility")}
            size="sm"
            variant="underlined"
            classNames={{
              tabList: "gap-6 w-full relative rounded-none p-0 border-b border-divider",
              cursor: "w-full bg-primary-500",
              tab: "max-w-fit px-0 h-8",
              tabContent: "group-data-[selected=true]:text-primary-500"
            }}
          >
            <Tab
              key="drawdown"
              title={
                <div className="flex items-center gap-2">
                  <Icon icon="lucide:trending-down" className="w-4 h-4" />
                  <span>Drawdown</span>
                </div>
              }
            />
            <Tab
              key="volatility"
              title={
                <div className="flex items-center gap-2">
                  <Icon icon="lucide:activity" className="w-4 h-4" />
                  <span>Volatility</span>
                </div>
              }
            />
          </Tabs>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="text-center">
              <p className="text-xs text-default-500">Max DD</p>
              <p className="text-sm font-semibold text-danger">
                {summaryStats.maxDrawdown.toFixed(2)}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-default-500">Current DD</p>
              <p className="text-sm font-semibold text-warning">
                {summaryStats.currentDrawdown.toFixed(2)}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-default-500">Avg Volatility</p>
              <p className="text-sm font-semibold text-primary">
                {summaryStats.avgVolatility.toFixed(2)}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-default-500">New Peaks</p>
              <p className="text-sm font-semibold text-success">
                {summaryStats.newPeaks}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Chart content - wrapped in CardBody for standalone, plain div for embedded */}
      {embedded ? (
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <AnimatePresence mode="wait">
              {selectedView === "drawdown" ? (
                <AreaChart
                  data={drawdownData}
                  margin={{ top: 10, right: 30, left: 30, bottom: 30 }}
                >
                  <defs>
                    <linearGradient id="colorDrawdown" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--heroui-danger-500))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--heroui-danger-500))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--heroui-divider))" />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => `${Math.abs(value).toFixed(1)}%`}
                    domain={['dataMin', 0]}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="drawdown"
                    name="Drawdown"
                    stroke="hsl(var(--heroui-danger))"
                    fillOpacity={1}
                    fill="url(#colorDrawdown)"
                    strokeWidth={2}
                    activeDot={{ r: 4, strokeWidth: 2 }}
                    dot={(props: any) => {
                      const { payload } = props;
                      if (payload?.isNewPeak) {
                        return (
                          <circle
                            cx={props.cx}
                            cy={props.cy}
                            r={6}
                            fill="hsl(var(--heroui-success))"
                            stroke="white"
                            strokeWidth={2}
                          />
                        );
                      }
                      return null;
                    }}
                  />
                </AreaChart>
              ) : (
                <LineChart
                  data={drawdownData}
                  margin={{ top: 10, right: 30, left: 30, bottom: 30 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--heroui-divider))" />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => `${value.toFixed(1)}%`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="volatility"
                    name="Volatility"
                    stroke="hsl(var(--heroui-warning))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5, strokeWidth: 2 }}
                  />
                </LineChart>
              )}
            </AnimatePresence>
          </ResponsiveContainer>
        </div>
      ) : (
        <CardBody>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AnimatePresence mode="wait">
                {selectedView === "drawdown" ? (
                  <AreaChart
                    data={drawdownData}
                    margin={{ top: 10, right: 30, left: 30, bottom: 30 }}
                  >
                    <defs>
                      <linearGradient id="colorDrawdown" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--heroui-danger-500))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--heroui-danger-500))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--heroui-divider))" />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value) => `${Math.abs(value).toFixed(1)}%`}
                      domain={['dataMin', 0]}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="drawdown"
                      name="Drawdown"
                      stroke="hsl(var(--heroui-danger))"
                      fillOpacity={1}
                      fill="url(#colorDrawdown)"
                      strokeWidth={2}
                      activeDot={{ r: 4, strokeWidth: 2 }}
                      dot={(props: any) => {
                        const { payload } = props;
                        if (payload?.isNewPeak) {
                          return (
                            <circle
                              cx={props.cx}
                              cy={props.cy}
                              r={6}
                              fill="hsl(var(--heroui-success))"
                              stroke="white"
                              strokeWidth={2}
                            />
                          );
                        }
                        return null;
                      }}
                    />
                  </AreaChart>
                ) : (
                  <LineChart
                    data={drawdownData}
                    margin={{ top: 10, right: 30, left: 30, bottom: 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--heroui-divider))" />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value) => `${value.toFixed(1)}%`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="volatility"
                      name="Volatility"
                      stroke="hsl(var(--heroui-warning))"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5, strokeWidth: 2 }}
                    />
                  </LineChart>
                )}
              </AnimatePresence>
            </ResponsiveContainer>
          </div>
        </CardBody>
      )}
    </>
  );

  return (
    <>
      {embedded ? mainContent : (
        <Card className={className}>
          {mainContent}
        </Card>
      )}

      {/* Detailed Modal - always rendered regardless of embedded mode */}
      <Modal
        isOpen={isDetailModalOpen}
        onOpenChange={setIsDetailModalOpen}
        size="4xl"
        scrollBehavior="inside"
        classNames={{
          base: "transform-gpu backdrop-blur-sm",
          wrapper: "transform-gpu",
          backdrop: "bg-black/40",
          closeButton: "text-foreground/60 hover:bg-white/10"
        }}
        backdrop="blur"
      >
        <ModalContent className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl border border-gray-200 dark:border-gray-700 shadow-2xl max-h-[90vh]">
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1 border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-danger/10">
                    <Icon icon="lucide:trending-down" className="text-danger text-sm" />
                  </div>
                  <div>
                    <span className="text-base font-semibold">Detailed Drawdown Analysis</span>
                    <p className="text-xs text-default-500 mt-0.5">
                      {useCashBasis ? 'Cash Basis' : 'Accrual Basis'} • Risk metrics breakdown
                    </p>
                  </div>
                </div>
              </ModalHeader>
              <ModalBody className="p-4">
                <div className="space-y-4">
                  {/* Enhanced Chart */}
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={drawdownData}
                        margin={{ top: 10, right: 30, left: 30, bottom: 30 }}
                      >
                        <defs>
                          <linearGradient id="colorDrawdownModal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--heroui-danger-500))" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="hsl(var(--heroui-danger-500))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--heroui-divider))" />
                        <XAxis 
                          dataKey="month" 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => `${Math.abs(value).toFixed(1)}%`}
                          domain={['dataMin', 0]}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Area 
                          type="monotone" 
                          dataKey="drawdown" 
                          name="Drawdown %"
                          stroke="hsl(var(--heroui-danger))" 
                          fillOpacity={1}
                          fill="url(#colorDrawdownModal)" 
                          strokeWidth={2}
                          activeDot={{ r: 6, strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Detailed Statistics Table */}
                  <Table
                    aria-label="Drawdown analysis table"
                    classNames={{
                      wrapper: "max-h-[300px] border border-divider/30 rounded-lg overflow-hidden",
                      table: "border-collapse",
                      th: "bg-content1/50 text-sm font-medium text-default-600 border-b border-divider/30 px-3 py-2.5",
                      td: "py-2.5 px-3 text-sm border-b border-divider/20",
                      tr: "hover:bg-content1/20 transition-colors"
                    }}
                  >
                    <TableHeader>
                      <TableColumn key="date" align="start" width={90}>Date</TableColumn>
                      <TableColumn key="plPercentage" align="center" width={100}>Monthly P&L</TableColumn>
                      <TableColumn key="cummPf" align="center" width={110}>Cum PF Impact</TableColumn>
                      <TableColumn key="ddFromPeak" align="center" width={110}>DD From Peak</TableColumn>
                      <TableColumn key="volatility" align="center" width={100}>Volatility</TableColumn>
                      <TableColumn key="recovery" align="center" width={100}>Recovery</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {drawdownData.map((item, index) => (
                        <TableRow
                          key={index}
                          className={`${item.isNewPeak ? "bg-success/10 border-l-4 border-l-success" : "hover:bg-content1/50"} transition-all duration-200`}
                        >
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {item.isNewPeak && (
                                <Icon icon="lucide:crown" className="w-3 h-3 text-warning" />
                              )}
                              <span className="text-sm">{item.month}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={item.plPercentage >= 0 ? "text-success font-medium" : "text-danger font-medium"}>
                              {item.plPercentage >= 0 ? '+' : ''}{item.plPercentage.toFixed(2)}%
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-medium">
                              {item.cummPf.toFixed(2)}%
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`text-sm font-medium ${item.ddFromPeak > 0 ? "text-danger" : "text-success"}`}>
                              {item.ddFromPeak === 0 ? "0.00%" : `${item.ddFromPeak.toFixed(2)}%`}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-warning">
                              {item.volatility.toFixed(2)}%
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={item.recovery >= 95 ? "text-success" : "text-warning"}>
                              {item.recovery.toFixed(1)}%
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
};
