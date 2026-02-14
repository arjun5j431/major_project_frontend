import React, { useState } from "react";
import Papa from "papaparse";
import type { ParseResult } from "papaparse";


interface CSVRow {
  epoch: number;
  loss: number;
  accuracy: number;
}

export default function CSVUploader() {
  const [data, setData] = useState<CSVRow[]>([]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    Papa.parse<CSVRow>(file, {
      header: true,
      dynamicTyping: true,
      complete: (results: ParseResult<CSVRow>) => {
        console.log(results.data);
        setData(results.data);
      },
    });
  };

  return (
    <div>
      <input type="file" accept=".csv" onChange={handleFileUpload} />
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
