/**
 * Portable, vendor-neutral layer added inside the full backup ZIP (under `portable/`).
 * Pure data transformation — no network, no database, no storage access.
 * Records are copied unchanged (all original field names/values, Persian text as-is),
 * only grouped under generic entity names and described by a self-contained schema.
 */

export const PORTABLE_FORMAT = "sadra-melk-portable";
export const PORTABLE_FORMAT_VERSION = 1;

type EntityDef = {
  entity: string;
  source: string;
  key: string;
  description: string;
  relations?: Array<{ field: string; to: string; kind: "many-to-one" | "one-to-one" }>;
  fields?: Record<string, string>;
};

export const PORTABLE_ENTITIES: EntityDef[] = [
  {
    entity: "user",
    source: "profiles",
    key: "id",
    description: "A person who uses the app (agent/staff). Login credentials are NOT included.",
    fields: { email: "Email address", full_name: "Display name", is_active: "Whether the account may use the app" },
  },
  {
    entity: "user_role",
    source: "user_roles",
    key: "id",
    description: "Role granted to a user: 'admin' (manager, sees private data) or 'collaborator'.",
    relations: [{ field: "user_id", to: "user", kind: "many-to-one" }],
  },
  {
    entity: "user_setting",
    source: "app_settings",
    key: "user_id",
    description: "Per-user preferences.",
    relations: [{ field: "user_id", to: "user", kind: "one-to-one" }],
    fields: { broker_default_interval_days: "Default days between broker follow-up contacts" },
  },
  {
    entity: "broker",
    source: "brokers",
    key: "id",
    description: "An external real-estate broker/agency that supplies listings.",
    fields: {
      name: "Broker name",
      phone: "Phone number",
      agency: "Agency name",
      last_contact_at: "Last time contacted",
      update_interval_days: "Desired days between contacts",
    },
  },
  {
    entity: "customer",
    source: "customers",
    key: "id",
    description: "A buyer/tenant client.",
    fields: { full_name: "Customer name", phone: "Phone number", status: "Customer status" },
  },
  {
    entity: "customer_requirement",
    source: "customer_requirements",
    key: "id",
    description: "One wish-list entry of a customer (what they are looking for). Used for matching.",
    relations: [{ field: "customer_id", to: "customer", kind: "many-to-one" }],
    fields: { min_budget: "Minimum budget (Iranian Rial/Toman as entered)", max_budget: "Maximum budget" },
  },
  {
    entity: "property",
    source: "properties",
    key: "id",
    description:
      "A real-estate listing (apartment, land, villa, shop...). Photos are referenced by path in `photos` (public) and `private_photos` (manager-only); the files themselves are listed in media/index.json.",
    relations: [{ field: "broker_id", to: "broker", kind: "many-to-one" }],
    fields: {
      file_code: "Human-readable unique listing number",
      title: "Listing title",
      property_type: "Type of property",
      transaction_type: "Sale / rent / pre-sale etc.",
      ownership_type: "Ownership/document type",
      city: "City",
      phase: "Phase/district (Sadra city)",
      neighborhood: "Neighborhood",
      area: "Area in square meters",
      price: "Current asking price",
      initial_price: "First recorded price",
      verified_price: "Price verified by the agent",
      deposit: "Rent deposit",
      monthly_rent: "Monthly rent",
      owner_name: "Owner name (private)",
      owner_phone: "Owner phone (private)",
      photos: "Array of media paths (public photos) — see media/index.json",
      private_photos: "Array of media paths (private photos) — see media/index.json",
      payment_plan: "Installment plan as JSON",
      land_category: "Official land category",
      land_zone: "Land zone",
      plot_number: "Plot number",
    },
  },
  {
    entity: "price_event",
    source: "property_price_events",
    key: "id",
    description: "Price history entry of a property.",
    relations: [{ field: "property_id", to: "property", kind: "many-to-one" }],
  },
  {
    entity: "media_visibility",
    source: "photo_visibility",
    key: "storage_path",
    description: "Visibility flag (public/private) of one media file, keyed by its original path.",
    relations: [{ field: "property_id", to: "property", kind: "many-to-one" }],
  },
  {
    entity: "share_link",
    source: "property_shares",
    key: "id",
    description:
      "A share link created for a property. The secret token is intentionally NOT exported, so the link itself cannot be recreated; only its history is kept.",
    relations: [
      { field: "property_id", to: "property", kind: "many-to-one" },
      { field: "customer_id", to: "customer", kind: "many-to-one" },
    ],
  },
  {
    entity: "follow_up",
    source: "follow_ups",
    key: "id",
    description: "Reminder / follow-up task, optionally linked to a property, customer or broker.",
    relations: [
      { field: "property_id", to: "property", kind: "many-to-one" },
      { field: "customer_id", to: "customer", kind: "many-to-one" },
      { field: "broker_id", to: "broker", kind: "many-to-one" },
    ],
  },
  {
    entity: "released_file_code",
    source: "file_code_pool",
    key: "code",
    description: "Listing numbers freed by deleted properties, available for reuse.",
  },
  {
    entity: "import_batch",
    source: "bulk_import_batches",
    key: "id",
    description: "A bulk photo-import session.",
  },
  {
    entity: "import_item",
    source: "bulk_import_items",
    key: "id",
    description: "One photo in a bulk import with its OCR/matching result and manager decision.",
    relations: [
      { field: "batch_id", to: "import_batch", kind: "many-to-one" },
      { field: "property_id", to: "property", kind: "many-to-one" },
      { field: "decision_property_id", to: "property", kind: "many-to-one" },
    ],
  },
];

