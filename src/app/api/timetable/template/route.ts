import { NextResponse } from "next/server";
import { generateTemplateBuffer } from "@/lib/timetable/excel";

export async function GET() {
  try {
    const buffer = generateTemplateBuffer();

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="vidya_vahini_timetable_template.xlsx"',
      },
    });
  } catch (error) {
    console.error("Error generating template:", error);
    return NextResponse.json({ error: "Failed to generate template" }, { status: 500 });
  }
}
