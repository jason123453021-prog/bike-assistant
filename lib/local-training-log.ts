import type { RideRecord } from "@/lib/ride-context";

export interface TrainingLogDay {
  date: Date;
  dayNumber: number;
  rideCount: number;
  totalDistanceKm: number;
  totalElevation: number;
  totalTss: number;
}

export interface TrainingLogMonth {
  year: number;
  month: number;
  days: Array<TrainingLogDay | null>;
}

/** 將裝置內騎乘紀錄彙整為週一開始的月曆格，沒有任何網路或帳號依賴。 */
export function buildLocalTrainingLog(rides: RideRecord[], year: number, month: number): TrainingLogMonth {
  const firstDay = new Date(year, month, 1);
  const firstWeekday = (firstDay.getDay() + 6) % 7;
  const dayCount = new Date(year, month + 1, 0).getDate();
  const days: Array<TrainingLogDay | null> = Array.from({ length: firstWeekday }, () => null);

  for (let dayNumber = 1; dayNumber <= dayCount; dayNumber += 1) {
    const sameDayRides = rides.filter((ride) => {
      const date = new Date(ride.date);
      return date.getFullYear() === year && date.getMonth() === month && date.getDate() === dayNumber;
    });
    days.push({
      date: new Date(year, month, dayNumber),
      dayNumber,
      rideCount: sameDayRides.length,
      totalDistanceKm: sameDayRides.reduce((sum, ride) => sum + ride.distance / 1000, 0),
      totalElevation: sameDayRides.reduce((sum, ride) => sum + ride.totalAscent, 0),
      totalTss: sameDayRides.reduce((sum, ride) => sum + (ride.tss ?? 0), 0),
    });
  }

  while (days.length % 7 !== 0) days.push(null);
  return { year, month, days };
}

export function shiftTrainingLogMonth(date: Date, offset: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}
