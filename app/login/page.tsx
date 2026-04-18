import AuthScreen from "@/app/components/Auth/AuthScreen";
import SignInCard from "@/app/components/Auth/SignInCard";

export default function LoginPage() {
  return (
    <AuthScreen
      bullets={[
        "Glass-dark UI, built for focus",
        "Faster renewals with automation",
        "Real-time insights across branches"
      ]}
    >
      <SignInCard />
    </AuthScreen>
  );
}
