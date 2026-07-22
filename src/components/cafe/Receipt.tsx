import { formatIqd } from "@/lib/cafe/money";

export type ReceiptData = {
  orderNumber: string;
  lines: { name: string; flavor?: string | null; qty: number; unitPrice: number }[];
  subtotal: number;
  discount: number;
  total: number;
  dateTime: string;
};

/** 80mm thermal receipt. Hidden on screen; the only thing visible when printing
 *  (see the @media print rules in globals.css). */
export function Receipt({ data }: { data: ReceiptData }) {
  return (
    <div className="receipt-print hidden print:block" dir="rtl">
      {/* 80mm roll — applies only while a receipt is mounted (this style unmounts with it) */}
      <style>{`@media print { @page { size: 80mm auto; margin: 0; } }`}</style>
      <div style={{ textAlign: "center", fontWeight: 800, fontSize: "16px" }}>بيزارا كافيه</div>
      <div style={{ textAlign: "center", fontSize: "11px", marginBottom: "6px" }}>الرمادي — العراق</div>
      <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
        <span>رقم الطلب: {data.orderNumber}</span>
        <span>{data.dateTime}</span>
      </div>
      <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />
      <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
        <tbody>
          {data.lines.map((l, i) => (
            <tr key={i}>
              <td style={{ padding: "2px 0" }}>
                {l.name}
                {l.flavor ? ` (${l.flavor})` : ""} ×{l.qty}
              </td>
              <td style={{ textAlign: "left", whiteSpace: "nowrap" }}>{formatIqd(l.unitPrice * l.qty)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
        <span>المجموع</span>
        <span>{formatIqd(data.subtotal)} د.ع</span>
      </div>
      {data.discount > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
          <span>الخصم</span>
          <span>-{formatIqd(data.discount)} د.ع</span>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: "14px", marginTop: "2px" }}>
        <span>الإجمالي</span>
        <span>{formatIqd(data.total)} د.ع</span>
      </div>
      <div style={{ borderTop: "1px dashed #000", margin: "6px 0 4px" }} />
      <div style={{ textAlign: "center", fontSize: "11px" }}>شكراً لزيارتكم ❤</div>
    </div>
  );
}
