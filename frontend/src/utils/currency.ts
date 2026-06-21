// Format a number as Indian Rupees — e.g. ₹1,29,999
export function inr(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN');
}
