import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const vehicleId = formData.get("vehicleId") as string | null;

  if (!file || !vehicleId) {
    return NextResponse.json(
      { error: "Fichier et vehicleId requis" },
      { status: 400 },
    );
  }

  // Generate unique path: {vehicleId}/{uuid}.{ext}
  const ext = file.name.split(".").pop() ?? "pdf";
  const path = `${vehicleId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("vehicle-documents")
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("vehicle-documents").getPublicUrl(path);

  return NextResponse.json({ url: publicUrl });
}
