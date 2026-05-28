import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import sharp from "sharp";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Chave da API OpenAI nao configurada." },
        { status: 500 }
      );
    }

    const { image } = await request.json();

    if (!image || typeof image !== "string") {
      return NextResponse.json(
        { error: "Imagem nao fornecida." },
        { status: 400 }
      );
    }

    const base64Match = image.match(
      /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/
    );
    if (!base64Match) {
      return NextResponse.json(
        { error: "Formato de imagem invalido." },
        { status: 400 }
      );
    }

    const imageBuffer = Buffer.from(base64Match[2], "base64");

    if (imageBuffer.length > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Imagem muito grande. Maximo 10MB." },
        { status: 400 }
      );
    }

    const sharpImage = sharp(imageBuffer);
    const metadata = await sharpImage.metadata();
    const imgWidth = metadata.width!;
    const imgHeight = metadata.height!;

    const pngBuffer = await sharpImage.png().toBuffer();

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const visionResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Look at this photo of a person smiling. Identify the bounding box of ONLY the visible teeth (the area between the lips where teeth are showing).

Return ONLY a JSON object with percentage values (0-100):
{"x": left_percent, "y": top_percent, "width": width_percent, "height": height_percent}

The box should tightly cover just the teeth area with about 3% padding. Return ONLY valid JSON, nothing else.`,
            },
            {
              type: "image_url",
              image_url: { url: image, detail: "high" },
            },
          ],
        },
      ],
      max_tokens: 100,
    });

    const bboxText =
      visionResponse.choices[0]?.message?.content?.trim() || "";
    let bbox: { x: number; y: number; width: number; height: number };

    try {
      const jsonStr = bboxText
        .replace(/```json?\n?/g, "")
        .replace(/```/g, "")
        .trim();
      bbox = JSON.parse(jsonStr);
      if (
        bbox.x < 0 || bbox.y < 0 || bbox.width <= 0 || bbox.height <= 0 ||
        bbox.x + bbox.width > 100 || bbox.y + bbox.height > 100
      ) {
        throw new Error("Invalid bbox values");
      }
    } catch {
      bbox = { x: 30, y: 58, width: 40, height: 18 };
    }

    console.log("Detected teeth bbox:", bbox);

    const maskX = Math.round((bbox.x / 100) * imgWidth);
    const maskY = Math.round((bbox.y / 100) * imgHeight);
    const maskW = Math.round((bbox.width / 100) * imgWidth);
    const maskH = Math.round((bbox.height / 100) * imgHeight);

    const cx = maskX + maskW / 2;
    const cy = maskY + maskH / 2;
    const rx = maskW / 2;
    const ry = maskH / 2;

    const maskSvg = `<svg width="${imgWidth}" height="${imgHeight}">
      <rect width="${imgWidth}" height="${imgHeight}" fill="black"/>
      <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="white"/>
    </svg>`;

    const ellipseGray = await sharp(Buffer.from(maskSvg))
      .resize(imgWidth, imgHeight)
      .grayscale()
      .raw()
      .toBuffer();

    const maskPixels = Buffer.alloc(imgWidth * imgHeight * 4);
    for (let i = 0; i < imgWidth * imgHeight; i++) {
      const gray = ellipseGray[i];
      if (gray > 128) {
        maskPixels[i * 4] = 0;
        maskPixels[i * 4 + 1] = 0;
        maskPixels[i * 4 + 2] = 0;
        maskPixels[i * 4 + 3] = 0;
      } else {
        maskPixels[i * 4] = 0;
        maskPixels[i * 4 + 1] = 0;
        maskPixels[i * 4 + 2] = 0;
        maskPixels[i * 4 + 3] = 255;
      }
    }

    const maskPng = await sharp(maskPixels, {
      raw: { width: imgWidth, height: imgHeight, channels: 4 },
    })
      .png()
      .toBuffer();

    const imageFile = new File([new Uint8Array(pngBuffer)], "smile.png", {
      type: "image/png",
    });
    const maskFile = new File([new Uint8Array(maskPng)], "mask.png", {
      type: "image/png",
    });

    const response = await openai.images.edit({
      model: "gpt-image-1",
      image: imageFile,
      mask: maskFile,
      prompt: `Looking at the transparent area only: redraw the teeth so they are aligned in a natural arch with beautiful proportions, as after orthodontic treatment.

KEY CHARACTERISTICS OF NATURAL TEETH:
- Tooth shape is NOT square or blocky - teeth have rounded edges and subtle natural contours
- Each tooth has individual character with slight variations in shape and size
- Incisors taper slightly from base to edge with soft, rounded corners
- Midline diastema (space between central incisors) visible naturally
- Subtle shadows between teeth show natural depth and 3D form
- Teeth roots visible subtly at gum line, creating visual anchor
- Natural texture with light reflection - not flat or uniform

ABSOLUTE RULES - DO NOT VIOLATE:
- The opaque masked area must remain pixel-perfect identical
- Same tooth color - do not whiten or brighten
- Same tooth size and proportions as original
- Same gum line
- Same lips shape and color
- Avoid any artificial, geometric, or blocky appearance
- Blend seamlessly into the surrounding unchanged area`,
      size: "auto",
    });

    if (!response.data?.[0]?.b64_json) {
      return NextResponse.json(
        { error: "Falha ao gerar a simulacao. Tente novamente." },
        { status: 500 }
      );
    }

    const resultBase64 = response.data[0].b64_json;
    const resultDataUrl = `data:image/png;base64,${resultBase64}`;

    return NextResponse.json({ result: resultDataUrl });
  } catch (error) {
    console.error("Simulation error:", error);

    if (error instanceof OpenAI.APIError) {
      if (error.status === 429) {
        return NextResponse.json(
          {
            error:
              "Limite de requisicoes atingido. Aguarde um momento e tente novamente.",
          },
          { status: 429 }
        );
      }
      if (error.status === 400) {
        return NextResponse.json(
          {
            error:
              "A imagem nao pode ser processada. Tente com outra foto com o sorriso bem visivel.",
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: "Erro interno ao processar a simulacao." },
      { status: 500 }
    );
  }
}