import {
  FileText,
  Monitor,
  HeartPulse,
  Pill,
  Utensils,
  Sparkles,
  Building2,
  Fuel,
  Car,
  Shirt,
  Armchair,
  Zap,
  Shield,
  HardHat,
  Wifi,
  Printer,
  Truck,
  Wrench,
  Clipboard,
  Droplets,
  Thermometer,
  BookOpen,
  FlaskConical,
  Smile,
  Wheat,
  Package,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  "file-text": FileText,
  monitor: Monitor,
  "heart-pulse": HeartPulse,
  pill: Pill,
  utensils: Utensils,
  sparkles: Sparkles,
  "building-2": Building2,
  fuel: Fuel,
  car: Car,
  shirt: Shirt,
  armchair: Armchair,
  zap: Zap,
  shield: Shield,
  "hard-hat": HardHat,
  wifi: Wifi,
  printer: Printer,
  truck: Truck,
  wrench: Wrench,
  clipboard: Clipboard,
  droplets: Droplets,
  thermometer: Thermometer,
  "book-open": BookOpen,
  "flask-conical": FlaskConical,
  smile: Smile,
  wheat: Wheat,
};

export function SegmentIcon({
  name,
  className,
}: {
  name: string | null;
  className?: string;
}) {
  const Icon = ICON_MAP[name || ""] || Package;
  return <Icon className={className} />;
}
