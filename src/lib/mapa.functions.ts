import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  endereco: z.string().trim().min(3).max(500),
  cidade: z.string().trim().max(120).optional(),
  estado: z.string().trim().max(60).optional(),
});

const UA = "A8-Avaliacoes/1.0 (PDF generator; contact: contato@a8investimentos.com)";

async function bufferToBase64(buf: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  // btoa is available in Worker runtime
  // eslint-disable-next-line no-undef
  return btoa(bin);
}

export const getMapaEstatico = createServerFn({ method: "POST" })
  .inputValidator((data) => schema.parse(data))
  .handler(async ({ data }) => {
    try {
      // Monta query priorizando contexto Brasil — evita falsos positivos
      // (ex.: nomes de ruas comuns em outros países como Panamá).
      let q = data.endereco;
      const lower = q.toLowerCase();
      if (data.cidade && !lower.includes(data.cidade.toLowerCase())) {
        q += `, ${data.cidade}`;
      }
      if (data.estado && !lower.includes(data.estado.toLowerCase())) {
        q += `, ${data.estado}`;
      }
      if (!/brasil|brazil/i.test(q)) {
        q += ", Brasil";
      }

      // 1) Geocoding via Nominatim (OpenStreetMap) — sem chave, restrito ao Brasil
      const geoUrl =
        "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=" +
        encodeURIComponent(q);
      const geoRes = await fetch(geoUrl, {
        headers: { "User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9" },
      });
      if (!geoRes.ok) {
        console.warn("Nominatim respondeu", geoRes.status);
        return { ok: false as const, reason: "geocoding_failed" };
      }
      const arr = (await geoRes.json()) as Array<{ lat: string; lon: string; display_name: string }>;
      if (!Array.isArray(arr) || arr.length === 0) {
        return { ok: false as const, reason: "endereco_nao_encontrado" };
      }
      const { lat, lon, display_name } = arr[0];

      // 2) Static map — tenta múltiplos provedores (sem chave)
      // staticmap.openstreetmap.de foi descontinuado; usamos fallbacks.
      const providers: Array<{ name: string; url: string }> = [
        {
          name: "openstreetmap.de",
          url:
            `https://staticmap.openstreetmap.de/staticmap.php` +
            `?center=${lat},${lon}&zoom=15&size=800x400&maptype=mapnik` +
            `&markers=${lat},${lon},red-pushpin`,
        },
        {
          name: "yandex",
          url:
            `https://static-maps.yandex.ru/1.x/?ll=${lon},${lat}` +
            `&z=15&l=map&size=600,400&pt=${lon},${lat},pm2rdm&lang=pt_BR`,
        },
      ];

      for (const p of providers) {
        try {
          const mapRes = await fetch(p.url, { headers: { "User-Agent": UA } });
          if (!mapRes.ok) {
            console.warn(`static map (${p.name}) respondeu`, mapRes.status);
            continue;
          }
          const buf = await mapRes.arrayBuffer();
          if (buf.byteLength < 1000) {
            console.warn(`static map (${p.name}) payload muito pequeno`, buf.byteLength);
            continue;
          }
          const ct = mapRes.headers.get("content-type") || "image/png";
          const base64 = await bufferToBase64(buf);
          const dataUrl = `data:${ct};base64,${base64}`;
          return {
            ok: true as const,
            dataUrl,
            lat: Number(lat),
            lon: Number(lon),
            display_name,
            provider: p.name,
          };
        } catch (err) {
          console.warn(`falha no provedor ${p.name}:`, err);
        }
      }
      return { ok: false as const, reason: "static_map_failed", lat, lon, display_name };
    } catch (e: any) {
      console.error("Erro ao gerar mapa estático OSM:", e);
      return { ok: false as const, reason: "exception" };
    }
  });
