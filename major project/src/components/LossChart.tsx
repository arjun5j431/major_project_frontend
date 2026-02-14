// LossChart.tsx
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import type { ChartOptions, ChartData } from "chart.js";

import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function LossChart() {
  const data: ChartData<"line"> = {
    labels: ["Epoch 1", "Epoch 2", "Epoch 3", "Epoch 4"],
    datasets: [
      {
        label: "Training Loss",
        data: [0.9, 0.7, 0.5, 0.3],
        borderColor: "rgb(75, 192, 192)",
        tension: 0.3,
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    plugins: {
      legend: {
        position: "top",
      },
      title: {
        display: true,
        text: "Model Loss Curve",
      },
    },
  };

  return <Line data={data} options={options} />;
}
