import NavTabs from '@/components/Admin/NavTabs';
import AssistantChat from '@/modules/assistant/assistant.ui';

export default function AssistantPage() {
  return <div className="p-4 text-foreground"><NavTabs /><AssistantChat /></div>;
}
