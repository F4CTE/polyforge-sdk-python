type MetricUnit =
  | "Count"
  | "Milliseconds"
  | "Seconds"
  | "Microseconds"
  | "Bytes"
  | "None";

type LoggerLike = {
  log(message: unknown, ...optionalParams: unknown[]): void;
};

interface CloudWatchMetricInput {
  name: string;
  value: number;
  unit?: MetricUnit;
  dimensions?: Record<string, string>;
  properties?: Record<string, unknown>;
}

const DEFAULT_NAMESPACE = "Polyforge";

export function logCloudWatchMetric(
  logger: LoggerLike,
  input: CloudWatchMetricInput,
): void {
  const dimensions = input.dimensions ?? {};
  const dimensionKeys = Object.keys(dimensions);

  logger.log(
    {
      _aws: {
        Timestamp: Date.now(),
        CloudWatchMetrics: [
          {
            Namespace: DEFAULT_NAMESPACE,
            Dimensions: [dimensionKeys],
            Metrics: [{ Name: input.name, Unit: input.unit ?? "Count" }],
          },
        ],
      },
      ...dimensions,
      ...(input.properties ?? {}),
      [input.name]: input.value,
    },
    "cloudwatch metric",
  );
}
