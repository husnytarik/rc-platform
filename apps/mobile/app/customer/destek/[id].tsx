import { useLocalSearchParams } from 'expo-router';
import { TicketDetailScreen } from '@/components/TicketDetailScreen';

export default function Page() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TicketDetailScreen ticketRef={id} staff={false} />;
}
