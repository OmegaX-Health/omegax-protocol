// SPDX-License-Identifier: AGPL-3.0-or-later

import { OracleProfileWizard } from "@/components/oracle-profile-wizard";

type OracleUpdatePageProps = {
  params: {
    oracleAddress: string;
  };
};

export default function OracleUpdatePage({ params }: OracleUpdatePageProps) {
  return <OracleProfileWizard mode="update" oracleAddress={params.oracleAddress} />;
}
