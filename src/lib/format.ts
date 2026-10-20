const money = new Intl.NumberFormat("en", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

export const formatPrize = (amount: number) => (amount === 0 ? "None" : money.format(amount));
export const formatDate = (date: Date) => day.format(date);
