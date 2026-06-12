export type SidebarModule = {
  id: string;
  name: string;
  path: string;
  icon: string | null;
  color: string | null;
  description: string | null;
  type: string;
  appId: string | null;
  group: string | null;
  order: number;
};
