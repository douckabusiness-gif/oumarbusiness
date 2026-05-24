export type BillingSettings = {
  methods: {
    stripeEnabled: boolean;
    paypalEnabled: boolean;
    waveEnabled: boolean;
    orangeMoneyEnabled: boolean;
    bankTransferEnabled: boolean;
  };
  accounts: {
    stripePublicLabel: string;
    paypalHandle: string;
    waveNumber: string;
    orangeMoneyNumber: string;
    bankName: string;
    iban: string;
    swift: string;
  };
  invoicing: {
    invoicePrefix: string;
    defaultCurrency: string;
    defaultDueDays: number;
    depositPercent: number;
    lateReminderDays: string;
  };
};

export const initialBillingSettings: BillingSettings = {
  methods: {
    stripeEnabled: false,
    paypalEnabled: false,
    waveEnabled: false,
    orangeMoneyEnabled: false,
    bankTransferEnabled: true
  },
  accounts: {
    stripePublicLabel: "",
    paypalHandle: "",
    waveNumber: "",
    orangeMoneyNumber: "",
    bankName: "",
    iban: "",
    swift: ""
  },
  invoicing: {
    invoicePrefix: "OB",
    defaultCurrency: "XOF",
    defaultDueDays: 7,
    depositPercent: 60,
    lateReminderDays: "7,14,30"
  }
};
