export const URDU_SCENARIOS = [
  {
    id: "urdu-mixed-notice",
    message: "سندھ ریلیف اتھارٹی نے PKR 25,000 امداد کی اطلاع دی۔ حوالہ PAY-UR-01 ہے۔",
    expected: { classification: "CLARIFICATION", route: "INFORMATION_ONLY", issuer: "سندھ ریلیف اتھارٹی", amount: 2_500_000, reference: "PAY-UR-01" },
  },
  {
    id: "urdu-native-digit-amount",
    message: "سندھ امدادی ادارہ نے ۲۵,۰۰۰ روپے بھیجے، حوالہ PAY-UR-06 ہے۔",
    expected: { classification: "CLARIFICATION", route: "INFORMATION_ONLY", issuer: "سندھ امدادی ادارہ", amount: 2_500_000, reference: "PAY-UR-06" },
  },
  {
    id: "urdu-missing-details",
    message: "مجھے امداد کی رقم اور payment reference معلوم نہیں۔",
    expected: { classification: "UNKNOWN", route: "ASK_FOR_EVIDENCE", issuer: null, amount: null, reference: null },
  },
  {
    id: "urdu-suspected-fraud",
    message: "آپ کی امداد روک دی گئی ہے۔ رقم حاصل کرنے کے لیے PKR 500 بھیجیں، ورنہ ادائیگی منسوخ ہوگی۔",
    expected: { classification: "SUSPICIOUS_MESSAGE", route: "OFFICER_REVIEW", issuer: null, amount: 50_000, reference: null },
  },
  {
    id: "urdu-payment-dispute",
    message: "مجھے PAY-UR-04 کے تحت PKR 25,000 کی ادائیگی نہیں ملی۔",
    expected: { classification: "PAYMENT_DISPUTE", route: "OFFICER_REVIEW", issuer: null, amount: 2_500_000, reference: "PAY-UR-04" },
  },
  {
    id: "urdu-contradictory-amounts",
    message: "یہ پیغام کہتا ہے PKR 25,000 PAY-UR-05 ہے لیکن دوسری جگہ اسی حوالہ کے لیے PKR 90,000 لکھا ہے۔",
    expected: { classification: "UNKNOWN", route: "OFFICER_REVIEW", issuer: null, amount: null, reference: "PAY-UR-05" },
  },
] as const;
