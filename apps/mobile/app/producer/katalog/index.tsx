import { CatalogScreen } from '@/components/CatalogScreen';
import { useAuth } from '@/providers/auth-context';
import { KatalogManageScreen } from '@/components/KatalogManageScreen';

export default function ProducerKatalogScreen() {
  const { can } = useAuth();
  return can('catalog.manage') ? <KatalogManageScreen /> : <CatalogScreen />;
}
