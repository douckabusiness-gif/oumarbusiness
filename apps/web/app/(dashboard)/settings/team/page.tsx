"use client";

import { Users } from "lucide-react";
import {
  Field,
  SectionCard,
  SelectField,
  SettingsPageShell,
  ToggleField
} from "@/components/settings/SettingsPagePrimitives";
import { useSettingsResource } from "@/components/settings/useSettingsResource";

type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLogin: string;
};

type TeamSettings = {
  inviteDefaults: {
    role: string;
    sendWelcomeEmail: boolean;
    notifyAdmin: boolean;
  };
  members: TeamMember[];
};

const roleOptions = [
  "SUPER_ADMIN",
  "ADMIN",
  "SUPERVISOR",
  "WHATSAPP_OPERATOR",
  "EMAIL_OPERATOR",
  "SALES_AGENT",
  "MARKETING_AGENT",
  "FREELANCER",
  "CLIENT"
];

const statusOptions = ["active", "suspended", "pending"];

const initialData: TeamSettings = {
  inviteDefaults: {
    role: "SALES_AGENT",
    sendWelcomeEmail: true,
    notifyAdmin: true
  },
  members: []
};

export default function TeamSettingsPage() {
  const { data, setData, loading, saving, saved, error, save } = useSettingsResource<TeamSettings>(
    "/api/settings/team",
    initialData
  );

  return (
    <SettingsPageShell
      eyebrow="Parametres equipe"
      title="Equipe, roles et invitations"
      loading={loading}
      saving={saving}
      saved={saved}
      error={error}
      onSave={() => void save()}
    >
      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title="Invitation par defaut" subtitle="Regles appliquees quand tu invites un nouveau membre.">
          <div className="grid gap-4">
            <SelectField
              label="Role par defaut"
              value={data.inviteDefaults.role}
              options={roleOptions}
              onChange={(value) =>
                setData((current) => ({ ...current, inviteDefaults: { ...current.inviteDefaults, role: value } }))
              }
            />
            <ToggleField
              label="Envoyer email de bienvenue"
              checked={data.inviteDefaults.sendWelcomeEmail}
              onChange={(checked) =>
                setData((current) => ({
                  ...current,
                  inviteDefaults: { ...current.inviteDefaults, sendWelcomeEmail: checked }
                }))
              }
            />
            <ToggleField
              label="Notifier le super admin"
              checked={data.inviteDefaults.notifyAdmin}
              onChange={(checked) =>
                setData((current) => ({
                  ...current,
                  inviteDefaults: { ...current.inviteDefaults, notifyAdmin: checked }
                }))
              }
            />
          </div>
        </SectionCard>

        <SectionCard title="Membres" subtitle="Roles, statut de compte et derniere connexion de chaque membre.">
          <div className="space-y-4">
            {data.members.map((member, index) => (
              <div key={member.id} className="rounded-lg border border-line bg-ink p-4">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <Field
                    label="Nom"
                    value={member.name}
                    onChange={(value) =>
                      setData((current) => ({
                        ...current,
                        members: current.members.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, name: value } : item
                        )
                      }))
                    }
                  />
                  <Field
                    label="Email"
                    value={member.email}
                    onChange={(value) =>
                      setData((current) => ({
                        ...current,
                        members: current.members.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, email: value } : item
                        )
                      }))
                    }
                  />
                  <SelectField
                    label="Role"
                    value={member.role}
                    options={roleOptions}
                    onChange={(value) =>
                      setData((current) => ({
                        ...current,
                        members: current.members.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, role: value } : item
                        )
                      }))
                    }
                  />
                  <SelectField
                    label="Statut"
                    value={member.status}
                    options={statusOptions}
                    onChange={(value) =>
                      setData((current) => ({
                        ...current,
                        members: current.members.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, status: value } : item
                        )
                      }))
                    }
                  />
                  <Field
                    label="Derniere connexion"
                    value={member.lastLogin}
                    onChange={(value) =>
                      setData((current) => ({
                        ...current,
                        members: current.members.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, lastLogin: value } : item
                        )
                      }))
                    }
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-lg border border-line bg-panel p-4 text-sm text-zinc-300">
            <p className="flex items-center gap-2 font-semibold">
              <Users className="h-4 w-4 text-gold" />
              Total membres
            </p>
            <p className="mt-2 text-muted">{data.members.length} compte(s) actuellement suivis dans l'equipe.</p>
          </div>
        </SectionCard>
      </div>
    </SettingsPageShell>
  );
}
