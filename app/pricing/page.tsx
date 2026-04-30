"use client";

import { App, Button, Card, Checkbox, Col, Form, Input, Modal, Row, Segmented, Space, Tag, Typography } from "antd";
import { CheckOutlined, ThunderboltFilled } from "@ant-design/icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import apiClient from "@/utils/api";
import type { GymPlanResponse, PricingPlan, PricingPlansResponse } from "@/types/pricing";

const { Title, Text } = Typography;

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (payload: unknown) => void) => void;
    };
  }
}

type BillingType = "monthly" | "yearly";

export default function PricingPage() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [submittingPlanId, setSubmittingPlanId] = useState<string | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan | null>(null);
  const [billingType, setBillingType] = useState<BillingType>("yearly");
  const [enableAutopay, setEnableAutopay] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [currentPlanName, setCurrentPlanName] = useState<string>("free");
  const [currentDurationType, setCurrentDurationType] = useState<BillingType | null>(null);
  const [currentBillingStart, setCurrentBillingStart] = useState<string | null>(null);
  const [billingEnd, setBillingEnd] = useState<string | null>(null);
  const [form] = Form.useForm<{ customerName: string; customerEmail: string; customerContact: string }>();

  const refreshPricingData = useCallback(
    async (showLoad = true) => {
      if (showLoad) {
        setLoading(true);
      }
      try {
        const [{ data: plansData }, { data: gymPlanData }] = await Promise.all([
          apiClient.get<PricingPlansResponse>("/gym/pricing-plans/current"),
          apiClient.get<GymPlanResponse>("/gym/pricing-plans/current-gym-plan")
        ]);
        if (plansData.success && Array.isArray(plansData.plans)) {
          setPlans(plansData.plans);
        }
        if (gymPlanData.success) {
          setCurrentPlanName((gymPlanData.gymSubscription?.planName ?? "free").toLowerCase());
          setCurrentDurationType(
            gymPlanData.gymSubscription?.durationType === "monthly" || gymPlanData.gymSubscription?.durationType === "yearly"
              ? gymPlanData.gymSubscription.durationType
              : null
          );
          setCurrentBillingStart(gymPlanData.gymSubscription?.billingStart ?? gymPlanData.gymSubscription?.startDate ?? null);
          setBillingEnd(gymPlanData.gymSubscription?.billingEnd ?? gymPlanData.gymSubscription?.endDate ?? null);
        }
      } catch {
        message.error("Could not load pricing plans.");
      } finally {
        if (showLoad) {
          setLoading(false);
        }
      }
    },
    [message]
  );

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  useEffect(() => {
    void refreshPricingData(true);
  }, [refreshPricingData]);

  const paidPlans = useMemo(() => plans.filter((plan) => plan.id !== "free"), [plans]);
  const planById = useMemo(() => new Map(plans.map((plan) => [plan.id.toLowerCase(), plan])), [plans]);
  const getChargeAmount = (plan: PricingPlan, type: BillingType): number =>
    type === "yearly" ? Number(plan.yearlyPrice ?? 0) * 12 : Number(plan.monthlyPrice ?? 0);
  const currentPlan = useMemo(() => planById.get(currentPlanName.toLowerCase()) ?? null, [planById, currentPlanName]);
  const currentCycleCharge = useMemo(() => {
    if (!currentPlan || !currentDurationType) {
      return 0;
    }
    return getChargeAmount(currentPlan, currentDurationType);
  }, [currentPlan, currentDurationType]);
  const remainingCredit = useMemo(() => {
    if (!currentBillingStart || !billingEnd || currentCycleCharge <= 0) {
      return 0;
    }
    const now = dayjs();
    const start = dayjs(currentBillingStart);
    const end = dayjs(billingEnd);
    if (!start.isValid() || !end.isValid() || !end.isAfter(start) || !end.isAfter(now)) {
      return 0;
    }
    const totalMs = end.valueOf() - start.valueOf();
    const leftMs = end.valueOf() - now.valueOf();
    const ratio = Math.max(0, Math.min(1, leftMs / totalMs));
    return Math.round(currentCycleCharge * ratio);
  }, [currentBillingStart, billingEnd, currentCycleCharge]);
  const invoiceSummary = useMemo(() => {
    if (!selectedPlan) {
      return {
        originalAmount: 0,
        discountAmount: 0,
        billedAmount: 0,
        billingLabel: "monthly",
        remainingCreditApplied: 0
      };
    }
    const monthly = Number(selectedPlan.monthlyPrice ?? 0);
    const yearly = Number(selectedPlan.yearlyPrice ?? 0);
    if (billingType === "yearly") {
      const originalAmount = monthly > 0 ? monthly * 12 : 0;
      const billedAmountBeforeCredit = yearly > 0 ? yearly * 12 : 0;
      const remainingCreditApplied = Math.min(remainingCredit, billedAmountBeforeCredit);
      const billedAmount = Math.max(0, billedAmountBeforeCredit - remainingCreditApplied);
      const discountAmount = Math.max(0, originalAmount - billedAmountBeforeCredit);
      return {
        originalAmount,
        discountAmount,
        billedAmount,
        billingLabel: "yearly",
        remainingCreditApplied
      };
    }
    const billedAmountBeforeCredit = monthly;
    const remainingCreditApplied = Math.min(remainingCredit, billedAmountBeforeCredit);
    return {
      originalAmount: monthly,
      discountAmount: 0,
      billedAmount: Math.max(0, billedAmountBeforeCredit - remainingCreditApplied),
      billingLabel: "monthly",
      remainingCreditApplied
    };
  }, [selectedPlan, billingType, remainingCredit]);

  const openPlanPaymentModal = (plan: PricingPlan) => {
    setSelectedPlan(plan);
    setEnableAutopay(false);
    setPaymentModalOpen(true);
  };

  const closePlanPaymentModal = () => {
    setPaymentModalOpen(false);
    setSelectedPlan(null);
    setEnableAutopay(false);
    setPaymentLoading(false);
  };

  const checkout = async (plan: PricingPlan, amountOverride?: number) => {
    const amount = typeof amountOverride === "number" ? amountOverride : getChargeAmount(plan, billingType);
    if (!amount || amount <= 0) {
      message.info("Please contact sales for this plan.");
      return;
    }
    if (!window.Razorpay) {
      message.error("Razorpay SDK not loaded.");
      return;
    }
    setSubmittingPlanId(plan.id);
    try {
      const orderRes = await apiClient.post<{
        success: boolean;
        order?: { id: string; amount: number; currency: string; key_id: string };
        message?: string;
      }>("/gym/payments/create", {
        amount,
        currency: "INR",
        planId: plan.id,
        planName: plan.name,
        planType: billingType,
        versionNumber: 1,
        originalAmount: invoiceSummary.originalAmount,
        discountAmount: invoiceSummary.discountAmount,
        billedAmount: invoiceSummary.billedAmount,
        creditApplied: invoiceSummary.remainingCreditApplied
      });
      if (!orderRes.data.success || !orderRes.data.order) {
        message.error(orderRes.data.message ?? "Could not create payment order.");
        return;
      }
      const order = orderRes.data.order;
      const razorpay = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: "Gym Subscription",
        description: `${plan.name} (${billingType})`,
        order_id: order.id,
        method: {
          upi: true,
          card: true,
          netbanking: true,
          wallet: true
        },
        upi: {
          flow: "collect"
        },
        handler: async (response: Record<string, unknown>) => {
          const verify = await apiClient.post<{ success: boolean; message?: string }>("/gym/payments/verify", {
            planId: plan.id,
            planName: plan.name,
            planType: billingType,
            versionNumber: 1,
            originalAmount: invoiceSummary.originalAmount,
            discountAmount: invoiceSummary.discountAmount,
            billedAmount: invoiceSummary.billedAmount,
            creditApplied: invoiceSummary.remainingCreditApplied,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature
          });
          if (verify.data.success) {
            message.success("Plan upgraded successfully.");
            setCurrentPlanName(plan.id.toLowerCase());
            const nextEnd = dayjs().add(1, billingType === "yearly" ? "year" : "month");
            setBillingEnd(nextEnd.toISOString());
            void refreshPricingData(false);
            return;
          }
          message.error(verify.data.message ?? "Payment verification failed.");
        },
        theme: { color: "#7d6bff" }
      });
      razorpay.on("payment.failed", (response: unknown) => {
        const description =
          typeof response === "object" &&
          response !== null &&
          "error" in response &&
          typeof (response as { error?: { description?: unknown } }).error?.description === "string"
            ? ((response as { error: { description: string } }).error.description)
            : "Unknown error";
        message.error(`Payment failed: ${description}`);
      });
      razorpay.open();
    } catch (error) {
      message.error(
        typeof error === "object" &&
          error !== null &&
          "response" in error &&
          typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
          ? (error as { response?: { data?: { message?: string } } }).response!.data!.message!
          : "Could not start checkout."
      );
    } finally {
      setSubmittingPlanId(null);
    }
  };

  const startAutopayCheckout = async (
    plan: PricingPlan,
    values: { customerName: string; customerEmail: string; customerContact: string }
  ) => {
    const subscriptionRes = await apiClient.post<{
      success: boolean;
      subscription?: { id: string; key_id: string };
      message?: string;
    }>("/gym/payments/create-autopay-subscription", {
      planId: plan.id,
      planType: billingType,
      originalAmount: invoiceSummary.originalAmount,
      discountAmount: invoiceSummary.discountAmount,
      billedAmount: invoiceSummary.billedAmount,
      creditApplied: invoiceSummary.remainingCreditApplied,
      customerDetails: {
        name: values.customerName,
        email: values.customerEmail,
        contact: values.customerContact
      }
    });
    if (!subscriptionRes.data.success || !subscriptionRes.data.subscription?.id || !subscriptionRes.data.subscription?.key_id) {
      throw new Error(subscriptionRes.data.message ?? "Could not create autopay subscription.");
    }
    if (!window.Razorpay) {
      throw new Error("Razorpay SDK not loaded.");
    }
    const subscription = subscriptionRes.data.subscription;
    const rzp = new window.Razorpay({
      key: subscription.key_id,
      subscription_id: subscription.id,
      recurring: true,
      name: "Gym Subscription",
      description: `${plan.name} (${billingType})`,
      method: {
        upi: true,
        card: true,
        netbanking: true
      },
      upi: {
        flow: "intent"
      },
      customer: {
        name: values.customerName,
        email: values.customerEmail,
        contact: values.customerContact
      },
      prefill: {
        name: values.customerName,
        email: values.customerEmail,
        contact: values.customerContact
      },
      handler: () => {
        message.success("Mandate authentication completed. Waiting for subscription activation.");
        setPaymentLoading(false);
        setSubmittingPlanId(null);
        void refreshPricingData(false);
        globalThis.setTimeout(() => {
          void refreshPricingData(false);
        }, 3000);
      },
      modal: {
        ondismiss: () => {
          setPaymentLoading(false);
          setSubmittingPlanId(null);
        }
      },
      theme: {
        color: "#7d6bff"
      }
    });
    rzp.on("payment.failed", (response: unknown) => {
      const description =
        typeof response === "object" &&
        response !== null &&
        "error" in response &&
        typeof (response as { error?: { description?: unknown } }).error?.description === "string"
          ? ((response as { error: { description: string } }).error.description)
          : "Unknown error";
      message.error(`Payment failed: ${description}`);
      setPaymentLoading(false);
      setSubmittingPlanId(null);
    });
    rzp.open();
  };

  const proceedFromPaymentModal = async () => {
    if (!selectedPlan) {
      return;
    }
    const plan = selectedPlan;
    if (invoiceSummary.billedAmount <= 0) {
      message.info("Please contact sales for this plan.");
      return;
    }
    try {
      setPaymentLoading(true);
      setSubmittingPlanId(plan.id);
      let customerValues: { customerName: string; customerEmail: string; customerContact: string } | null = null;
      if (enableAutopay) {
        await form.validateFields(["customerName", "customerEmail", "customerContact"]);
        customerValues = form.getFieldsValue();
      }
      closePlanPaymentModal();
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (enableAutopay) {
        await startAutopayCheckout(plan, customerValues as { customerName: string; customerEmail: string; customerContact: string });
      } else {
        await checkout(plan, invoiceSummary.billedAmount);
      }
    } catch (error) {
      message.error(
        typeof error === "object" &&
          error !== null &&
          "message" in error &&
          typeof (error as { message?: unknown }).message === "string"
          ? (error as { message: string }).message
          : "Failed to initiate payment."
      );
      setPaymentLoading(false);
      setSubmittingPlanId(null);
    }
  };

  return (
    <div
      style={{
        padding: "36px 24px",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(circle at 78% 18%, rgba(129, 92, 255, 0.22), transparent 36%), radial-gradient(circle at 22% 12%, rgba(22, 119, 255, 0.18), transparent 34%), linear-gradient(180deg, #070b16 0%, #05070f 100%)"
      }}
    >
      <Space direction="vertical" size={24} style={{ width: "100%", maxWidth: 1140, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 2 }}>
          <Tag color="blue" style={{ marginBottom: 12, borderRadius: 999, paddingInline: 10 }}>
            Pricing
          </Tag>
          <Title level={1} style={{ margin: 0, color: "#f5f7ff", fontSize: "clamp(34px, 4vw, 52px)", lineHeight: 1.08 }}>
            Invest in Growth, Not <span style={{ color: "#6d8dff" }}>Overhead</span>
          </Title>
          <Text style={{ fontSize: 17, color: "rgba(226,231,255,0.72)" }}>
            FitForge pays for itself. Most gyms recover the cost within the first month.
          </Text>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            padding: 2
          }}
        >
          <Space direction="vertical" size={6} style={{ alignItems: "center" }}>
            <Segmented
              value={billingType}
              onChange={(value) => setBillingType(value as BillingType)}
              options={[
                { label: "Monthly", value: "monthly" },
                { label: "Yearly (Save 30%)", value: "yearly" }
              ]}
              style={{
                background: "rgba(98, 110, 162, 0.35)",
                borderRadius: 10
              }}
            />
            <Text style={{ fontSize: 12, color: "rgba(201, 212, 255, 0.62)", textAlign: "center" }}>
              Current plan: {currentPlanName.toUpperCase()}
              {currentDurationType ? ` (${currentDurationType})` : ""}
              {billingEnd ? ` • Valid till ${dayjs(billingEnd).format("DD-MM-YYYY")}` : ""}
            </Text>
          </Space>
        </div>

        <Row gutter={[16, 16]}>
          {paidPlans.map((plan) => {
            const amount = billingType === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
            const targetCharge = getChargeAmount(plan, billingType);
            const isCurrent =
              plan.id.toLowerCase() === currentPlanName.toLowerCase() &&
              currentDurationType === billingType;
            const isDowngrade = currentCycleCharge > 0 && targetCharge < currentCycleCharge;
            const isContactSales = !amount || amount <= 0 || isDowngrade;
            const periodLabel = billingType === "yearly" ? "yearly" : "monthly";
            const hasAmount = Boolean(amount && amount > 0);
            return (
              <Col xs={24} md={12} lg={8} key={plan.id}>
                <Card
                  loading={loading}
                  hoverable
                  style={{
                    borderRadius: 16,
                    minHeight: 450,
                    borderColor: plan.popular ? "rgba(151, 125, 255, 0.6)" : "rgba(122, 137, 182, 0.28)",
                    boxShadow: plan.popular
                      ? "0 0 0 1px rgba(151,125,255,0.45), 0 20px 45px rgba(82, 56, 188, 0.32)"
                      : "0 12px 30px rgba(0, 0, 0, 0.28)",
                    background: "rgba(10, 16, 32, 0.78)",
                    backdropFilter: "blur(8px)"
                  }}
                  styles={{ body: { color: "#dfe7ff" } }}
                  title={
                    <Space size={8}>
                      <span style={{ fontWeight: 700, color: "#f3f6ff" }}>{plan.name}</span>
                      {plan.popular ? (
                        <Tag color="blue" style={{ borderRadius: 999 }}>
                          <Space size={4}>
                            <ThunderboltFilled />
                            Most Popular
                          </Space>
                        </Tag>
                      ) : null}
                      {isCurrent ? <Tag color="green">Current</Tag> : null}
                    </Space>
                  }
                >
                  <Text style={{ color: "rgba(210, 220, 252, 0.68)" }}>{plan.description}</Text>
                  <div style={{ marginTop: 16, marginBottom: 16 }}>
                    <Title level={3} style={{ margin: 0, lineHeight: 1.1, color: "#f8faff" }}>
                      {hasAmount ? `₹${Number(amount).toLocaleString("en-IN")}` : "Custom"}
                    </Title>
                    <Text style={{ color: "rgba(199, 210, 246, 0.72)" }}>/month</Text>
                  </div>

                  <ul style={{ paddingLeft: 0, marginBottom: 18, listStyle: "none", minHeight: 170 }}>
                    {plan.features.slice(0, 5).map((feature) => (
                      <li key={feature} style={{ marginBottom: 10, display: "flex", alignItems: "flex-start", gap: 8 }}>
                        <CheckOutlined style={{ color: "#27d8a3", marginTop: 2, fontSize: 12 }} />
                        <Text style={{ color: "rgba(228, 235, 255, 0.85)" }}>{feature}</Text>
                      </li>
                    ))}
                  </ul>
                  <Button
                    block
                    type={isCurrent ? "default" : "primary"}
                    disabled={isCurrent}
                    loading={submittingPlanId === plan.id}
                    onClick={() => {
                      if (isContactSales) {
                        window.location.href = "http://localhost:3000/#";
                        return;
                      }
                      openPlanPaymentModal(plan);
                    }}
                    style={
                      isCurrent
                        ? {
                            borderColor: "rgba(127, 146, 205, 0.4)",
                            color: "#dce6ff",
                            background: "rgba(131, 149, 204, 0.12)"
                          }
                        : {
                            border: "none",
                            color: "#fff",
                            background: "linear-gradient(90deg, #6f54ff 0%, #7d6bff 100%)",
                            boxShadow: "0 10px 22px rgba(98, 72, 214, 0.35)"
                          }
                    }
                  >
                    {isCurrent ? "Current plan" : isContactSales ? "Contact sales" : `Upgrade (${periodLabel})`}
                  </Button>
                </Card>
              </Col>
            );
          })}
        </Row>
      </Space>
      <Modal
        title="Complete Payment"
        open={paymentModalOpen}
        onCancel={closePlanPaymentModal}
        footer={null}
        width={560}
      >
        {selectedPlan ? (
          <Space direction="vertical" size={14} style={{ width: "100%" }}>
            <div>
              <Text type="secondary">Plan</Text>
              <Title level={5} style={{ margin: "4px 0 0" }}>
                {selectedPlan.name} ({billingType})
              </Title>
            </div>
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: 12,
                background: "#fafafa"
              }}
            >
              <Text strong style={{ display: "block", marginBottom: 8 }}>
                Amount Summary (Invoice)
              </Text>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <Text type="secondary">Original Amount</Text>
                <Text>₹{invoiceSummary.originalAmount.toLocaleString("en-IN")}</Text>
              </div>
              {invoiceSummary.discountAmount > 0 ? (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text type="secondary">Discount</Text>
                  <Text style={{ color: "#16a34a" }}>
                    -₹{invoiceSummary.discountAmount.toLocaleString("en-IN")}
                  </Text>
                </div>
              ) : null}
              {invoiceSummary.remainingCreditApplied > 0 ? (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text type="secondary">Unused previous plan credit</Text>
                  <Text style={{ color: "#16a34a" }}>
                    -₹{invoiceSummary.remainingCreditApplied.toLocaleString("en-IN")}
                  </Text>
                </div>
              ) : null}
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid #e5e7eb" }}>
                <Text strong>Final Amount ({invoiceSummary.billingLabel})</Text>
                <Text strong style={{ fontSize: 16 }}>
                  ₹{invoiceSummary.billedAmount.toLocaleString("en-IN")}
                </Text>
              </div>
            </div>
            <div>
              <Text type="secondary">Plan offers</Text>
              <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                {selectedPlan.features.map((feature) => (
                  <li key={feature} style={{ marginBottom: 4 }}>
                    <Text>{feature}</Text>
                  </li>
                ))}
              </ul>
            </div>
            <Checkbox checked={enableAutopay} onChange={(event) => setEnableAutopay(event.target.checked)}>
              <Text strong>Enable Auto-Pay (Recurring Subscription)</Text>
            </Checkbox>
            {enableAutopay ? (
              <Form
                form={form}
                layout="vertical"
                initialValues={{ customerName: "", customerEmail: "", customerContact: "" }}
              >
                <Form.Item
                  name="customerName"
                  label="Full Name"
                  rules={[{ required: true, message: "Please enter your full name" }]}
                >
                  <Input placeholder="Enter your full name" />
                </Form.Item>
                <Form.Item
                  name="customerEmail"
                  label="Email"
                  rules={[
                    { required: true, message: "Please enter your email" },
                    { type: "email", message: "Please enter a valid email" }
                  ]}
                >
                  <Input placeholder="Enter your email" />
                </Form.Item>
                <Form.Item
                  name="customerContact"
                  label="Phone Number"
                  rules={[
                    { required: true, message: "Please enter your phone number" },
                    { pattern: /^[0-9]{10}$/, message: "Please enter a valid 10-digit phone number" }
                  ]}
                >
                  <Input placeholder="Enter your 10-digit number" maxLength={10} />
                </Form.Item>
              </Form>
            ) : null}
            <Button
              type="primary"
              block
              loading={paymentLoading || submittingPlanId === selectedPlan.id}
              onClick={() => void proceedFromPaymentModal()}
            >
              {enableAutopay ? "Enable Auto-Pay" : "Proceed to Payment"}
            </Button>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {enableAutopay
                ? "Your subscription will be set up for automatic recurring payments."
                : "You will be redirected to Razorpay secure payment gateway."}
            </Text>
          </Space>
        ) : null}
      </Modal>
    </div>
  );
}
