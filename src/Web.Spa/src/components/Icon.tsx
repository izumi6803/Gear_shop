// Bộ icon SVG inline — không dùng icon-font để tránh phụ thuộc file font bên ngoài.
type IconName =
  | 'dashboard'
  | 'orders'
  | 'new'
  | 'inventory'
  | 'logout'
  | 'list'
  | 'close'
  | 'check'
  | 'warning'
  | 'info'
  | 'inbox'
  | 'chevron'
  | 'plus'
  | 'invoice'
  | 'print'
  | 'clock';

const PATHS: Record<IconName, string> = {
  dashboard: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  orders: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  new: 'M4 4h16v16H4zM12 8v8M8 12h8',
  inventory: 'M3 8l9-4 9 4-9 4-9-4zM3 8v8l9 4 9-4V8M12 12v8',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 8l-4 4 4 4M6 12h10',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8.5 12.5l2.5 2.5 4.5-5',
  warning: 'M12 4l9 16H3l9-16zM12 10v4M12 17h.01',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01',
  inbox: 'M4 13l2-7h12l2 7v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 13h5l1 2h4l1-2h5',
  chevron: 'M9 6l6 6-6 6',
  plus: 'M12 5v14M5 12h14',
  invoice: 'M6 3h12v18H6zM9 8h6M9 12h6M9 16h3',
  print: 'M7 8V4h10v4M7 16H5a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-2M7 14h10v6H7z',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
};

interface IconProps {
  name: IconName;
  className?: string;
  size?: number;
}

export function Icon({ name, className, size = 16 }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export type { IconName };
