import { describe, it, expect } from "vitest";
import { calculatePrice } from "../src/services/pricing.service.js";

describe("calculatePrice", () => {
  it("returns base price with no discounts", () => {
    const result = calculatePrice(500, { isStudent: false, referralDiscount: 0, gameDiscount: 0 });
    expect(result.finalAmount).toBe(500);
    expect(result.discountAmount).toBe(0);
  });

  it("applies student discount", () => {
    const result = calculatePrice(500, { isStudent: true, referralDiscount: 0, gameDiscount: 0 });
    expect(result.finalAmount).toBe(450);
    expect(result.studentDiscountApplied).toBe(true);
  });

  it("applies referral discount", () => {
    const result = calculatePrice(500, { isStudent: false, referralDiscount: 5, gameDiscount: 0 });
    expect(result.finalAmount).toBe(475);
  });

  it("stacks student + referral (max 15%)", () => {
    const result = calculatePrice(500, { isStudent: true, referralDiscount: 5, gameDiscount: 0 });
    expect(result.finalAmount).toBe(425);
    expect(result.discountAmount).toBe(75);
  });

  it("caps total discount at 15%", () => {
    const result = calculatePrice(500, { isStudent: true, referralDiscount: 5, gameDiscount: 10 });
    expect(result.finalAmount).toBe(425); // 15% max
  });

  it("applies game discount alone", () => {
    const result = calculatePrice(300, { isStudent: false, referralDiscount: 0, gameDiscount: 20 });
    expect(result.finalAmount).toBe(240);
  });
});