export type PortablePhoto = {
  path: string;
  file: string;
  size_bytes: number;
  content_type: string | null;
  sha256: string;
};

function jsonType(values: unknown[]): string {
  const types = new Set(
    values
      .filter((v) => v !== null && v !== undefined)
      .map((v) => (Array.isArray(v) ? "array" : typeof v === "object" ? "object" : typeof v)),
  );
  const t = types.size ? [...types].join("|") : "unknown";
  return values.some((v) => v === null) ? `${t}|null` : t;
}

/** Returns portable/* files as UTF-8 text. `tables` = original JSONL per source table. */
export function buildPortableLayer(tables: Record<string, string>, photos: PortablePhoto[], createdAt: string) {
  const out: Record<string, string> = {};
  const parsed: Record<string, Array<Record<string, unknown>>> = {};
  for (const def of PORTABLE_ENTITIES) {
    const text = tables[def.source] ?? "";
    parsed[def.source] = text.split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
    // Identical rows, unchanged; only file name is generic.
    out[`portable/data/${def.entity}.jsonl`] = text;
  }

  // Media index: each file, where it is in the ZIP, and which records point to it.
  const vis = new Map(parsed["photo_visibility"]!.map((r) => [String(r["storage_path"]), r]));
  const links = new Map<string, Array<{ entity: string; id: string; field: string }>>();
  const addLink = (p: unknown, l: { entity: string; id: string; field: string }) => {
    if (typeof p !== "string") return;
    links.set(p, [...(links.get(p) ?? []), l]);
  };
  for (const r of parsed["properties"]!) {
    for (const f of ["photos", "private_photos"]) {
      const v = r[f];
      if (Array.isArray(v)) for (const p of v) addLink(p, { entity: "property", id: String(r["id"]), field: f });
    }
  }
  for (const r of parsed["bulk_import_items"]!) {
    addLink(r["storage_path"], { entity: "import_item", id: String(r["id"]), field: "storage_path" });
  }
  const media = photos.map((p) => {
    const l = links.get(p.path) ?? [];
    const v = vis.get(p.path);
    return {
      id: p.path,
      original_path: p.path,
      file: p.file,
      mime_type: p.content_type,
      size_bytes: p.size_bytes,
      sha256: p.sha256,
      visibility: (v?.["visibility"] as string | undefined) ?? null,
      linked: l.length > 0,
      links: l,
    };
  });
  out["portable/media/index.json"] = JSON.stringify(
    { media_count: media.length, total_bytes: media.reduce((s, m) => s + m.size_bytes, 0), media },
    null,
    2,
  );

  const schema = {
    format: PORTABLE_FORMAT,
    format_version: PORTABLE_FORMAT_VERSION,
    encoding: "UTF-8; data files are JSON Lines (one JSON object per line)",
    conventions: {
      ids: "Stable UUID/string keys; relations use the same IDs",
      timestamps: "ISO-8601 with timezone",
      money: "Integers exactly as entered in the app (no currency conversion)",
      text: "Persian (fa) text preserved exactly; nothing translated",
      field_names: "Original field names kept unchanged so no value is lost or guessed",
    },
    entities: PORTABLE_ENTITIES.map((def) => {
      const rows = parsed[def.source]!;
      const names = [...new Set(rows.flatMap((r) => Object.keys(r)))];
      return {
        name: def.entity,
        file: `portable/data/${def.entity}.jsonl`,
        source_name: def.source,
        primary_key: def.key,
        record_count: rows.length,
        description: def.description,
        relations: def.relations ?? [],
        fields: names.map((n) => ({
          name: n,
          type: jsonType(rows.map((r) => r[n])),
          description: def.fields?.[n] ?? null,
        })),
      };
    }),
    media: {
      file: "portable/media/index.json",
      description:
        "Each media entry points to a file inside this ZIP (`file`). Records reference media by `original_path` (property.photos / property.private_photos / import_item.storage_path). Unlinked media (linked=false) are kept intentionally.",
    },
  };
  out["portable/schema.json"] = JSON.stringify(schema, null, 2);

  const lines = [
    "# Sadra Melk — Portable Backup",
    "",
    `Format: ${PORTABLE_FORMAT} v${PORTABLE_FORMAT_VERSION} — created ${createdAt}`,
    "",
    "This folder describes the whole backup without depending on any specific database or vendor.",
    "",
    "## Files",
    "- `portable/schema.json` — machine-readable list of entities, fields, types, keys and relations.",
    "- `portable/data/<entity>.jsonl` — records, one JSON object per line, original values unchanged.",
    "- `portable/media/index.json` — every photo file: location in ZIP, MIME type, size, SHA-256, links to records.",
    "- `photos/...` — the actual image files (shared with the native layer, not duplicated).",
    "- `checksums.txt` — SHA-256 of every file in the ZIP (`sha256  path`).",
    "",
    "## Entities",
    ...PORTABLE_ENTITIES.map(
      (d) =>
        `- **${d.entity}** (${parsed[d.source]!.length}) — ${d.description}` +
        (d.relations?.length ? ` Relations: ${d.relations.map((r) => `${r.field} → ${r.to}`).join(", ")}.` : ""),
    ),
    "",
    "## Photos ↔ properties",
    "A property's `photos` (public) and `private_photos` (manager-only) arrays contain `original_path` values.",
    "Look them up in `portable/media/index.json` to find the file inside the ZIP.",
    "",
    "## Import order",
    "user → user_role, user_setting → broker, customer, released_file_code, import_batch → property →",
    "customer_requirement, price_event, media_visibility, share_link, follow_up, import_item.",
    "",
    "## Not included (on purpose)",
    "Passwords/login credentials, secret keys, share-link secret tokens, access URLs.",
    "",
    "## توضیح فارسی",
    "این پوشه نسخهٔ مستقل و قابل‌انتقال پشتیبان است. همهٔ رکوردها بدون تغییر و با همان شناسه‌ها ذخیره شده‌اند",
    "و متن‌های فارسی دست‌نخورده‌اند. رمزها و کلیدهای امنیتی در فایل نیستند.",
    "",
  ];
  out["portable/README.md"] = lines.join("\n");
  return { files: out, summary: { media_count: media.length, unlinked: media.filter((m) => !m.linked).length } };
}
