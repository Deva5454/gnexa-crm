// GST e-invoice (IRP schema 1.1) JSON for invoices and credit notes, ready to upload to the e-invoice portal
// (or hand to a GSP). Only B2B and export documents need an IRN; B2C ones are reported as such.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { allRows } from "@/lib/fetch-all";
import { taxComponents, type SupplyType } from "@/lib/gst";
import { docNumber } from "@/lib/sales";

type Doc = {
  id: number;
  kind: "invoice" | "credit_note";
  number: number;
  date: string;
  total: number;
  discount_percent: number;
  adjustment: number;
  supply_type: string;
  place_of_supply: string | null;
  customer: { company: string; vat: string | null; address: string | null; city: string | null; state: string | null; zip: string | null } | null;
  lines: { description: string; hsn_sac: string | null; qty: number; unit: string | null; rate: number; tax_rate: number }[];
};
type Company = { company_name: string; gstin: string | null; address: string | null; phone: string | null; email: string | null };

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const pinOf = (s: string | null | undefined) => /\b([1-9][0-9]{5})\b/.exec(s ?? "")?.[1] ?? null;
const ddmmyyyy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const GSTIN_RE = /^[0-9]{2}[A-Z0-9]{13}$/;
/** GST unit quantity codes for the units people type most */
const UQC: Record<string, string> = { nos: "NOS", no: "NOS", pcs: "PCS", pc: "PCS", unit: "UNT", units: "UNT", kg: "KGS", kgs: "KGS", box: "BOX", set: "SET", ltr: "LTR", l: "LTR", m: "MTR", mtr: "MTR", day: "OTH", hrs: "OTH", hr: "OTH" };

export type EInvoiceCheck = { id: number; label: string; customer: string; total: number; kind: "b2b" | "export" | "b2c"; issues: string[] };

export function checkDoc(d: Doc, company: Company): EInvoiceCheck {
  const issues: string[] = [];
  const gstin = (d.customer?.vat ?? "").replace(/\s/g, "").toUpperCase();
  const kind = d.supply_type === "export" ? "export" : GSTIN_RE.test(gstin) ? "b2b" : "b2c";
  if (!company.gstin || !GSTIN_RE.test(company.gstin.replace(/\s/g, ""))) issues.push("Your GSTIN is missing or invalid (Setup → Settings)");
  if (!pinOf(company.address)) issues.push("Your address has no 6-digit PIN code");
  if (kind === "b2b" && !pinOf(d.customer?.zip ?? d.customer?.address)) issues.push("Customer PIN code missing");
  const noHsn = d.lines.filter((l) => !l.hsn_sac).length;
  if (noHsn) issues.push(`${noHsn} line${noHsn === 1 ? "" : "s"} without HSN / SAC`);
  return { id: d.id, label: docNumber(d.kind, d.number), customer: d.customer?.company ?? "—", total: Number(d.total), kind, issues };
}

