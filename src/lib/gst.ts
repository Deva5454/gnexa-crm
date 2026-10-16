// GST: intra-state supplies carry CGST + SGST (half each), inter-state supplies and exports carry IGST.
// The supply type and place of supply are worked out by the database when the customer is set.

export const GST_STATES: Record<string, string> = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand",
  "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim",
  "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya",
  "18": "Assam", "19": "West Bengal", "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh",
  "24": "Gujarat", "26": "Dadra and Nagar Haveli and Daman and Diu", "27": "Maharashtra", "29": "Karnataka", "30": "Goa",
  "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry", "35": "Andaman and Nicobar Islands",
  "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh", "96": "Other country (export)", "97": "Other Territory",
};

export type SupplyType = "intra" | "inter" | "export";

export function placeOfSupply(code: string | null | undefined) {
  if (!code) return null;
  return GST_STATES[code] ? `${GST_STATES[code]} (${code})` : code;
}

/** Split one rate's tax into the components printed on the invoice. Odd paise go to CGST. */
export function taxComponents(rate: number, amount: number, supply: SupplyType) {
  if (supply !== "intra") return [{ label: `IGST ${rate}%`, amount }];
  const sgst = Math.floor((amount * 100) / 2) / 100;
  const cgst = Math.round((amount - sgst) * 100) / 100;
  return [
    { label: `CGST ${rate / 2}%`, amount: cgst },
    { label: `SGST ${rate / 2}%`, amount: sgst },
  ];
}

/** HSN (goods) / SAC (services) codes are 4–8 digits. */
export const HSN_RE = /^[0-9]{4,8}$/;
