interface PriceInput {
  isStudent: boolean;
  referralDiscount: number; // percent
  gameDiscount: number; // percent
}

interface PriceResult {
  basePrice: number;
  discountAmount: number;
  finalAmount: number;
  studentDiscountApplied: boolean;
  discountBreakdown: {
    student: number;
    referral: number;
    game: number;
    totalPercent: number;
  };
}

const MAX_DISCOUNT_PERCENT = 15;
const STUDENT_DISCOUNT_PERCENT = 10;

export function calculatePrice(basePrice: number, input: PriceInput): PriceResult {
  let totalPercent = 0;
  const breakdown = { student: 0, referral: 0, game: 0, totalPercent: 0 };

  // Game discount first
  if (input.gameDiscount > 0) {
    breakdown.game = input.gameDiscount;
    totalPercent += input.gameDiscount;
  }

  // Student discount
  let studentApplied = false;
  if (input.isStudent) {
    const studentPercent = Math.min(STUDENT_DISCOUNT_PERCENT, MAX_DISCOUNT_PERCENT - totalPercent);
    if (studentPercent > 0) {
      breakdown.student = studentPercent;
      totalPercent += studentPercent;
      studentApplied = true;
    }
  }

  // Referral discount
  if (input.referralDiscount > 0) {
    const referralPercent = Math.min(input.referralDiscount, MAX_DISCOUNT_PERCENT - totalPercent);
    if (referralPercent > 0) {
      breakdown.referral = referralPercent;
      totalPercent += referralPercent;
    }
  }

  // The MAX_DISCOUNT_PERCENT cap applies to student+referral stacking on top of game discount.
  // Game discount itself is not subject to the cap — only the student+referral portion fills
  // up to 15% of the remaining room after game discount. So no additional global cap needed.
  breakdown.totalPercent = totalPercent;

  const discountAmount = Math.round((basePrice * totalPercent) / 100 * 100) / 100;
  const finalAmount = Math.round((basePrice - discountAmount) * 100) / 100;

  return {
    basePrice,
    discountAmount,
    finalAmount,
    studentDiscountApplied: studentApplied,
    discountBreakdown: breakdown,
  };
}
