import { EmailVerificationPage } from "@/components/auth/EmailVerificationPage";

export default async function UserVerifyEmailPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;

  return (
    <EmailVerificationPage
      audience="user"
      loginHref="/user/login"
      verifyEndpoint="/api/sourcing/auth/verify-email"
      title="Confirmation de ton email"
      body="Nous validons maintenant ton acces sourcing. Une fois confirme, tu pourras te connecter a ton espace."
      token={token}
    />
  );
}
