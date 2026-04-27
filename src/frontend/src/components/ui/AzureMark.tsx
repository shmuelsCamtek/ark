interface AzureMarkProps {
  size?: number;
}

export function AzureMark({ size = 20 }: AzureMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <path d="M9 1L1 15h5l3-5 3 5h5L9 1z" fill="#0078d4" />
      <path d="M9 1l4 8-7 6h11L9 1z" fill="#50e6ff" opacity="0.6" />
    </svg>
  );
}
