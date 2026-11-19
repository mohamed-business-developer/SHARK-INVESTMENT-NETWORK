import { View } from 'react-native';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Ban,
  Bookmark,
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  ExternalLink,
  Eye,
  EyeOff,
  FileEdit,
  FileSearch,
  Globe,
  Inbox,
  Info,
  Lock,
  MinusCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  User,
  Users,
  WifiOff,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react-native';
import { getIconMirrorTransform, type DirectionalIconKind } from '@shark/utils';
import { useLocale } from '@/i18n';
import { mobileTheme } from '@/theme';

export const SHARK_ICONS = {
  alertCircle: AlertCircle,
  alertTriangle: AlertTriangle,
  arrowLeft: ArrowLeft,
  arrowRight: ArrowRight,
  ban: Ban,
  bookmark: Bookmark,
  briefcase: Briefcase,
  building2: Building2,
  check: Check,
  checkCircle: CheckCircle2,
  chevronDown: ChevronDown,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  clock: Clock,
  compass: Compass,
  externalLink: ExternalLink,
  eye: Eye,
  eyeOff: EyeOff,
  fileEdit: FileEdit,
  fileSearch: FileSearch,
  globe: Globe,
  inbox: Inbox,
  info: Info,
  lock: Lock,
  minusCircle: MinusCircle,
  refreshCw: RefreshCw,
  search: Search,
  shieldCheck: ShieldCheck,
  slidersHorizontal: SlidersHorizontal,
  trash2: Trash2,
  user: User,
  users: Users,
  wifiOff: WifiOff,
  x: X,
  xCircle: XCircle,
} as const satisfies Record<string, LucideIcon>;

export type SharkIconName = keyof typeof SHARK_ICONS;

export interface AppIconProps {
  readonly name: SharkIconName;
  readonly size?: number;
  readonly color?: string;
  readonly fill?: string;
  readonly directionalKind?: DirectionalIconKind;
}

export function AppIcon({
  name,
  size = 20,
  color = mobileTheme.colors.text.primary,
  fill = 'none',
  directionalKind,
}: AppIconProps) {
  const { locale } = useLocale();
  const IconComponent = SHARK_ICONS[name];
  const mirrorStyle = directionalKind ? getIconMirrorTransform(directionalKind, locale) : undefined;

  return (
    <View style={mirrorStyle}>
      <IconComponent size={size} color={color} fill={fill} strokeWidth={2} />
    </View>
  );
}
