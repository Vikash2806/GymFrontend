export type MemberPaymentBlock = {
  planAmount: number;
  miscFeeAmount: number;
  personalTrainerFeeAmount: number;
  discountAmount: number;
  subtotalAmount: number;
  finalPayableAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: "paid" | "partial" | "pending";
  totalAmount?: number;
  pendingAmount?: number;
  amountReceived?: number;
};

export type SubscriptionPricing = {
  listPrice: number;
  amountReceived: number;
  varianceFromList: number;
  varianceKind: "discount" | "premium" | "none";
};

export type Member = {
  _id: string;
  gymId: string;
  branchId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  profile: {
    phone: string;
    gender: string;
    dob: string | null;
    profilePicture: string | null;
    /** CSV migration snapshot age (years); use `dob` for live age when set. */
    ageYears?: number | null;
    weightKg?: number | null;
  };
  address: {
    street: string;
    city: string;
    state: string;
    zipcode: string;
    country: string;
  };
  emergencyContacts: Array<{ name: string; phone: string; relation: string }>;
  status: string;
  currentSubscription: {
    subscriptionId: string;
    planId: string;
    planName: string;
    startDate: string;
    endDate: string;
    status: string;
    payment: MemberPaymentBlock;
    pricing?: SubscriptionPricing | null;
  } | null;
  financialSummary: {
    lifetime: { totalPaid: number; totalPending: number };
    subscriptions: { totalPaid: number; totalPending: number };
  };
  flags: { hasActiveSubscription: boolean; hasPendingPayment: boolean };
  paymentStatus: {
    status: "paid" | "partially_paid" | null;
    updatedAt: string;
  } | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type MemberFormValues = {
  branchId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  profilePicture?: unknown;
  gender: string;
  dob?: unknown;
  dateOfJoining: unknown;
  street?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  country?: string;
  planId?: string;
  miscFeesEnabled?: boolean;
  miscFeeAmount?: number;
  personalTrainerEnabled?: boolean;
  personalTrainerFeeAmount?: number;
  discountAmount?: number;
  paidAmount?: number;
  paymentMethod?: string;
  emergencyContacts?: Array<{ name?: string; phone?: string; relation?: string }>;
  notes?: string;
};
