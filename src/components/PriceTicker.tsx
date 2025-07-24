import React, { useMemo } from 'react'; // CRITICAL PERFORMANCE FIX: Import useMemo
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Spinner, Chip } from '@heroui/react';
import { usePriceTicks } from '../hooks/usePriceTicks';
import { format } from 'date-fns';

interface PriceTickerProps {
  symbol: string;
  maxRows?: number;
  showHeader?: boolean;
  compact?: boolean;
}

// CRITICAL PERFORMANCE FIX: Wrap entire component in React.memo
// This prevents unnecessary re-renders when parent components update
export const PriceTicker: React.FC<PriceTickerProps> = React.memo(({
  symbol,
  maxRows = 10,
  showHeader = true,
  compact = false
}) => {
  const { priceTicks, latestPrice, loading, error, priceChange, lastUpdated } = usePriceTicks(symbol);

  // CRITICAL PERFORMANCE FIX: Memoize expensive data transformation
  // This calculation now only runs when priceTicks or maxRows changes, not on every render
  const displayTicks = useMemo(() => {
    if (priceTicks.length === 0) return [];
    return [...priceTicks].slice(-maxRows).reverse();
  }, [priceTicks, maxRows]);

  // PERFORMANCE OPTIMIZATION: Memoize formatting functions to prevent recreation on every render
  const formatTime = useMemo(() => (dateTime: string) => {
    try {
      return format(new Date(dateTime), 'HH:mm:ss');
    } catch (e) {
      return dateTime;
    }
  }, []);

  const formatPrice = useMemo(() => (price: number) => {
    return price.toFixed(2);
  }, []);

  const formatVolume = useMemo(() => (volume: number) => {
    if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(1)}M`;
    } else if (volume >= 1000) {
      return `${(volume / 1000).toFixed(1)}K`;
    }
    return volume.toString();
  }, []);

  if (loading && priceTicks.length === 0) {
    return (
      <div className="flex justify-center items-center p-4 gap-3">
        <div className="relative">
          <div className="w-4 h-4 border border-foreground/20 border-t-foreground rounded-full animate-spin" />
        </div>
        <span className="text-sm font-medium text-foreground/80 font-sans">Loading {symbol}...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-2 text-red-500 text-sm">
        {/* CRITICAL FIX: Safe error handling - error is now guaranteed to be Error object */}
        Error loading {symbol}: {error.message}
      </div>
    );
  }

  if (priceTicks.length === 0) {
    return <div className="p-2 text-gray-500 text-sm">No data available for {symbol}</div>;
  }

  // REMOVED: Expensive data transformation moved to useMemo above
  // const displayTicks = [...priceTicks].slice(-maxRows).reverse();

  return (
    <div className={`w-full ${!compact ? 'border rounded-lg overflow-hidden' : ''}`}>
      {showHeader && (
        <div className="flex items-center justify-between p-2 bg-gray-50 border-b">
          <div className="flex items-center">
            <span className="font-medium">{symbol}</span>
            {latestPrice && (
              <span className="ml-2 font-medium">{formatPrice(latestPrice.close)}</span>
            )}
            {!isNaN(priceChange) && (
              <Chip
                size="sm"
                color={priceChange >= 0 ? 'success' : 'danger'}
                variant="flat"
                className="ml-2"
              >
                {priceChange >= 0 ? '↑' : '↓'} {Math.abs(priceChange).toFixed(2)}%
              </Chip>
            )}
          </div>
          {lastUpdated && (
            <div className="text-xs text-gray-500">
              {format(lastUpdated, 'HH:mm:ss')}
            </div>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <Table removeWrapper aria-label="Price Ticks" className="min-w-full">
          <TableHeader>
            <TableColumn width="25%">TIME</TableColumn>
            <TableColumn width="15%" className="text-right">PRICE</TableColumn>
            {!compact && (
              <>
                <TableColumn width="15%" className="text-right">VOL</TableColumn>
                <TableColumn width="15%" className="text-right">CHG</TableColumn>
              </>
            )}
          </TableHeader>
          <TableBody>
            {displayTicks.map((tick) => {
              // PERFORMANCE OPTIMIZATION: Move calculations inside map for better readability
              // These are lightweight calculations that don't need memoization
              const isUp = tick.close > tick.open;
              const change = tick.close - tick.open;
              const changePercent = (change / tick.open) * 100;

              return (
                // CRITICAL BUG FIX: Use stable unique ID for React key
                // This prevents visual glitches and incorrect re-renders
                <TableRow key={tick.id}>
                  <TableCell className="text-xs">{formatTime(tick.dateTime)}</TableCell>
                  <TableCell className={`text-right font-medium ${isUp ? 'text-green-500' : 'text-red-500'}`}>
                    {formatPrice(tick.close)}
                  </TableCell>
                  {!compact && (
                    <>
                      <TableCell className="text-right text-xs text-gray-500">
                        {formatVolume(tick.volume)}
                      </TableCell>
                      <TableCell className={`text-right text-xs font-medium ${isUp ? 'text-green-500' : 'text-red-500'}`}>
                        {change >= 0 ? '+' : ''}{change.toFixed(2)} ({changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%)
                      </TableCell>
                    </>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}); // CRITICAL PERFORMANCE FIX: Close React.memo wrapper

export default PriceTicker;
