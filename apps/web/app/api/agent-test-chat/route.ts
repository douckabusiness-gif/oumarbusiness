import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Route de test desactivee en production." }, { status: 404 });
  }

  const body = await request.json();
  const apiUrl = process.env.API_URL ?? "http://localhost:4000";

  const response = await fetch(`${apiUrl}/api/agents/test-chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const payload = await response.json();

  return NextResponse.json(payload, { status: response.status });
}
