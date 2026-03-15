import React from "react";

import DataImporterShell from "@/components/dataImporter/DataImporterShell.jsx";
import useDataImporterContainerProps from "@/components/dataImporter/useDataImporterContainerProps.js";

export default function DataImporter(props) {
  const containerProps = useDataImporterContainerProps(props);

  return <DataImporterShell {...containerProps} />;
}
