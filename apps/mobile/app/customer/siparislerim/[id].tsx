import { useLocalSearchParams } from 'expo-router';
import { OrderDetailScreen } from '@/components/OrderDetailScreen';

export default function CustomerOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <OrderDetailScreen orderRef={id} />;
}
