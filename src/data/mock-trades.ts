import { Trade } from "../types/trade";
import { v4 as uuidv4 } from 'uuid';

export const mockTrades: Trade[] = [
  {
    id: uuidv4(),
    tradeNo: "T001",
    date: "2024-06-01",
    name: "HDFC Bank",
    entry: 1650.75,
    avgEntry: 1655.25,
    sl: 1600.00,
    slPercent: 3.1,
    tsl: 1620.00,
    buySell: "Buy",
    cmp: 1680.50,
    setup: "Breakout",
    baseDuration: "Swing",
    initialQty: 10,
    pyramid1Price: 1670.00,
    pyramid1Qty: 5,
    pyramid1Date: "2024-06-03",
    pyramid2Price: 0,
    pyramid2Qty: 0,
    pyramid2Date: "",
    positionSize: 15,
    allocation: 15,
    exit1Price: 1690.25,
    exit1Qty: 5,
    exit1Date: "2024-06-05",
    exit2Price: 0,
    exit2Qty: 0,
    exit2Date: "",
    exit3Price: 0,
    exit3Qty: 0,
    exit3Date: "",
    openQty: 10,
    exitedQty: 5,
    avgExitPrice: 1690.25,
    stockMove: 2.5,
    openHeat: 0.5,
    rewardRisk: 2.1,
    holdingDays: 4,
    positionStatus: "Partial",
    realisedAmount: 8451.25,
    plRs: 175.00,
    pfImpact: 0.8,
    cummPf: 0.8,
    planFollowed: true,
    exitTrigger: "Partial profit booking",
    proficiencyGrowthAreas: "Better entry timing"
  },
  {
    id: generateId(),
    tradeNo: "T002",
    date: "2024-05-28",
    name: "Reliance Industries",
    entry: 2850.50,
    avgEntry: 2850.50,
    sl: 2780.00,
    slPercent: 2.5,
    tsl: 2800.00,
    buySell: "Buy",
    cmp: 2920.75,
    setup: "Swing",
    baseDuration: "Positional",
    initialQty: 5,
    pyramid1Price: 2880.00,
    pyramid1Qty: 3,
    pyramid1Date: "2024-05-30",
    pyramid2Price: 2900.00,
    pyramid2Qty: 2,
    pyramid2Date: "2024-06-01",
    positionSize: 10,
    allocation: 25,
    exit1Price: 2950.25,
    exit1Qty: 10,
    exit1Date: "2024-06-04",
    exit2Price: 0,
    exit2Qty: 0,
    exit2Date: "",
    exit3Price: 0,
    exit3Qty: 0,
    exit3Date: "",
    openQty: 0,
    exitedQty: 10,
    avgExitPrice: 2950.25,
    stockMove: 3.5,
    openHeat: 0,
    rewardRisk: 3.2,
    holdingDays: 7,
    positionStatus: "Closed",
    realisedAmount: 29502.50,
    plRs: 997.50,
    pfImpact: 1.2,
    cummPf: 2.0,
    planFollowed: true,
    exitTrigger: "Target achieved",
    proficiencyGrowthAreas: "Good execution"
  },
  {
    id: generateId(),
    tradeNo: "T003",
    date: "2024-05-25",
    name: "Infosys",
    entry: 1450.25,
    avgEntry: 1450.25,
    sl: 1420.00,
    slPercent: 2.1,
    tsl: 1425.00,
    buySell: "Buy",
    cmp: 1410.50,
    setup: "Reversal",
    baseDuration: "Swing",
    initialQty: 8,
    pyramid1Price: 0,
    pyramid1Qty: 0,
    pyramid1Date: "",
    pyramid2Price: 0,
    pyramid2Qty: 0,
    pyramid2Date: "",
    positionSize: 8,
    allocation: 10,
    exit1Price: 1425.75,
    exit1Qty: 8,
    exit1Date: "2024-05-27",
    exit2Price: 0,
    exit2Qty: 0,
    exit2Date: "",
    exit3Price: 0,
    exit3Qty: 0,
    exit3Date: "",
    openQty: 0,
    exitedQty: 8,
    avgExitPrice: 1425.75,
    stockMove: -1.7,
    openHeat: 0,
    rewardRisk: 0.8,
    holdingDays: 2,
    positionStatus: "Closed",
    realisedAmount: 11406.00,
    plRs: -196.00,
    pfImpact: -0.3,
    cummPf: 1.7,
    planFollowed: false,
    exitTrigger: "Stop loss hit",
    proficiencyGrowthAreas: "Better trend analysis needed"
  },
  {
    id: generateId(),
    tradeNo: "T004",
    date: "2024-06-02",
    name: "TCS",
    entry: 3750.50,
    avgEntry: 3750.50,
    sl: 3700.00,
    slPercent: 1.3,
    tsl: 3720.00,
    buySell: "Buy",
    cmp: 3780.25,
    setup: "Momentum",
    baseDuration: "Intraday",
    initialQty: 3,
    pyramid1Price: 0,
    pyramid1Qty: 0,
    pyramid1Date: "",
    pyramid2Price: 0,
    pyramid2Qty: 0,
    pyramid2Date: "",
    positionSize: 3,
    allocation: 8,
    exit1Price: 0,
    exit1Qty: 0,
    exit1Date: "",
    exit2Price: 0,
    exit2Qty: 0,
    exit2Date: "",
    exit3Price: 0,
    exit3Qty: 0,
    exit3Date: "",
    openQty: 3,
    exitedQty: 0,
    avgExitPrice: 0,
    stockMove: 0.8,
    openHeat: 0.2,
    rewardRisk: 1.5,
    holdingDays: 1,
    positionStatus: "Open",
    realisedAmount: 0,
    plRs: 0,
    pfImpact: 0,
    cummPf: 1.7,
    planFollowed: true,
    exitTrigger: "",
    proficiencyGrowthAreas: ""
  },
  {
    id: generateId(),
    tradeNo: "T005",
    date: "2024-05-20",
    name: "Bharti Airtel",
    entry: 950.25,
    avgEntry: 955.75,
    sl: 930.00,
    slPercent: 2.1,
    tsl: 940.00,
    buySell: "Buy",
    cmp: 980.50,
    setup: "Breakout",
    baseDuration: "Positional",
    initialQty: 12,
    pyramid1Price: 965.00,
    pyramid1Qty: 8,
    pyramid1Date: "2024-05-22",
    pyramid2Price: 0,
    pyramid2Qty: 0,
    pyramid2Date: "",
    positionSize: 20,
    allocation: 18,
    exit1Price: 975.50,
    exit1Qty: 10,
    exit1Date: "2024-05-28",
    exit2Price: 985.25,
    exit2Qty: 10,
    exit2Date: "2024-06-01",
    exit3Price: 0,
    exit3Qty: 0,
    exit3Date: "",
    openQty: 0,
    exitedQty: 20,
    avgExitPrice: 980.38,
    stockMove: 3.2,
    openHeat: 0,
    rewardRisk: 2.8,
    holdingDays: 12,
    positionStatus: "Closed",
    realisedAmount: 19607.50,
    plRs: 492.50,
    pfImpact: 0.9,
    cummPf: 2.6,
    planFollowed: true,
    exitTrigger: "Target achieved",
    proficiencyGrowthAreas: "Good trade management"
  }
];
