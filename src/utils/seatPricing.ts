export const calculateSeatPrice = (
  basePrice: number,
  roomSurcharge: number,
  daySurcharge: number,
  seatSurcharge: number,
  capacity = 1,
): number => (
  (basePrice + roomSurcharge + daySurcharge) * Math.max(1, capacity)
  + seatSurcharge
);

export const formatSeatLabel = (row: string, startColumn: number, columnSpan = 1): string => (
  columnSpan > 1
    ? `${row}${startColumn}–${row}${startColumn + columnSpan - 1}`
    : `${row}${startColumn}`
);
