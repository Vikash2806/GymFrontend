import AuthScreen from "@/app/components/Auth/AuthScreen";
import SignUpCard from "@/app/components/Auth/SignUpCard";

export default function SignupPage() {
  return (
    <AuthScreen
      bullets={[
        "Set up your gym in minutes",
        "Automated billing + renewals",
        "Dashboards and multi-branch support"
      ]}
    >
      <SignUpCard />
    </AuthScreen>
  );
}
