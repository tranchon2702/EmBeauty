import React from "react";
import { StickyNote, UserCheck } from "lucide-react";
import { formatPercent, formatVnd } from "../lib/money";

export interface InvoiceEmployeeRef {
  _id?: string;
  name: string;
  avatar?: string;
}

export interface InvoiceServiceDetail {
  name: string;
  catalogPrice?: number | null;
  price: number;
  quantity?: number;
  employeeId?: InvoiceEmployeeRef | string | null;
}

export interface InvoiceBreakdownData {
  services: InvoiceServiceDetail[];
  subTotal?: number;
  surcharge?: number;
  surchargeNote?: string;
  discount?: number;
  discountType?: "amount" | "percent";
  discountValue?: number;
  totalAmount: number;
  note?: string;
  employeeId?: InvoiceEmployeeRef | null;
}

interface InvoiceBreakdownProps {
  invoice: InvoiceBreakdownData;
  className?: string;
}

const resolveEmployee = (
  employee: InvoiceServiceDetail["employeeId"],
  fallback?: InvoiceEmployeeRef | null,
) => typeof employee === "object" && employee?.name ? employee : fallback || null;

export const InvoiceBreakdown: React.FC<InvoiceBreakdownProps> = ({ invoice, className = "" }) => {
  const catalogTotal = invoice.services.reduce((sum, service) => {
    const quantity = service.quantity || 1;
    const catalogPrice = service.catalogPrice ?? service.price;
    return sum + catalogPrice * quantity;
  }, 0);
  const computedSubTotal = invoice.services.reduce(
    (sum, service) => sum + service.price * (service.quantity || 1),
    0,
  );
  const subTotal = invoice.subTotal ?? computedSubTotal;
  const lineDiscountTotal = invoice.services.reduce((sum, service) => {
    const catalogPrice = service.catalogPrice ?? service.price;
    return sum + Math.max(0, catalogPrice - service.price) * (service.quantity || 1);
  }, 0);
  const lineIncreaseTotal = invoice.services.reduce((sum, service) => {
    const catalogPrice = service.catalogPrice ?? service.price;
    return sum + Math.max(0, service.price - catalogPrice) * (service.quantity || 1);
  }, 0);
  const assignments = new Map<string, {
    employee: InvoiceEmployeeRef | null;
    name: string;
    services: string[];
    amount: number;
    isPrimary: boolean;
  }>();
  const primaryId = invoice.employeeId?._id;
  const primaryName = invoice.employeeId?.name || "Chưa xác định";

  invoice.services.forEach(service => {
    const employee = resolveEmployee(service.employeeId, invoice.employeeId);
    const name = employee?.name || "Chưa xác định";
    const key = employee?._id || `name:${name}`;
    const isPrimary = primaryId ? employee?._id === primaryId : name === primaryName;
    const assignment = assignments.get(key) || { employee, name, services: [], amount: 0, isPrimary };
    assignment.services.push(`${service.name}${(service.quantity || 1) > 1 ? ` ×${service.quantity}` : ""}`);
    assignment.amount += service.price * (service.quantity || 1);
    assignments.set(key, assignment);
  });

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white divide-y divide-stone-100">
        {invoice.services.map((service, index) => {
          const quantity = service.quantity || 1;
          const catalogPrice = service.catalogPrice ?? service.price;
          const hasLineDiscount = service.price < catalogPrice;
          const lineDiscount = Math.max(0, catalogPrice - service.price) * quantity;
          const percent = catalogPrice > 0
            ? Math.round((catalogPrice - service.price) / catalogPrice * 10000) / 100
            : 0;

          return (
            <div key={`${service.name}-${index}`} className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-stone-800 text-xs">{service.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                    {hasLineDiscount ? (
                      <>
                        <span className="text-stone-400 line-through">{formatVnd(catalogPrice)}</span>
                        <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 font-bold text-emerald-700">
                          -{formatPercent(percent)}%
                        </span>
                        <span className="font-semibold text-[#9E5E6F]">{formatVnd(service.price)}/lần</span>
                      </>
                    ) : (
                      <span className="font-semibold text-stone-500">{formatVnd(service.price)}/lần</span>
                    )}
                    <span className="text-stone-400">× {quantity}</span>
                  </div>
                  {lineDiscount > 0 && (
                    <p className="mt-1 text-[9px] font-semibold text-emerald-600">
                      Giảm trên dòng: -{formatVnd(lineDiscount)}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-xs font-extrabold text-stone-900">
                  {formatVnd(service.price * quantity)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-[#E5B2C0] bg-[#F9ECEF]/55 p-3">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#9E5E6F]">
          <span className="flex items-center gap-1.5">
            <UserCheck className="h-3.5 w-3.5" /> Phân công thực hiện
          </span>
          <span className="normal-case tracking-normal text-stone-600">
            Bill chính: {primaryName}
          </span>
        </div>
        <p className="mb-2 text-[9px] leading-relaxed text-stone-500">
          Toàn bộ bill mặc định thuộc nhân viên chính; các dịch vụ nhân viên khác hỗ trợ được tách riêng bên dưới.
        </p>
        <div className="space-y-1.5 text-[10px]">
          {[...assignments.entries()].map(([key, assignment]) => (
            <div key={key} className="flex items-start gap-2">
              <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-[#9E5E6F] text-white flex items-center justify-center text-[8px] font-bold">
                {assignment.employee?.avatar ? (
                  <img
                    src={assignment.employee.avatar}
                    alt={assignment.name}
                    className="h-full w-full object-cover"
                  />
                ) : assignment.name.split(" ").slice(-2).map(part => part[0]).join("").toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="font-bold text-stone-700">{assignment.name}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold ${
                    assignment.isPrimary
                      ? "bg-[#9E5E6F] text-white"
                      : "bg-amber-100 text-amber-700"
                  }`}>
                    {assignment.isPrimary ? "Nhân viên chính" : "Hỗ trợ"}
                  </span>
                  <span className="ml-auto font-bold text-stone-700">{formatVnd(assignment.amount)}</span>
                </div>
                <p className="mt-0.5 text-stone-600">{assignment.services.join(", ")}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-stone-50 p-3 text-[11px] space-y-1.5 border border-stone-100">
        <div className="flex justify-between text-stone-500">
          <span>Giá gốc / giá đã báo</span><span>{formatVnd(catalogTotal)}</span>
        </div>
        {lineIncreaseTotal > 0 && (
          <div className="flex justify-between text-amber-700">
            <span>Điều chỉnh tăng theo dòng</span><span>+{formatVnd(lineIncreaseTotal)}</span>
          </div>
        )}
        {lineDiscountTotal > 0 && (
          <div className="flex justify-between text-emerald-700">
            <span>Giảm theo từng dòng</span><span>-{formatVnd(lineDiscountTotal)}</span>
          </div>
        )}
        {(lineIncreaseTotal > 0 || lineDiscountTotal > 0) && (
          <div className="flex justify-between border-t border-stone-200 pt-1.5 font-semibold text-stone-700">
            <span>Tiền dịch vụ</span><span>{formatVnd(subTotal)}</span>
          </div>
        )}
        {(invoice.surcharge || 0) > 0 && (
          <div className="flex justify-between text-amber-700">
            <span>Phụ thu{invoice.surchargeNote ? ` (${invoice.surchargeNote})` : ""}</span>
            <span>+{formatVnd(invoice.surcharge || 0)}</span>
          </div>
        )}
        {(invoice.discount || 0) > 0 && (
          <div className="flex justify-between text-emerald-700">
            <span>
              Giảm tổng bill{invoice.discountType === "percent" ? ` (${formatPercent(invoice.discountValue || 0)}%)` : ""}
            </span>
            <span>-{formatVnd(invoice.discount || 0)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-stone-200 pt-2 text-sm font-extrabold text-stone-900">
          <span>Thanh toán</span>
          <span className="text-[#9E5E6F]">{formatVnd(invoice.totalAmount)}</span>
        </div>
      </div>

      {invoice.note && (
        <div className="flex items-start gap-2 rounded-xl border border-stone-200 bg-white p-3 text-[10px] text-stone-600">
          <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-400" />
          <div><span className="font-bold text-stone-700">Ghi chú hóa đơn: </span>{invoice.note}</div>
        </div>
      )}
    </div>
  );
};
