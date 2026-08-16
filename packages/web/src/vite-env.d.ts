/// <reference types="vite/client" />

declare module 'lucide-react' {
  import { FC, SVGProps } from 'react';
  export interface IconProps extends SVGProps<SVGSVGElement> {
    size?: string | number;
    color?: string;
    strokeWidth?: string | number;
    className?: string;
  }
  export type Icon = FC<IconProps>;
  export const ArrowLeft: Icon;
  export const BrainCircuit: Icon;
  export const Users: Icon;
  export const Terminal: Icon;
  export const Sparkles: Icon;
  export const Play: Icon;
  export const Pause: Icon;
  export const AlertTriangle: Icon;
  export const ShieldCheck: Icon;
  export const Database: Icon;
  export const CloudUpload: Icon;
  export const Activity: Icon;
  export const Coins: Icon;
  export const CheckCircle: Icon;
  export const RefreshCw: Icon;
  export const Send: Icon;
  export const Bot: Icon;
  export const User: Icon;
  export const Bell: Icon;
  export const AlertCircle: Icon;
  export const Check: Icon;
  export const X: Icon;
  export const Plus: Icon;
  export const ChevronRight: Icon;
  export const Info: Icon;
  export const HelpCircle: Icon;
  export const Flame: Icon;
  export const CheckCircle2: Icon;
  export const Radio: Icon;
  export const ShieldAlert: Icon;
  export const Cpu: Icon;
  export const CornerDownRight: Icon;
  export const Reply: Icon;
  export const Layers: Icon;
  export const MessageSquare: Icon;
  export const Clock: Icon;
}
