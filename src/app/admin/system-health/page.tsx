import NavTabs from '@/components/Admin/NavTabs';
import { SystemHealthClient } from './SystemHealthClient';
export default function SystemHealthPage() { return <div className="space-y-6 p-4 text-foreground"><NavTabs/><SystemHealthClient/></div>; }
