// REMOVED: Milestone functionality has been completely removed from the application
// This file is kept as a stub to prevent import errors during the removal process

import { Milestone } from '../utils/milestones';

interface AchievedMilestone extends Milestone {
  achievedAt: string;
}

export const useMilestones = () => {
  return {
    achievedMilestones: [] as AchievedMilestone[],
    ALL_MILESTONES: [] as Milestone[],
    isLoading: false,
  };
};

export const useMilestones = () => {
  const { trades } = useTrades();
  const { getAllMonthlyTruePortfolios, portfolioSize, yearlyStartingCapitals } = useTruePortfolio();
  const { accountingMethod } = useAccountingMethod();
  const useCashBasis = accountingMethod === 'cash';

  // Get monthly portfolios with accounting method-aware calculations
  const monthlyPortfolios = getAllMonthlyTruePortfolios(trades, useCashBasis);

  const [achievedMilestones, setAchievedMilestones] = useState<AchievedMilestone[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load milestones from IndexedDB on mount
  useEffect(() => {
    const loadMilestones = async () => {
      if (typeof window === 'undefined') {
        setIsLoading(false);
        return;
      }

      try {
        const milestonesRecord = await SupabaseService.getMilestonesData();
        if (milestonesRecord && milestonesRecord.achievements) {
          setAchievedMilestones(milestonesRecord.achievements);
        }
      } catch (error) {
        } finally {
        setIsLoading(false);
      }
    };

    loadMilestones();
  }, []);

  const checkAndAwardMilestones = useCallback(() => {
    const newlyAchieved: AchievedMilestone[] = [];

    // For cash basis, deduplicate trades to avoid double counting in milestone calculations
    let uniqueTrades = trades;
    if (useCashBasis) {
      const seenTradeIds = new Set();
      uniqueTrades = trades.filter(trade => {
        const originalId = trade.id.split('_exit_')[0];
        if (seenTradeIds.has(originalId)) return false;
        seenTradeIds.add(originalId);
        return true;
      });
    }

    ALL_MILESTONES.forEach(milestone => {
      // Check if already achieved
      const alreadyAchieved = achievedMilestones.some(a => a.id === milestone.id);

      if (!alreadyAchieved) {
        // Check if criteria is met with accounting method-aware data (use deduplicated trades)
        if (milestone.criteria(uniqueTrades, monthlyPortfolios, portfolioSize, yearlyStartingCapitals, useCashBasis)) {
          newlyAchieved.push({
            ...milestone,
            achievedAt: new Date().toISOString(),
          });
        }
      }
    });

    if (newlyAchieved.length > 0) {
      setAchievedMilestones(prev => {
        const updated = [...prev, ...newlyAchieved];
        // Ensure uniqueness and sort by achievedAt
        const uniqueAndSorted = Array.from(new Set(updated.map(m => m.id)))
          .map(id => updated.find(m => m.id === id)!)
          .sort((a, b) => new Date(a.achievedAt).getTime() - new Date(b.achievedAt).getTime());
        return uniqueAndSorted;
      });
    }
  }, [trades, monthlyPortfolios, portfolioSize, yearlyStartingCapitals, useCashBasis]); // Removed achievedMilestones to prevent infinite loops

  useEffect(() => {
    // Debounce milestone checking to prevent excessive re-evaluation
    const timeoutId = setTimeout(() => {
      checkAndAwardMilestones();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [checkAndAwardMilestones]); // Re-run when dependencies change

  // Save milestones to Supabase
  useEffect(() => {
    if (!isLoading && typeof window !== 'undefined') {
      SupabaseService.saveMilestonesData(achievedMilestones);
    }
  }, [achievedMilestones, isLoading]);

  return {
    achievedMilestones,
    ALL_MILESTONES,
    isLoading,
  };
};