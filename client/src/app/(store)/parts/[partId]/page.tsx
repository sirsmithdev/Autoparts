import { notFound } from "next/navigation";
import { PartDetailClient } from "./client";

interface PartDetail {
  part: { id: string; name: string; partNumber: string; salePrice: string; description?: string | null; longDescription?: string | null; manufacturer?: string | null; category?: string | null; imageUrl?: string | null; stockStatus: string; condition?: string; isOversized?: boolean };
  partNumbers: Array<{ id: string; partNumber: string; numberType: string; brand?: string | null; isPrimary: boolean }>;
  compatibility: Array<{ id: string; make: string; model: string; yearStart: number; yearEnd: number; trim?: string | null; engineType?: string | null; source?: string }>;
  images: Array<{ id: string; imageUrl: string; altText?: string | null; isPrimary: boolean }>;
}

async function getPartDetail(partId: string): Promise<PartDetail | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5002";
    const res = await fetch(`${apiUrl}/api/store/catalog/${partId}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: Promise<{ partId: string }> }) {
  const { partId } = await params;
  const detail = await getPartDetail(partId);
  if (!detail) return { title: "Part Not Found" };
  return {
    title: `${detail.part.name} - ${detail.part.partNumber} | 316 Auto Parts`,
    description: detail.part.description || `Buy ${detail.part.name} (${detail.part.partNumber}) online. ${detail.part.manufacturer || ""} ${detail.part.category || ""}`.trim(),
  };
}

function buildJsonLd(detail: PartDetail) {
  const { part } = detail;

  const availabilityMap: Record<string, string> = {
    in_stock: "https://schema.org/InStock",
    low_stock: "https://schema.org/LimitedAvailability",
    out_of_stock: "https://schema.org/OutOfStock",
  };

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: part.name,
    sku: part.partNumber,
    offers: {
      "@type": "Offer",
      price: part.salePrice,
      priceCurrency: "JMD",
      availability: availabilityMap[part.stockStatus] || "https://schema.org/InStock",
    },
  };

  if (part.description) jsonLd.description = part.description;
  if (part.manufacturer) jsonLd.brand = { "@type": "Brand", name: part.manufacturer };
  if (part.imageUrl) jsonLd.image = part.imageUrl;
  if (detail.images.length > 0) {
    jsonLd.image = detail.images.map((img) => img.imageUrl);
  }

  return jsonLd;
}

export default async function PartDetailPage({ params }: { params: Promise<{ partId: string }> }) {
  const { partId } = await params;
  const detail = await getPartDetail(partId);
  if (!detail) notFound();

  const jsonLd = buildJsonLd(detail);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PartDetailClient detail={detail} />
    </>
  );
}