export function toEInvoice(d: Doc, company: Company) {
  const supply = (d.supply_type || "intra") as SupplyType;
  const seller = company.gstin?.replace(/\s/g, "").toUpperCase() ?? "";
  const buyerGstin = (d.customer?.vat ?? "").replace(/\s/g, "").toUpperCase();
  const disc = Number(d.discount_percent) / 100;
  let ass = 0, cg = 0, sg = 0, ig = 0;
  const ItemList = d.lines.map((l, i) => {
    const tot = r2(Number(l.qty) * Number(l.rate));
    const discount = r2(tot * disc);
    const assAmt = r2(tot - discount);
    const tax = r2((assAmt * Number(l.tax_rate)) / 100);
    const parts = taxComponents(Number(l.tax_rate), tax, supply);
    const igst = supply === "intra" ? 0 : tax;
    const cgst = supply === "intra" ? parts[0]!.amount : 0;
    const sgst = supply === "intra" ? parts[1]!.amount : 0;
    ass += assAmt; cg += cgst; sg += sgst; ig += igst;
    return {
      SlNo: String(i + 1),
      PrdDesc: l.description.slice(0, 300),
      IsServc: (l.hsn_sac ?? "").startsWith("99") ? "Y" : "N",
      HsnCd: l.hsn_sac ?? "",
      Qty: Number(l.qty),
      Unit: UQC[(l.unit ?? "").toLowerCase()] ?? "OTH",
      UnitPrice: Number(l.rate),
      TotAmt: tot,
      Discount: discount,
      AssAmt: assAmt,
      GstRt: Number(l.tax_rate),
      IgstAmt: igst,
      CgstAmt: cgst,
      SgstAmt: sgst,
      TotItemVal: r2(assAmt + tax),
    };
  });
  const lines = (s: string | null) => (s ?? "").split(/\n|,/).map((x) => x.trim()).filter(Boolean);
  const sellerAddr = lines(company.address);
  const buyerAddr = lines(d.customer?.address ?? null);
  const taxes = r2(cg + sg + ig);
  return {
    Version: "1.1",
    TranDtls: { TaxSch: "GST", SupTyp: supply === "export" ? "EXPWOP" : "B2B", RegRev: "N", IgstOnIntra: "N" },
    DocDtls: { Typ: d.kind === "credit_note" ? "CRN" : "INV", No: docNumber(d.kind, d.number), Dt: ddmmyyyy(d.date) },
    SellerDtls: {
      Gstin: seller,
      LglNm: company.company_name,
      Addr1: (sellerAddr[0] ?? company.company_name).slice(0, 100),
      Loc: (sellerAddr[1] ?? "").slice(0, 50) || "—",
      Pin: Number(pinOf(company.address) ?? 0),
      Stcd: seller.slice(0, 2),
      ...(company.phone ? { Ph: company.phone.replace(/\D/g, "").slice(-12) } : {}),
      ...(company.email ? { Em: company.email } : {}),
    },
    BuyerDtls: {
      Gstin: supply === "export" ? "URP" : buyerGstin,
      LglNm: d.customer?.company ?? "",
      Pos: supply === "export" ? "96" : (d.place_of_supply ?? buyerGstin.slice(0, 2)),
      Addr1: (buyerAddr[0] ?? d.customer?.company ?? "").slice(0, 100),
      Loc: (d.customer?.city ?? buyerAddr[1] ?? "—").slice(0, 50),
      Pin: supply === "export" ? 999999 : Number(pinOf(d.customer?.zip ?? d.customer?.address) ?? 0),
      Stcd: supply === "export" ? "96" : buyerGstin.slice(0, 2),
    },
    ItemList,
    ValDtls: {
      AssVal: r2(ass),
      CgstVal: r2(cg),
      SgstVal: r2(sg),
      IgstVal: r2(ig),
      Discount: 0,
      OthChrg: 0,
      RndOffAmt: r2(Number(d.total) - r2(ass) - taxes),
      TotInvVal: Number(d.total),
    },
  };
}


/** Issued invoices and credit notes in a date range, with what the e-invoice needs. */
export async function loadEInvoiceDocs(supabase: SupabaseClient<Database>, from: string, to: string) {
  const [{ data: docs }, { data: company }] = await Promise.all([
    allRows((a, b) =>
      supabase
        .from("sales_docs")
        .select("id, kind, number, date, total, discount_percent, adjustment, supply_type, place_of_supply, customer:customers(company, vat, address, city, state, zip), lines:sales_doc_items(description, hsn_sac, qty, unit, rate, tax_rate, position)")
        .in("kind", ["invoice", "credit_note"])
        .not("status", "in", "(draft,cancelled)")
        .gte("date", from)
        .lte("date", to)
        .order("date")
        .order("id")
        .range(a, b),
    ),
    supabase.from("company_settings").select("company_name, gstin, address, phone, email").maybeSingle(),
  ]);
  const list = (docs ?? []).map((d) => ({ ...d, kind: d.kind as "invoice" | "credit_note", lines: [...(d.lines ?? [])].sort((x, y) => x.position - y.position) }));
  return { docs: list, company: company ?? { company_name: "", gstin: null, address: null, phone: null, email: null } };
}
