import type { Metadata } from "next";
import AuthForm from "@/components/auth-form";

export const metadata: Metadata = {
  title: "Sign In · Arcade Vault",
};

export default function LoginPage() {
  return <AuthForm />;
}
