// Seller or vendor. The account type is a server setting (SP_API_ACCOUNT_TYPE, default seller) exposed
// through /api/config. It decides the content type a new A+ document gets (EBC for sellers, EMC for
// vendors), which heading the A+ slot carries when nothing is live yet ("Product description" for
// sellers, "From the manufacturer" for vendors) and who the detail-page simulation shows as the seller
// (the brand for a seller, Amazon.com for a vendor). Brand Story renders under "From the brand" for both.
import { createContext, useContext, type ReactNode } from 'react';

export type AccountType = 'seller' | 'vendor';

const Ctx = createContext<AccountType>('seller');

export function AccountProvider({ type, children }: { type: AccountType; children: ReactNode }) {
  return <Ctx.Provider value={type}>{children}</Ctx.Provider>;
}

export const useAccount = () => useContext(Ctx);

/** Content type of a new A+ document for this account. */
export const aplusContentTypeFor = (type: AccountType): 'EBC' | 'EMC' => (type === 'vendor' ? 'EMC' : 'EBC');
