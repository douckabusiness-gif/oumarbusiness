import { EmailVerificationPage } from "@/components/auth/EmailVerificationPage";

export default async function ClientVerifyEmailPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;

  return (
    <EmailVerificationPage
      audience="client"
      loginHref="/client/login"
      verifyEndpoint="/api/client-portal/verify-email"
      title="Confirmation de votre email"
      body="Nous validons maintenant votre acces client. Une fois confirme, vous pourrez vous connecter au portail."
      token={token}
    />
  );
}
