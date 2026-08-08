import React, { useEffect, useState } from "react";
import { Landmark, WalletCards } from "lucide-react";
import { getBankLogoUrl, MOMO_LOGO_URL } from "../lib/vietnamBanks";

interface PaymentAccountLogoProps {
  accountType?: "bank" | "momo";
  bankId: string;
  name: string;
  className?: string;
}

export const PaymentAccountLogo: React.FC<PaymentAccountLogoProps> = ({
  accountType = "bank",
  bankId,
  name,
  className = "w-10 h-10",
}) => {
  const [failed, setFailed] = useState(false);
  const src = accountType === "momo" ? MOMO_LOGO_URL : getBankLogoUrl(bankId);

  useEffect(() => setFailed(false), [src]);

  return (
    <span className={`${className} rounded-xl bg-white border border-stone-200 overflow-hidden flex items-center justify-center shrink-0`}>
      {failed ? (
        accountType === "momo"
          ? <WalletCards className="w-1/2 h-1/2 text-[#A50064]" />
          : <Landmark className="w-1/2 h-1/2 text-stone-400" />
      ) : (
        <img
          src={src}
          alt={`Logo ${name}`}
          className="w-full h-full object-contain p-1"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
};
