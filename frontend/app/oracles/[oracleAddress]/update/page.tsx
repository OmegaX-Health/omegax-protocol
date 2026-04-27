// SPDX-License-Identifier: AGPL-3.0-or-later

import { OracleProfileWizard } from "@/components/oracle-profile-wizard";

type OracleUpdatePageProps = {
  params: Promise<{
    oracleAddress: string;
  }>;
};

export default async function OracleUpdatePage({ params }: OracleUpdatePageProps) {
  const { oracleAddress } = await params;
  return <OracleProfileWizard mode="update" oracleAddress={oracleAddress} />;
}
