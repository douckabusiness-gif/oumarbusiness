"use client";

import { ShieldCheck } from "lucide-react";
import {
  Field,
  SectionCard,
  SettingsPageShell,
  ToggleField
} from "@/components/settings/SettingsPagePrimitives";
import { useSettingsResource } from "@/components/settings/useSettingsResource";

type SecuritySettings = {
  twoFactor: {
    requiredForAdmins: boolean;
    requiredForOperators: boolean;
  };
  sessions: {
    sessionTimeoutMinutes: number;
    refreshTokenDays: number;
    allowMultipleSessions: boolean;
  };
  protection: {
    loginAttempts: number;
    lockoutMinutes: number;
    auditLogEnabled: boolean;
    ipAlertEnabled: boolean;
  };
};

const initialData: SecuritySettings = {
  twoFactor: {
    requiredForAdmins: true,
    requiredForOperators: false
  },
  sessions: {
    sessionTimeoutMinutes: 15,
    refreshTokenDays: 7,
    allowMultipleSessions: true
  },
  protection: {
    loginAttempts: 5,
    lockoutMinutes: 15,
    auditLogEnabled: true,
    ipAlertEnabled: true
  }
};

export default function SecuritySettingsPage() {
  const { data, setData, loading, saving, saved, error, save } = useSettingsResource<SecuritySettings>(
    "/api/settings/security",
    initialData
  );

  return (
    <SettingsPageShell
      eyebrow="Parametres securite"
      title="2FA, sessions et protection"
      loading={loading}
      saving={saving}
      saved={saved}
      error={error}
      onSave={() => void save()}
    >
      <div className="grid gap-5 xl:grid-cols-3">
        <SectionCard title="Double authentification" subtitle="Qui doit activer le 2FA dans l'equipe.">
          <div className="grid gap-3">
            <ToggleField
              label="2FA obligatoire pour admins"
              checked={data.twoFactor.requiredForAdmins}
              onChange={(checked) =>
                setData((current) => ({ ...current, twoFactor: { ...current.twoFactor, requiredForAdmins: checked } }))
              }
            />
            <ToggleField
              label="2FA obligatoire pour operateurs"
              checked={data.twoFactor.requiredForOperators}
              onChange={(checked) =>
                setData((current) => ({
                  ...current,
                  twoFactor: { ...current.twoFactor, requiredForOperators: checked }
                }))
              }
            />
          </div>
        </SectionCard>

        <SectionCard title="Sessions" subtitle="Controle des durees et connexions simultanees.">
          <div className="grid gap-4">
            <Field
              label="Timeout session (minutes)"
              type="number"
              value={data.sessions.sessionTimeoutMinutes}
              onChange={(value) =>
                setData((current) => ({
                  ...current,
                  sessions: { ...current.sessions, sessionTimeoutMinutes: Number(value) || 0 }
                }))
              }
            />
            <Field
              label="Refresh token (jours)"
              type="number"
              value={data.sessions.refreshTokenDays}
              onChange={(value) =>
                setData((current) => ({
                  ...current,
                  sessions: { ...current.sessions, refreshTokenDays: Number(value) || 0 }
                }))
              }
            />
            <ToggleField
              label="Autoriser plusieurs sessions"
              checked={data.sessions.allowMultipleSessions}
              onChange={(checked) =>
                setData((current) => ({
                  ...current,
                  sessions: { ...current.sessions, allowMultipleSessions: checked }
                }))
              }
            />
          </div>
        </SectionCard>

        <SectionCard title="Protection" subtitle="Verrouillage, audit et alertes de securite.">
          <div className="grid gap-4">
            <Field
              label="Tentatives de login"
              type="number"
              value={data.protection.loginAttempts}
              onChange={(value) =>
                setData((current) => ({
                  ...current,
                  protection: { ...current.protection, loginAttempts: Number(value) || 0 }
                }))
              }
            />
            <Field
              label="Blocage (minutes)"
              type="number"
              value={data.protection.lockoutMinutes}
              onChange={(value) =>
                setData((current) => ({
                  ...current,
                  protection: { ...current.protection, lockoutMinutes: Number(value) || 0 }
                }))
              }
            />
            <ToggleField
              label="Audit log actif"
              checked={data.protection.auditLogEnabled}
              onChange={(checked) =>
                setData((current) => ({
                  ...current,
                  protection: { ...current.protection, auditLogEnabled: checked }
                }))
              }
            />
            <ToggleField
              label="Alerte changement IP"
              checked={data.protection.ipAlertEnabled}
              onChange={(checked) =>
                setData((current) => ({
                  ...current,
                  protection: { ...current.protection, ipAlertEnabled: checked }
                }))
              }
            />
          </div>
          <div className="mt-5 rounded-lg border border-line bg-ink p-4 text-sm text-zinc-300">
            <p className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="h-4 w-4 text-gold" />
              Strategie appliquee
            </p>
            <p className="mt-2 text-muted">
              Verrouillage apres {data.protection.loginAttempts} tentative(s), expiration session a{" "}
              {data.sessions.sessionTimeoutMinutes} minutes.
            </p>
          </div>
        </SectionCard>
      </div>
    </SettingsPageShell>
  );
}
