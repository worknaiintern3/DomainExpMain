import React from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cloud,
  Code,
  Copy,
  Cpu,
  Database,
  Edit3,
  ExternalLink,
  FileText,
  Filter,
  Globe,
  Home,
  Info,
  Layers,
  Lock,
  LogOut,
  MapPin,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Server,
  Settings,
  Shield,
  User,
  X,
  XCircle,
  Zap,
} from 'lucide-react-native';

export type IconName =
  | 'home'
  | 'globe'
  | 'domains'
  | 'server'
  | 'servers'
  | 'bell'
  | 'alerts'
  | 'settings'
  | 'search'
  | 'plus'
  | 'shield'
  | 'database'
  | 'cloud'
  | 'chevron-right'
  | 'chevron-left'
  | 'alert-triangle'
  | 'activity'
  | 'lock'
  | 'check-circle'
  | 'x-circle'
  | 'refresh'
  | 'user'
  | 'log-out'
  | 'external-link'
  | 'arrow-right'
  | 'clock'
  | 'zap'
  | 'code'
  | 'layers'
  | 'cpu'
  | 'filter'
  | 'more'
  | 'map'
  | 'check'
  | 'info'
  | 'copy'
  | 'edit'
  | 'close'
  | 'x'
  | 'calendar'
  | 'file-text';

interface IconProps {
  name: IconName | string;
  size?: number | undefined;
  color?: string | undefined;
  strokeWidth?: number | undefined;
  style?: any | undefined;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 20,
  color = '#94A3B8',
  strokeWidth = 2,
  style,
}) => {
  const iconProps = { size, color, strokeWidth, style };

  switch (name.toLowerCase()) {
    case 'home':
      return <Home {...iconProps} />;
    case 'globe':
    case 'domains':
      return <Globe {...iconProps} />;
    case 'server':
    case 'servers':
      return <Server {...iconProps} />;
    case 'bell':
    case 'alerts':
      return <Bell {...iconProps} />;
    case 'settings':
      return <Settings {...iconProps} />;
    case 'search':
      return <Search {...iconProps} />;
    case 'plus':
      return <Plus {...iconProps} />;
    case 'shield':
      return <Shield {...iconProps} />;
    case 'database':
      return <Database {...iconProps} />;
    case 'cloud':
      return <Cloud {...iconProps} />;
    case 'chevron-right':
    case 'chevronright':
      return <ChevronRight {...iconProps} />;
    case 'chevron-left':
    case 'chevronleft':
      return <ChevronLeft {...iconProps} />;
    case 'alert-triangle':
    case 'alerttriangle':
    case 'warning':
      return <AlertTriangle {...iconProps} />;
    case 'activity':
      return <Activity {...iconProps} />;
    case 'lock':
      return <Lock {...iconProps} />;
    case 'check-circle':
    case 'checkcircle':
    case 'success':
      return <CheckCircle2 {...iconProps} />;
    case 'x-circle':
    case 'xcircle':
    case 'error':
      return <XCircle {...iconProps} />;
    case 'refresh':
      return <RefreshCw {...iconProps} />;
    case 'user':
      return <User {...iconProps} />;
    case 'log-out':
    case 'logout':
      return <LogOut {...iconProps} />;
    case 'external-link':
      return <ExternalLink {...iconProps} />;
    case 'arrow-right':
      return <ArrowRight {...iconProps} />;
    case 'clock':
      return <Clock {...iconProps} />;
    case 'zap':
      return <Zap {...iconProps} />;
    case 'code':
      return <Code {...iconProps} />;
    case 'layers':
      return <Layers {...iconProps} />;
    case 'cpu':
      return <Cpu {...iconProps} />;
    case 'filter':
      return <Filter {...iconProps} />;
    case 'more':
    case 'more-horizontal':
      return <MoreHorizontal {...iconProps} />;
    case 'map':
      return <MapPin {...iconProps} />;
    case 'check':
      return <Check {...iconProps} />;
    case 'info':
      return <Info {...iconProps} />;
    case 'copy':
      return <Copy {...iconProps} />;
    case 'edit':
    case 'pencil':
      return <Edit3 {...iconProps} />;
    case 'x':
    case 'close':
      return <X {...iconProps} />;
    case 'calendar':
      return <Calendar {...iconProps} />;
    case 'file-text':
    case 'filetext':
    case 'notes':
      return <FileText {...iconProps} />;
    default:
      return <Globe {...iconProps} />;
  }
};
