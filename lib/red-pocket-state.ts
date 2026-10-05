export type RedPocketState = "owed" | "paid" | "crying";

export function redPocketState(row: { paid_at: string | null; crying_poor: boolean }): RedPocketState {
  return row.paid_at ? "paid" : row.crying_poor ? "crying" : "owed";
}
