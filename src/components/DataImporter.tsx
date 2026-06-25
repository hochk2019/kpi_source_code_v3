import React from "react";

import DataImporterShell from "@/components/dataImporter/DataImporterShell.jsx";
import useDataImporterContainerProps from "@/components/dataImporter/useDataImporterContainerProps.js";
import { PageLayout } from "@/components/layout/PageLayout";

interface DataImporterProps {
  currentUser?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export default function DataImporter(props: DataImporterProps) {
  const containerProps = useDataImporterContainerProps(props);

  return (
    <PageLayout title="Import Dữ liệu">
      <DataImporterShell {...containerProps} />
    </PageLayout>
  );
}
