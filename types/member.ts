export type MemberPaymentBlock = {
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  status: "paid" | "partial" | "pending";
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
  } | null;
  financialSummary: {
    lifetime: { totalPaid: number; totalPending: number };
    subscriptions: { totalPaid: number; totalPending: number };
  };
  flags: { hasActiveSubscription: boolean; hasPendingPayment: boolean };
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
  paidAmount?: number;
  paymentMethod?: string;
  emergencyContacts?: Array<{ name?: string; phone?: string; relation?: string }>;
  notes?: string;
};
